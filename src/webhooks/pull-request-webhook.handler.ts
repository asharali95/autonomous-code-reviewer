import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  PullRequestState,
  WebhookDeliveryStatus,
} from '@prisma/client';
import { isPrismaUniqueViolation } from '../common/prisma/prisma-errors';
import { PrismaService } from '../common/prisma/prisma.service';
import { PullRequestsService } from '../pull-requests/pull-requests.service';
import { RepositoryRegistryService } from '../repositories/repository-registry.service';
import { ReviewCyclesService } from '../review-cycles/review-cycles.service';

const HANDLED_ACTIONS = new Set(['opened', 'synchronize']);

export interface PullRequestWebhookBody {
  action?: string;
  pull_request?: {
    id?: number;
    number?: number;
    title?: string;
    state?: string;
    base?: { sha?: string };
    head?: { sha?: string };
  };
  repository?: {
    id?: number;
    name?: string;
    full_name?: string;
    owner?: { login?: string };
  };
}

@Injectable()
export class PullRequestWebhookHandler {
  private readonly logger = new Logger(PullRequestWebhookHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repositories: RepositoryRegistryService,
    private readonly pullRequests: PullRequestsService,
    private readonly reviewCycles: ReviewCyclesService,
  ) {}

  async handle(input: {
    deliveryId: string;
    eventType: string;
    body: PullRequestWebhookBody;
  }): Promise<{ status: string }> {
    if (!input.deliveryId || !input.eventType) {
      throw new BadRequestException('Missing GitHub delivery headers');
    }
    await this.recordDelivery(input.deliveryId, input.eventType, input.body.action);

    const actionable =
      input.eventType === 'pull_request' &&
      HANDLED_ACTIONS.has(input.body.action ?? '');

    if (!actionable) {
      await this.markDelivery(input.deliveryId, WebhookDeliveryStatus.IGNORED);
      return { status: 'ignored' };
    }

    const parsed = this.parse(input.body);
    const repository = await this.repositories.upsert({
      githubRepoId: parsed.githubRepoId,
      owner: parsed.owner,
      name: parsed.name,
      fullName: parsed.fullName,
    });
    const pullRequest = await this.pullRequests.upsert({
      repositoryId: repository.id,
      number: parsed.number,
      githubPullId: parsed.githubPullId,
      title: parsed.title,
      state: parsed.state,
      baseSha: parsed.baseSha,
      headSha: parsed.headSha,
    });
    const cycle = await this.reviewCycles.ensureCycleForHead(
      pullRequest.id,
      pullRequest.headSha,
    );
    await this.markDelivery(
      input.deliveryId,
      WebhookDeliveryStatus.PROCESSED,
      pullRequest.id,
      cycle.id,
    );
    this.logger.log({
      deliveryId: input.deliveryId,
      pullRequestId: pullRequest.id,
      reviewCycleId: cycle.id,
      headSha: pullRequest.headSha,
    });
    return { status: 'processed' };
  }

  private async recordDelivery(
    deliveryId: string,
    eventType: string,
    action: string | undefined,
  ): Promise<void> {
    try {
      await this.prisma.webhookDelivery.create({
        data: {
          deliveryId,
          eventType,
          action,
          status: WebhookDeliveryStatus.RECEIVED,
        },
      });
    } catch (error) {
      if (!isPrismaUniqueViolation(error)) {
        throw error;
      }
    }
  }

  private markDelivery(
    deliveryId: string,
    status: WebhookDeliveryStatus,
    pullRequestId?: string,
    reviewCycleId?: string,
  ) {
    return this.prisma.webhookDelivery.update({
      where: { deliveryId },
      data: {
        status,
        processedAt: new Date(),
        pullRequestId,
        reviewCycleId,
      },
    });
  }

  private parse(body: PullRequestWebhookBody) {
    const repository = body.repository;
    const pull = body.pull_request;
    if (
      !repository?.id ||
      !repository.name ||
      !repository.full_name ||
      !repository.owner?.login ||
      !pull?.number ||
      !pull.title ||
      !pull.base?.sha ||
      !pull.head?.sha
    ) {
      throw new Error('Incomplete pull_request webhook payload');
    }
    return {
      githubRepoId: BigInt(repository.id),
      owner: repository.owner.login,
      name: repository.name,
      fullName: repository.full_name,
      githubPullId: pull.id !== undefined ? BigInt(pull.id) : undefined,
      number: pull.number,
      title: pull.title,
      state:
        pull.state === 'open' ? PullRequestState.OPEN : PullRequestState.CLOSED,
      baseSha: pull.base.sha,
      headSha: pull.head.sha,
    };
  }
}
