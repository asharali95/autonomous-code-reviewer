import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReviewCycleStatus } from '@prisma/client';
import type { AppEnv } from '../config/env';
import { DiffBuilderService } from '../diffs/diff-builder.service';
import { ReviewCycleRepository } from '../review-cycles/review-cycle.repository';
import {
  AI_REVIEWER_PORT,
  type AiReviewerPort,
} from './ai-reviewer.interface';
import { FindingsService } from './findings.service';

export interface RunReviewResponse {
  reviewCycleId: string;
  status: 'reviewed';
  summary: string;
  findingsCount: number;
  modelId: string;
  filesReviewed: number;
  filesSkipped: number;
}

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    private readonly cycles: ReviewCycleRepository,
    private readonly diffs: DiffBuilderService,
    private readonly findings: FindingsService,
    @Inject(AI_REVIEWER_PORT) private readonly ai: AiReviewerPort,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  async runReview(reviewCycleId: string): Promise<RunReviewResponse> {
    const cycle = await this.cycles.findByIdWithPullRequest(reviewCycleId);
    if (!cycle) {
      throw new NotFoundException('Review cycle not found');
    }
    if (cycle.status !== ReviewCycleStatus.IN_PROGRESS) {
      throw new ConflictException(
        `Review cycle must be IN_PROGRESS (current: ${cycle.status})`,
      );
    }

    const manifest = await this.diffs.buildFullManifest(reviewCycleId);
    const maxFiles = this.config.get('AI_REVIEW_MAX_FILES', { infer: true });
    const maxChars = this.config.get('AI_REVIEW_MAX_PROMPT_CHARS', {
      infer: true,
    });

    const reviewable = manifest.files.filter(
      (file) => file.patchAvailable && file.patch && !file.binary && !file.tooLarge,
    );
    const selected: typeof reviewable = [];
    let usedChars = 0;
    for (const file of reviewable) {
      if (selected.length >= maxFiles) {
        break;
      }
      const patch = file.patch ?? '';
      if (usedChars + patch.length > maxChars) {
        break;
      }
      selected.push(file);
      usedChars += patch.length;
    }

    if (selected.length === 0) {
      throw new BadRequestException(
        'No reviewable text patches available for this cycle',
      );
    }

    const repository = cycle.pullRequest.repository;
    const result = await this.ai.review({
      reviewCycleId: cycle.id,
      repositoryFullName: repository.fullName,
      pullNumber: cycle.pullRequest.number,
      headSha: cycle.headSha,
      files: selected.map((file) => ({
        path: file.path,
        status: file.status,
        risk: file.risk,
        patch: file.patch ?? '',
      })),
    });

    const findingsCount = await this.findings.replaceCycleFindings(
      cycle.id,
      result.findings,
    );

    this.logger.log(
      `AI review finished cycle=${cycle.id} findings=${findingsCount} files=${selected.length}`,
    );

    return {
      reviewCycleId: cycle.id,
      status: 'reviewed',
      summary: result.summary,
      findingsCount,
      modelId: result.modelId,
      filesReviewed: selected.length,
      filesSkipped: Math.max(0, reviewable.length - selected.length),
    };
  }
}
