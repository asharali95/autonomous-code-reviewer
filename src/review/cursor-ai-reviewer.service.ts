import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Agent } from '@cursor/sdk';
import { z } from 'zod';
import type { AppEnv } from '../config/env';
import {
  type AiReviewFinding,
  type AiReviewInput,
  type AiReviewResult,
  type AiReviewerPort,
  type ReviewFindingSeverity,
  extractJsonPayload,
} from './ai-reviewer.interface';

const findingSchema = z.object({
  path: z.string().min(1),
  line: z.number().int().positive().nullable().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  message: z.string().min(1).max(2000),
});

const responseSchema = z.object({
  summary: z.string().min(1).max(4000),
  findings: z.array(findingSchema).max(200),
});

@Injectable()
export class CursorAiReviewerService implements AiReviewerPort {
  private readonly logger = new Logger(CursorAiReviewerService.name);

  constructor(private readonly config: ConfigService<AppEnv, true>) {}

  async review(input: AiReviewInput): Promise<AiReviewResult> {
    const modelId = this.config.get('CURSOR_MODEL_ID', { infer: true });
    const apiKey = this.config.get('CURSOR_API_KEY', { infer: true });
    const prompt = buildReviewPrompt(input);

    this.logger.log(
      `Starting Cursor AI review cycle=${input.reviewCycleId} files=${input.files.length} promptChars=${prompt.length}`,
    );

    const run = await Agent.prompt(prompt, {
      apiKey,
      model: { id: modelId },
      name: `pr-review-${input.reviewCycleId.slice(0, 8)}`,
      local: {
        cwd: process.cwd(),
        settingSources: [],
      },
      // Text-only: patches are already in the prompt; no repo tools needed.
      tools: [],
    });

    if (run.status === 'error') {
      throw new Error(
        run.error?.message ?? `Cursor agent failed with status ${run.status}`,
      );
    }

    const rawText = run.result?.trim() ?? '';
    if (!rawText) {
      throw new Error('Cursor agent returned an empty review result');
    }

    const parsed = responseSchema.parse(extractJsonPayload(rawText));
    const findings: AiReviewFinding[] = parsed.findings.map((finding) => ({
      path: finding.path,
      line: finding.line ?? null,
      severity: finding.severity as ReviewFindingSeverity,
      message: finding.message,
    }));

    return {
      summary: parsed.summary,
      findings,
      modelId,
      rawTextLength: rawText.length,
    };
  }
}

function buildReviewPrompt(input: AiReviewInput): string {
  const fileBlocks = input.files
    .map((file, index) => {
      return [
        `### File ${index + 1}: ${file.path}`,
        `status=${file.status} risk=${file.risk}`,
        '```diff',
        file.patch,
        '```',
      ].join('\n');
    })
    .join('\n\n');

  return [
    'You are a senior code reviewer. Review the provided pull-request diffs only.',
    'Do not invent files that are not listed. Focus on bugs, security issues, broken logic, and serious maintainability problems.',
    'Ignore style nits unless they hide a real defect.',
    '',
    `Repository: ${input.repositoryFullName}`,
    `Pull request: #${input.pullNumber}`,
    `Head SHA: ${input.headSha}`,
    `Review cycle: ${input.reviewCycleId}`,
    '',
    'Return ONLY a JSON object with this exact shape:',
    '{',
    '  "summary": "one short paragraph",',
    '  "findings": [',
    '    { "path": "relative/path.ts", "line": 12, "severity": "HIGH", "message": "clear issue" }',
    '  ]',
    '}',
    'severity must be one of LOW, MEDIUM, HIGH, CRITICAL.',
    'Use null for line when no specific line applies.',
    'If there are no issues, return an empty findings array.',
    '',
    '## Diffs',
    fileBlocks || '(no reviewable text patches were available)',
  ].join('\n');
}
