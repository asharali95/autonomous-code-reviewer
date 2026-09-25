import { Injectable } from '@nestjs/common';
import type { PullRequest, PullRequestState } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class PullRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  upsert(input: {
    repositoryId: string;
    number: number;
    githubPullId?: bigint;
    title: string;
    state: PullRequestState;
    baseSha: string;
    headSha: string;
  }): Promise<PullRequest> {
    return this.prisma.pullRequest.upsert({
      where: {
        repositoryId_number: {
          repositoryId: input.repositoryId,
          number: input.number,
        },
      },
      create: {
        repositoryId: input.repositoryId,
        number: input.number,
        githubPullId: input.githubPullId,
        title: input.title,
        state: input.state,
        baseSha: input.baseSha,
        headSha: input.headSha,
      },
      update: {
        githubPullId: input.githubPullId,
        title: input.title,
        state: input.state,
        baseSha: input.baseSha,
        headSha: input.headSha,
      },
    });
  }

  findByRepoAndNumber(
    repositoryId: string,
    number: number,
  ): Promise<PullRequest | null> {
    return this.prisma.pullRequest.findUnique({
      where: { repositoryId_number: { repositoryId, number } },
    });
  }
}
