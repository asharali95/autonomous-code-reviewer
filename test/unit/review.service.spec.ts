import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReviewCycleStatus } from '@prisma/client';
import { DiffBuilderService } from '../../src/diffs/diff-builder.service';
import type { AiReviewerPort } from '../../src/review/ai-reviewer.interface';
import { FindingsService } from '../../src/review/findings.service';
import { ReviewService } from '../../src/review/review.service';
import { ReviewCycleRepository } from '../../src/review-cycles/review-cycle.repository';

describe('ReviewService', () => {
  const cycle = {
    id: 'cycle-1',
    status: ReviewCycleStatus.IN_PROGRESS,
    headSha: 'b'.repeat(40),
    pullRequest: {
      number: 1,
      repository: { fullName: 'org/repo' },
    },
  };

  const diffs = {
    buildFullManifest: jest.fn(),
  };
  const findings = {
    replaceCycleFindings: jest.fn(),
  };
  const ai: AiReviewerPort = {
    review: jest.fn(),
  };
  const cycles = {
    findByIdWithPullRequest: jest.fn(),
  };
  const config = {
    get: (key: string) =>
      key === 'AI_REVIEW_MAX_FILES' ? 10 : 50_000,
  };

  const service = new ReviewService(
    cycles as unknown as ReviewCycleRepository,
    diffs as unknown as DiffBuilderService,
    findings as unknown as FindingsService,
    ai,
    config as unknown as ConfigService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs AI review and persists findings for an IN_PROGRESS cycle', async () => {
    cycles.findByIdWithPullRequest.mockResolvedValue(cycle);
    diffs.buildFullManifest.mockResolvedValue({
      files: [
        {
          path: 'src/a.ts',
          status: 'modified',
          risk: 'high',
          patchAvailable: true,
          binary: false,
          tooLarge: false,
          patch: '@@ -1 +1 @@\n-a\n+b\n',
        },
      ],
    });
    (ai.review as jest.Mock).mockResolvedValue({
      summary: 'Looks mostly fine',
      findings: [
        {
          path: 'src/a.ts',
          line: 1,
          severity: 'MEDIUM',
          message: 'Prefer clearer naming',
        },
      ],
      modelId: 'composer-2.5',
      rawTextLength: 20,
    });
    findings.replaceCycleFindings.mockResolvedValue(1);

    const result = await service.runReview('cycle-1');

    expect(result).toMatchObject({
      status: 'reviewed',
      findingsCount: 1,
      filesReviewed: 1,
      summary: 'Looks mostly fine',
    });
    expect(ai.review).toHaveBeenCalled();
    expect(findings.replaceCycleFindings).toHaveBeenCalledWith(
      'cycle-1',
      expect.any(Array),
    );
  });

  it('rejects cycles that are not IN_PROGRESS', async () => {
    cycles.findByIdWithPullRequest.mockResolvedValue({
      ...cycle,
      status: ReviewCycleStatus.PENDING,
    });
    await expect(service.runReview('cycle-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
