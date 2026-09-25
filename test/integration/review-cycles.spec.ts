import { ReviewCycleStatus } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { ReviewCycleRepository } from '../../src/review-cycles/review-cycle.repository';
import { createMemoryPrisma } from '../helpers/memory-prisma';

describe('Review cycle transactions', () => {
  function setup() {
    const memory = createMemoryPrisma();
    const repo = new ReviewCycleRepository(
      memory.prisma as unknown as PrismaService,
    );
    return { memory, repo };
  }

  async function seedPr(memory: ReturnType<typeof createMemoryPrisma>) {
    const repository = await memory.prisma.gitHubRepository.upsert({
      where: { githubRepoId: 1n },
      create: {
        githubRepoId: 1n,
        owner: 'org',
        name: 'repo',
        fullName: 'org/repo',
      },
      update: {},
    });
    return memory.prisma.pullRequest.upsert({
      where: { repositoryId_number: { repositoryId: repository.id, number: 1 } },
      create: {
        repositoryId: repository.id,
        number: 1,
        title: 'PR',
        state: 'OPEN',
        baseSha: 'a'.repeat(40),
        headSha: 'b'.repeat(40),
      },
      update: {},
    });
  }

  it('returns the same cycle when two workers claim the same PR/head SHA', async () => {
    const { memory, repo } = setup();
    const pr = await seedPr(memory);
    const created = await repo.ensureCycleForHead(pr.id, pr.headSha);

    const [first, second] = await Promise.all([
      repo.claim(created.id, 'worker-a'),
      repo.claim(created.id, 'worker-b'),
    ]);

    expect(first.cycle.id).toBe(second.cycle.id);
    expect(memory.state.cycles).toHaveLength(1);
    expect(memory.state.cycles[0].status).toBe(ReviewCycleStatus.IN_PROGRESS);
    expect([first.claimed, second.claimed].filter(Boolean)).toHaveLength(1);
  });

  it('advances lastReviewedSha exactly once on completion', async () => {
    const { memory, repo } = setup();
    const pr = await seedPr(memory);
    const cycle = await repo.ensureCycleForHead(pr.id, pr.headSha);
    await repo.claim(cycle.id, 'worker-a');

    const first = await repo.complete(cycle.id);
    const second = await repo.complete(cycle.id);

    expect(first.lastReviewedSha).toBe(pr.headSha);
    expect(second.lastReviewedSha).toBe(pr.headSha);
    expect(memory.state.prs[0].lastReviewedSha).toBe(pr.headSha);
    expect(memory.state.outbox).toHaveLength(1);
    expect(memory.state.outbox[0].eventType).toBe('review_cycle.completed');
  });

  it('does not advance lastReviewedSha when a cycle fails, then allows retry', async () => {
    const { memory, repo } = setup();
    const pr = await seedPr(memory);
    const cycle = await repo.ensureCycleForHead(pr.id, pr.headSha);
    await repo.claim(cycle.id, 'worker-a');

    await repo.fail(cycle.id, 'GITHUB_RATE_LIMIT');
    expect(memory.state.prs[0].lastReviewedSha).toBeNull();
    expect(memory.state.cycles[0].status).toBe(ReviewCycleStatus.FAILED);

    const retried = await repo.claim(cycle.id, 'worker-b');
    expect(retried.claimed).toBe(true);
    expect(retried.cycle.status).toBe(ReviewCycleStatus.IN_PROGRESS);
    expect(memory.state.cycles).toHaveLength(1);
  });
});
