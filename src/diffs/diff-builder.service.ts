import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DiffFallbackReason } from '@prisma/client';
import type { AppEnv } from '../config/env';
import { CompareUnavailableError } from '../github/github.errors';
import {
  GITHUB_APP_PORT,
  type CompareFile,
  type GitHubAppPort,
} from '../github/github-app.interface';
import { ReviewCycleRepository } from '../review-cycles/review-cycle.repository';
import { AiReviewConfigService } from './ai-review-config.service';
import type { RiskLevel } from './ai-review-config.schema';

export interface DiffManifestFile {
  path: string;
  previousPath: string | null;
  status: string;
  risk: RiskLevel;
  binary: boolean;
  patchAvailable: boolean;
  additions: number;
  deletions: number;
  patch: string | null;
  tooLarge: boolean;
}

export interface DiffManifest {
  reviewCycleId: string;
  range: {
    baseSha: string;
    headSha: string;
    fallbackReason: DiffFallbackReason | null;
  };
  config: {
    source: string;
    valid: boolean;
    warnings: string[];
    ignoreGlobs: string[];
    riskRules: { glob: string; risk: RiskLevel }[];
  };
  files: DiffManifestFile[];
  truncated: boolean;
  pageInfo: { nextCursor: string | null };
}

@Injectable()
export class DiffBuilderService {
  constructor(
    private readonly cycles: ReviewCycleRepository,
    private readonly configLoader: AiReviewConfigService,
    @Inject(GITHUB_APP_PORT) private readonly github: GitHubAppPort,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  async buildManifest(
    reviewCycleId: string,
    cursor?: string,
  ): Promise<DiffManifest> {
    const cycle = await this.cycles.findByIdWithPullRequest(reviewCycleId);
    if (!cycle) {
      throw new NotFoundException('Review cycle not found');
    }
    const repository = cycle.pullRequest.repository;
    const maxPatchBytes = this.config.get('MAX_PATCH_BYTES', { infer: true });
    const pageSize = this.config.get('MAX_MANIFEST_FILES', { infer: true });

    const { files, truncated, fallbackReason, effectiveBase } =
      await this.loadFiles(cycle, repository.owner, repository.name);

    const loadedConfig = await this.configLoader.load(
      repository.owner,
      repository.name,
      cycle.diffHeadSha,
    );

    const included = files
      .filter((file) => !this.configLoader.isIgnored(file.path, loadedConfig.ignoreGlobs))
      .map((file) => this.toManifestFile(file, loadedConfig, maxPatchBytes));

    const offset = cursor ? Number(cursor) || 0 : 0;
    const page = included.slice(offset, offset + pageSize);
    const nextOffset = offset + page.length;
    const nextCursor =
      nextOffset < included.length ? String(nextOffset) : null;

    return {
      reviewCycleId: cycle.id,
      range: {
        baseSha: effectiveBase,
        headSha: cycle.diffHeadSha,
        fallbackReason,
      },
      config: {
        source: loadedConfig.source,
        valid: loadedConfig.valid,
        warnings: loadedConfig.warnings,
        ignoreGlobs: loadedConfig.ignoreGlobs,
        riskRules: loadedConfig.riskRules,
      },
      files: page,
      truncated: truncated || nextCursor !== null,
      pageInfo: { nextCursor },
    };
  }

  async buildFullManifest(reviewCycleId: string): Promise<DiffManifest> {
    let cursor: string | undefined;
    const files: DiffManifest['files'] = [];
    let last: DiffManifest | undefined;
    do {
      last = await this.buildManifest(reviewCycleId, cursor);
      files.push(...last.files);
      cursor = last.pageInfo.nextCursor ?? undefined;
    } while (cursor);
    return {
      ...last!,
      files,
      truncated: false,
      pageInfo: { nextCursor: null },
    };
  }

  private async loadFiles(
    cycle: NonNullable<
      Awaited<ReturnType<ReviewCycleRepository['findByIdWithPullRequest']>>
    >,
    owner: string,
    repo: string,
  ): Promise<{
    files: CompareFile[];
    truncated: boolean;
    fallbackReason: DiffFallbackReason | null;
    effectiveBase: string;
  }> {
    if (cycle.diffFallbackReason) {
      return this.fallbackFiles(cycle, owner, repo, cycle.diffFallbackReason);
    }

    try {
      const compared = await this.github.compare(
        owner,
        repo,
        cycle.diffBaseSha,
        cycle.diffHeadSha,
      );
      return {
        files: compared.files,
        truncated: compared.truncated,
        fallbackReason: null,
        effectiveBase: cycle.diffBaseSha,
      };
    } catch (error) {
      if (!(error instanceof CompareUnavailableError)) {
        throw error;
      }
      await this.cycles.setFallbackReason(cycle.id, error.reason);
      return this.fallbackFiles(cycle, owner, repo, error.reason);
    }
  }

  private async fallbackFiles(
    cycle: NonNullable<
      Awaited<ReturnType<ReviewCycleRepository['findByIdWithPullRequest']>>
    >,
    owner: string,
    repo: string,
    reason: DiffFallbackReason,
  ) {
    try {
      const compared = await this.github.compare(
        owner,
        repo,
        cycle.pullRequest.baseSha,
        cycle.diffHeadSha,
      );
      return {
        files: compared.files,
        truncated: compared.truncated,
        fallbackReason: reason,
        effectiveBase: cycle.pullRequest.baseSha,
      };
    } catch {
      const files = await this.github.listPullFiles(
        owner,
        repo,
        cycle.pullRequest.number,
      );
      return {
        files,
        truncated: false,
        fallbackReason: reason,
        effectiveBase: cycle.pullRequest.baseSha,
      };
    }
  }

  private toManifestFile(
    file: CompareFile,
    loadedConfig: Awaited<ReturnType<AiReviewConfigService['load']>>,
    maxPatchBytes: number,
  ): DiffManifestFile {
    const tooLarge =
      file.tooLarge ||
      (file.patch !== null && Buffer.byteLength(file.patch, 'utf8') > maxPatchBytes);
    const patchAvailable = file.patch !== null && !file.binary && !tooLarge;
    return {
      path: file.path,
      previousPath: file.previousPath,
      status: file.status === 'removed' ? 'removed' : file.status,
      risk: this.configLoader.classifyRisk(file.path, loadedConfig.riskRules),
      binary: file.binary,
      patchAvailable,
      additions: file.additions,
      deletions: file.deletions,
      patch: patchAvailable ? file.patch : null,
      tooLarge,
    };
  }
}
