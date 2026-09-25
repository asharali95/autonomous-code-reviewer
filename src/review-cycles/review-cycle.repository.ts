import { Injectable } from '@nestjs/common';
import {
  type DiffFallbackReason,
  type PullRequest,
  type ReviewCycle,
  ReviewCycleStatus,
} from '@prisma/client';
import { isPrismaUniqueViolation } from '../common/prisma/prisma-errors';
import { PrismaService } from '../common/prisma/prisma.service';
import { selectDiffRange } from './diff-range';

@Injectable()
export class ReviewCycleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async ensureCycleForHead(
    pullRequestId: string,
    headSha: string,
  ): Promise<ReviewCycle> {
    return this.prisma.$transaction(async (tx) => {
      // IDs are Prisma String (Postgres TEXT), not native uuid columns.
      const locked = await tx.$queryRaw<PullRequest[]>`
        SELECT * FROM "PullRequest" WHERE id = ${pullRequestId} FOR UPDATE
      `;
      const pullRequest = locked[0];
      if (!pullRequest) {
        throw new Error(`Pull request ${pullRequestId} not found`);
      }

      const existing = await tx.reviewCycle.findUnique({
        where: {
          pullRequestId_headSha: { pullRequestId, headSha },
        },
      });
      if (existing) {
        return existing;
      }

      const range = selectDiffRange(
        pullRequest.baseSha,
        headSha,
        pullRequest.lastReviewedSha,
      );

      try {
        return await tx.reviewCycle.create({
          data: {
            pullRequestId,
            headSha,
            status: ReviewCycleStatus.PENDING,
            diffBaseSha: range.diffBaseSha,
            diffHeadSha: range.diffHeadSha,
          },
        });
      } catch (error) {
        if (!isPrismaUniqueViolation(error)) {
          throw error;
        }
        return tx.reviewCycle.findUniqueOrThrow({
          where: { pullRequestId_headSha: { pullRequestId, headSha } },
        });
      }
    });
  }

  async claim(
    cycleId: string,
    workerId: string,
  ): Promise<{ cycle: ReviewCycle; claimed: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM "ReviewCycle" WHERE id = ${cycleId} FOR UPDATE
      `;
      const updated = await tx.reviewCycle.updateMany({
        where: {
          id: cycleId,
          status: {
            in: [ReviewCycleStatus.PENDING, ReviewCycleStatus.FAILED],
          },
        },
        data: {
          status: ReviewCycleStatus.IN_PROGRESS,
          claimedAt: new Date(),
          claimedBy: workerId,
          startedAt: new Date(),
          failedAt: null,
          failureReason: null,
        },
      });
      const cycle = await tx.reviewCycle.findUniqueOrThrow({
        where: { id: cycleId },
      });
      return { cycle, claimed: updated.count === 1 };
    });
  }

  async complete(
    cycleId: string,
  ): Promise<{ cycle: ReviewCycle; lastReviewedSha: string | null }> {
    return this.prisma.$transaction(async (tx) => {
      const cycle = await tx.reviewCycle.findUniqueOrThrow({
        where: { id: cycleId },
        include: { pullRequest: true },
      });

      if (cycle.status === ReviewCycleStatus.COMPLETED) {
        return {
          cycle,
          lastReviewedSha: cycle.pullRequest.lastReviewedSha,
        };
      }

      if (cycle.status !== ReviewCycleStatus.IN_PROGRESS) {
        throw new CompleteConflictError(cycle.status);
      }

      const completed = await tx.reviewCycle.update({
        where: { id: cycleId },
        data: {
          status: ReviewCycleStatus.COMPLETED,
          completedAt: new Date(),
          failureReason: null,
          failedAt: null,
        },
      });

      let lastReviewedSha = cycle.pullRequest.lastReviewedSha;
      if (cycle.pullRequest.headSha === cycle.headSha) {
        const updated = await tx.pullRequest.update({
          where: { id: cycle.pullRequestId },
          data: {
            lastReviewedSha: cycle.headSha,
            lastReviewedAt: new Date(),
          },
        });
        lastReviewedSha = updated.lastReviewedSha;
      }

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'ReviewCycle',
          aggregateId: cycle.id,
          eventType: 'review_cycle.completed',
          payload: {
            reviewCycleId: cycle.id,
            pullRequestId: cycle.pullRequestId,
            headSha: cycle.headSha,
          },
        },
      });

      return { cycle: completed, lastReviewedSha };
    });
  }

  async fail(cycleId: string, reason: string): Promise<ReviewCycle> {
    return this.prisma.$transaction(async (tx) => {
      const cycle = await tx.reviewCycle.findUniqueOrThrow({
        where: { id: cycleId },
      });
      if (cycle.status === ReviewCycleStatus.FAILED) {
        return cycle;
      }
      if (cycle.status !== ReviewCycleStatus.IN_PROGRESS) {
        throw new FailConflictError(cycle.status);
      }
      return tx.reviewCycle.update({
        where: { id: cycleId },
        data: {
          status: ReviewCycleStatus.FAILED,
          failedAt: new Date(),
          failureReason: reason.slice(0, 500),
        },
      });
    });
  }

  findById(id: string): Promise<ReviewCycle | null> {
    return this.prisma.reviewCycle.findUnique({ where: { id } });
  }

  findByIdWithPullRequest(id: string) {
    return this.prisma.reviewCycle.findUnique({
      where: { id },
      include: {
        pullRequest: { include: { repository: true } },
      },
    });
  }

  findByPullRequestAndHead(pullRequestId: string, headSha: string) {
    return this.prisma.reviewCycle.findUnique({
      where: { pullRequestId_headSha: { pullRequestId, headSha } },
    });
  }

  setFallbackReason(id: string, reason: DiffFallbackReason): Promise<ReviewCycle> {
    return this.prisma.reviewCycle.update({
      where: { id },
      data: { diffFallbackReason: reason },
    });
  }
}

export class CompleteConflictError extends Error {
  constructor(public readonly status: ReviewCycleStatus) {
    super(`Cannot complete review cycle in status ${status}`);
  }
}

export class FailConflictError extends Error {
  constructor(public readonly status: ReviewCycleStatus) {
    super(`Cannot fail review cycle in status ${status}`);
  }
}
