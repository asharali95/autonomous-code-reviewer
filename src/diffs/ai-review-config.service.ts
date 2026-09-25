import { Inject, Injectable } from '@nestjs/common';
import { load } from 'js-yaml';
import { minimatch } from 'minimatch';
import {
  GITHUB_APP_PORT,
  type GitHubAppPort,
} from '../github/github-app.interface';
import {
  type AiReviewConfig,
  type RiskLevel,
  aiReviewConfigSchema,
  DEFAULT_IGNORE_GLOBS,
} from './ai-review-config.schema';

export interface LoadedAiReviewConfig {
  source: 'repo_file' | 'defaults';
  valid: boolean;
  warnings: string[];
  ignoreGlobs: string[];
  riskRules: AiReviewConfig['riskRules'];
  maxFileBytes?: number;
}

@Injectable()
export class AiReviewConfigService {
  constructor(
    @Inject(GITHUB_APP_PORT) private readonly github: GitHubAppPort,
  ) {}

  async load(
    owner: string,
    repo: string,
    headSha: string,
  ): Promise<LoadedAiReviewConfig> {
    const raw = await this.github.getFileContents(
      owner,
      repo,
      '.ai-review.yml',
      headSha,
    );
    if (raw === null) {
      return this.withDefaults({
        source: 'defaults',
        valid: true,
        warnings: [],
        parsed: aiReviewConfigSchema.parse({}),
      });
    }
    return this.parse(raw);
  }

  parse(raw: string): LoadedAiReviewConfig {
    let parsedUnknown: unknown;
    try {
      parsedUnknown = load(raw) ?? {};
    } catch {
      return this.withDefaults({
        source: 'repo_file',
        valid: false,
        warnings: ['Invalid YAML in .ai-review.yml; using defaults'],
        parsed: aiReviewConfigSchema.parse({}),
      });
    }

    const result = aiReviewConfigSchema.safeParse(parsedUnknown);
    if (!result.success) {
      return this.withDefaults({
        source: 'repo_file',
        valid: false,
        warnings: ['Invalid .ai-review.yml schema; using defaults'],
        parsed: aiReviewConfigSchema.parse({}),
      });
    }

    return this.withDefaults({
      source: 'repo_file',
      valid: true,
      warnings: [],
      parsed: result.data,
    });
  }

  classifyRisk(path: string, rules: AiReviewConfig['riskRules']): RiskLevel {
    for (const rule of rules) {
      if (minimatch(path, rule.glob, { dot: true })) {
        return rule.risk;
      }
    }
    return 'medium';
  }

  isIgnored(path: string, ignoreGlobs: string[]): boolean {
    return ignoreGlobs.some((glob) => minimatch(path, glob, { dot: true }));
  }

  private withDefaults(input: {
    source: LoadedAiReviewConfig['source'];
    valid: boolean;
    warnings: string[];
    parsed: AiReviewConfig;
  }): LoadedAiReviewConfig {
    const ignoreGlobs = unique([...DEFAULT_IGNORE_GLOBS, ...input.parsed.ignore]);
    return {
      source: input.source,
      valid: input.valid,
      warnings: input.warnings,
      ignoreGlobs,
      riskRules: input.parsed.riskRules,
      maxFileBytes: input.parsed.maxFileBytes,
    };
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
