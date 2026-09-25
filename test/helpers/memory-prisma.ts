import {
  type DiffFallbackReason,
  type PullRequestState,
  type ReviewCycleStatus,
  type WebhookDeliveryStatus,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';

interface RepoRow {
  id: string;
  githubRepoId: bigint;
  owner: string;
  name: string;
  fullName: string;
  webhookEnabledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PullRow {
  id: string;
  repositoryId: string;
  number: number;
  githubPullId: bigint | null;
  title: string;
  state: PullRequestState;
  baseSha: string;
  headSha: string;
  lastReviewedSha: string | null;
  lastReviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CycleRow {
  id: string;
  pullRequestId: string;
  headSha: string;
  status: ReviewCycleStatus;
  diffBaseSha: string;
  diffHeadSha: string;
  diffFallbackReason: DiffFallbackReason | null;
  failureReason: string | null;
  claimedAt: Date | null;
  claimedBy: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DeliveryRow {
  id: string;
  deliveryId: string;
  eventType: string;
  action: string | null;
  status: WebhookDeliveryStatus;
  receivedAt: Date;
  processedAt: Date | null;
  pullRequestId: string | null;
  reviewCycleId: string | null;
}

interface OutboxRow {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Prisma.JsonValue;
  createdAt: Date;
  publishedAt: Date | null;
}

export function createMemoryPrisma() {
  const repos: RepoRow[] = [];
  const prs: PullRow[] = [];
  const cycles: CycleRow[] = [];
  const deliveries: DeliveryRow[] = [];
  const outbox: OutboxRow[] = [];
  let queue = Promise.resolve();

  const api = {
    gitHubRepository: {
      async upsert(args: {
        where: { githubRepoId: bigint };
        create: Omit<RepoRow, 'id' | 'createdAt' | 'updatedAt'> & {
          webhookEnabledAt?: Date | null;
        };
        update: Partial<RepoRow>;
      }) {
        const existing = repos.find(
          (row) => row.githubRepoId === args.where.githubRepoId,
        );
        if (existing) {
          Object.assign(existing, args.update, { updatedAt: new Date() });
          return existing;
        }
        const created: RepoRow = {
          id: randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
          webhookEnabledAt: args.create.webhookEnabledAt ?? null,
          ...args.create,
        };
        repos.push(created);
        return created;
      },
      async findUnique(args: { where: { githubRepoId: bigint } }) {
        return (
          repos.find((row) => row.githubRepoId === args.where.githubRepoId) ??
          null
        );
      },
    },
    pullRequest: {
      async upsert(args: {
        where: { repositoryId_number: { repositoryId: string; number: number } };
        create: Omit<PullRow, 'id' | 'createdAt' | 'updatedAt' | 'lastReviewedSha' | 'lastReviewedAt'> & {
          githubPullId?: bigint;
        };
        update: Partial<PullRow>;
      }) {
        const existing = prs.find(
          (row) =>
            row.repositoryId === args.where.repositoryId_number.repositoryId &&
            row.number === args.where.repositoryId_number.number,
        );
        if (existing) {
          Object.assign(existing, args.update, { updatedAt: new Date() });
          return existing;
        }
        const created: PullRow = {
          id: randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
          lastReviewedSha: null,
          lastReviewedAt: null,
          githubPullId: args.create.githubPullId ?? null,
          ...args.create,
        };
        prs.push(created);
        return created;
      },
      async findUnique(args: {
        where: { repositoryId_number: { repositoryId: string; number: number } };
      }) {
        return (
          prs.find(
            (row) =>
              row.repositoryId === args.where.repositoryId_number.repositoryId &&
              row.number === args.where.repositoryId_number.number,
          ) ?? null
        );
      },
      async update(args: { where: { id: string }; data: Partial<PullRow> }) {
        const row = prs.find((item) => item.id === args.where.id);
        if (!row) {
          throw new Error('Pull request not found');
        }
        Object.assign(row, args.data, { updatedAt: new Date() });
        return row;
      },
    },
    webhookDelivery: {
      async create(args: {
        data: {
          deliveryId: string;
          eventType: string;
          action?: string;
          status: WebhookDeliveryStatus;
        };
      }) {
        if (deliveries.some((row) => row.deliveryId === args.data.deliveryId)) {
          throw Object.assign(new Error('Unique constraint failed'), {
            code: 'P2002',
          });
        }
        const created: DeliveryRow = {
          id: randomUUID(),
          deliveryId: args.data.deliveryId,
          eventType: args.data.eventType,
          action: args.data.action ?? null,
          status: args.data.status,
          receivedAt: new Date(),
          processedAt: null,
          pullRequestId: null,
          reviewCycleId: null,
        };
        deliveries.push(created);
        return created;
      },
      async update(args: {
        where: { deliveryId: string };
        data: Partial<DeliveryRow>;
      }) {
        const row = deliveries.find(
          (item) => item.deliveryId === args.where.deliveryId,
        );
        if (!row) {
          throw new Error('Delivery not found');
        }
        Object.assign(row, args.data);
        return row;
      },
    },
    reviewCycle: {
      async findUnique(args: {
        where:
          | { id: string }
          | { pullRequestId_headSha: { pullRequestId: string; headSha: string } };
        include?: { pullRequest?: { include?: { repository?: boolean } } };
      }) {
        const row = findCycle(args.where);
        if (!row) {
          return null;
        }
        return hydrateCycle(row, args.include);
      },
      async findUniqueOrThrow(args: {
        where:
          | { id: string }
          | { pullRequestId_headSha: { pullRequestId: string; headSha: string } };
        include?: { pullRequest?: { include?: { repository?: boolean } } };
      }) {
        const row = findCycle(args.where);
        if (!row) {
          throw new Error('Review cycle not found');
        }
        return hydrateCycle(row, args.include);
      },
      async create(args: {
        data: {
          pullRequestId: string;
          headSha: string;
          status: ReviewCycleStatus;
          diffBaseSha: string;
          diffHeadSha: string;
        };
      }) {
        if (
          cycles.some(
            (row) =>
              row.pullRequestId === args.data.pullRequestId &&
              row.headSha === args.data.headSha,
          )
        ) {
          throw Object.assign(new Error('Unique constraint failed'), {
            code: 'P2002',
          });
        }
        const created: CycleRow = {
          id: randomUUID(),
          pullRequestId: args.data.pullRequestId,
          headSha: args.data.headSha,
          status: args.data.status,
          diffBaseSha: args.data.diffBaseSha,
          diffHeadSha: args.data.diffHeadSha,
          diffFallbackReason: null,
          failureReason: null,
          claimedAt: null,
          claimedBy: null,
          startedAt: null,
          completedAt: null,
          failedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        cycles.push(created);
        return created;
      },
      async updateMany(args: {
        where: { id: string; status: { in: ReviewCycleStatus[] } };
        data: Partial<CycleRow>;
      }) {
        const row = cycles.find(
          (item) =>
            item.id === args.where.id &&
            args.where.status.in.includes(item.status),
        );
        if (!row) {
          return { count: 0 };
        }
        Object.assign(row, args.data, { updatedAt: new Date() });
        return { count: 1 };
      },
      async update(args: { where: { id: string }; data: Partial<CycleRow> }) {
        const row = cycles.find((item) => item.id === args.where.id);
        if (!row) {
          throw new Error('Review cycle not found');
        }
        Object.assign(row, args.data, { updatedAt: new Date() });
        return row;
      },
    },
    outboxEvent: {
      async create(args: {
        data: {
          aggregateType: string;
          aggregateId: string;
          eventType: string;
          payload: Prisma.JsonValue;
        };
      }) {
        const created: OutboxRow = {
          id: randomUUID(),
          ...args.data,
          createdAt: new Date(),
          publishedAt: null,
        };
        outbox.push(created);
        return created;
      },
      async findMany() {
        return outbox;
      },
    },
    async $transaction<T>(fn: (tx: typeof api) => Promise<T>): Promise<T> {
      const run = queue.then(() => fn(api));
      queue = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
    async $queryRaw(strings: TemplateStringsArray, ...params: unknown[]) {
      const sql = strings.join('?');
      if (sql.includes('SELECT 1')) {
        return [{ '?column?': 1 }];
      }
      if (sql.includes('"PullRequest"') && sql.includes('FOR UPDATE')) {
        const row = prs.find((item) => item.id === params[0]);
        return row ? [row] : [];
      }
      if (sql.includes('"ReviewCycle"') && sql.includes('FOR UPDATE')) {
        const row = cycles.find((item) => item.id === params[0]);
        return row ? [row] : [];
      }
      return [];
    },
    async $connect() {
      return undefined;
    },
    async $disconnect() {
      return undefined;
    },
  };

  function findCycle(
    where:
      | { id: string }
      | { pullRequestId_headSha: { pullRequestId: string; headSha: string } },
  ) {
    if ('id' in where) {
      return cycles.find((row) => row.id === where.id);
    }
    return cycles.find(
      (row) =>
        row.pullRequestId === where.pullRequestId_headSha.pullRequestId &&
        row.headSha === where.pullRequestId_headSha.headSha,
    );
  }

  function hydrateCycle(
    row: CycleRow,
    include?: { pullRequest?: { include?: { repository?: boolean } } },
  ) {
    if (!include?.pullRequest) {
      return row;
    }
    const pullRequest = prs.find((item) => item.id === row.pullRequestId);
    if (!pullRequest) {
      return { ...row, pullRequest: null };
    }
    if (!include.pullRequest.include?.repository) {
      return { ...row, pullRequest };
    }
    const repository = repos.find((item) => item.id === pullRequest.repositoryId);
    return { ...row, pullRequest: { ...pullRequest, repository } };
  }

  return {
    prisma: api,
    state: { repos, prs, cycles, deliveries, outbox },
  };
}
