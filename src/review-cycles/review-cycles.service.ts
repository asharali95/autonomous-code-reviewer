import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type GitHubRepository,
  type PullRequest,
  type ReviewCycle,
  PullRequestState,
} from '@prisma/client';
import {
  GITHUB_APP_PORT,
  type GitHubAppPort,
} from '../github/github-app.interface';
import { PullRequestsService } from '../pull-requests/pull-requests.service';
import { RepositoryRegistryService } from '../repositories/repository-registry.service';
import {
  CompleteConflictError,
  FailConflictError,
  ReviewCycleRepository,
} from './review-cycle.repository';

@Injectable()
export class ReviewCyclesService {
  constructor(
    private readonly cycles: ReviewCycleRepository,
    private readonly pullRequests: PullRequestsService,
    private readonly repositories: RepositoryRegistryService,
    @Inject(GITHUB_APP_PORT) private readonly github: GitHubAppPort,
  ) {}

  ensureCycleForHead(pullRequestId: string, headSha: string) {
    return this.cycles.ensureCycleForHead(pullRequestId, headSha);
  }

  async getPrState(githubRepoId: bigint, number: number) {
    const repository = await this.repositories.findByGithubRepoId(githubRepoId);
    if (!repository) {
      throw new NotFoundException('Repository not found');
    }
    const pullRequest = await this.pullRequests.findByRepoAndNumber(
      repository.id,
      number,
    );
    if (!pullRequest) {
      throw new NotFoundException('Pull request not found');
    }
    const activeCycle = await this.cycles.findByPullRequestAndHead(
      pullRequest.id,
      pullRequest.headSha,
    );
    return { repository, pullRequest, activeCycle };
  }

  async claim(input: {
    githubRepoId: bigint;
    pullNumber: number;
    headSha: string;
    workerId: string;
  }): Promise<{ reviewCycle: ReviewCycle; created: boolean }> {
    const metadata = await this.refreshPullRequest(
      input.githubRepoId,
      input.pullNumber,
    );
    const before = await this.cycles.findByPullRequestAndHead(
      metadata.pullRequest.id,
      input.headSha,
    );
    const cycle = await this.cycles.ensureCycleForHead(
      metadata.pullRequest.id,
      input.headSha,
    );
    const { cycle: claimed } = await this.cycles.claim(cycle.id, input.workerId);
    return { reviewCycle: claimed, created: !before };
  }

  async complete(reviewCycleId: string) {
    try {
      const result = await this.cycles.complete(reviewCycleId);
      return {
        status: result.cycle.status,
        lastReviewedSha: result.lastReviewedSha,
      };
    } catch (error) {
      if (error instanceof CompleteConflictError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  async fail(reviewCycleId: string, reason: string) {
    try {
      const cycle = await this.cycles.fail(reviewCycleId, reason);
      return { status: cycle.status };
    } catch (error) {
      if (error instanceof FailConflictError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  private async refreshPullRequest(
    githubRepoId: bigint,
    pullNumber: number,
  ): Promise<{ repository: GitHubRepository; pullRequest: PullRequest }> {
    let repository = await this.repositories.findByGithubRepoId(githubRepoId);
    if (!repository) {
      throw new NotFoundException('Repository not found');
    }
    const remote = await this.github.getPullRequest(
      repository.owner,
      repository.name,
      pullNumber,
    );
    repository = await this.repositories.upsert({
      githubRepoId: remote.githubRepoId,
      owner: remote.owner,
      name: remote.repo,
      fullName: `${remote.owner}/${remote.repo}`,
    });
    const pullRequest = await this.pullRequests.upsert({
      repositoryId: repository.id,
      number: remote.number,
      githubPullId: remote.githubPullId,
      title: remote.title,
      state:
        remote.state === 'open'
          ? PullRequestState.OPEN
          : PullRequestState.CLOSED,
      baseSha: remote.baseSha,
      headSha: remote.headSha,
    });
    return { repository, pullRequest };
  }
}
