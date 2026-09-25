import { createHash } from 'crypto';
import { FindingSeverity } from '@prisma/client';

export type ReviewFindingSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AiReviewFinding {
  path: string;
  line: number | null;
  severity: ReviewFindingSeverity;
  message: string;
}

export interface AiReviewInput {
  reviewCycleId: string;
  repositoryFullName: string;
  pullNumber: number;
  headSha: string;
  files: Array<{
    path: string;
    status: string;
    risk: string;
    patch: string;
  }>;
}

export interface AiReviewResult {
  summary: string;
  findings: AiReviewFinding[];
  modelId: string;
  rawTextLength: number;
}

export const AI_REVIEWER_PORT = 'AI_REVIEWER_PORT';

export interface AiReviewerPort {
  review(input: AiReviewInput): Promise<AiReviewResult>;
}

export function fingerprintFinding(finding: AiReviewFinding): string {
  const normalized = [
    finding.path.trim(),
    finding.line ?? '',
    finding.severity,
    finding.message.trim().toLowerCase(),
  ].join('|');
  return createHash('sha256').update(normalized).digest('hex').slice(0, 32);
}

export function toPrismaSeverity(
  severity: ReviewFindingSeverity,
): FindingSeverity {
  return FindingSeverity[severity];
}

export function extractJsonPayload(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();
  const objectMatch = candidate.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    throw new Error('AI response did not contain a JSON object');
  }
  return JSON.parse(objectMatch[0]) as unknown;
}
