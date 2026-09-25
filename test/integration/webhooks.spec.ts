import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createGitHubMock, createTestApp } from '../helpers/app';
import { pullRequestPayload, signBody } from '../helpers/webhook';

describe('GitHub webhooks', () => {
  let app: INestApplication;
  let memory: Awaited<ReturnType<typeof createTestApp>>['memory'];

  beforeEach(async () => {
    ({ app, memory } = await createTestApp(createGitHubMock()));
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects an invalid webhook signature', async () => {
    const body = JSON.stringify(pullRequestPayload());
    await request(app.getHttpServer())
      .post('/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('X-GitHub-Event', 'pull_request')
      .set('X-GitHub-Delivery', 'delivery-invalid')
      .set('X-Hub-Signature-256', 'sha256=00')
      .send(body)
      .expect(401);
    expect(memory.state.cycles).toHaveLength(0);
  });

  it('creates a cycle on opened and ignores a duplicate delivery', async () => {
    const body = JSON.stringify(pullRequestPayload());
    const headers = {
      'Content-Type': 'application/json',
      'X-GitHub-Event': 'pull_request',
      'X-GitHub-Delivery': 'delivery-1',
      'X-Hub-Signature-256': signBody(body),
    };

    await request(app.getHttpServer())
      .post('/webhooks/github')
      .set(headers)
      .send(body)
      .expect(200)
      .expect({ status: 'processed' });

    await request(app.getHttpServer())
      .post('/webhooks/github')
      .set(headers)
      .send(body)
      .expect(200);

    expect(memory.state.deliveries).toHaveLength(1);
    expect(memory.state.cycles).toHaveLength(1);
    expect(memory.state.prs[0].lastReviewedSha).toBeNull();
    expect(memory.state.cycles[0].diffBaseSha).toBe('a'.repeat(40));
    expect(memory.state.cycles[0].diffHeadSha).toBe('b'.repeat(40));
  });

  it('uses lastReviewedSha after a completed review for a new push', async () => {
    const opened = JSON.stringify(pullRequestPayload());
    await request(app.getHttpServer())
      .post('/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('X-GitHub-Event', 'pull_request')
      .set('X-GitHub-Delivery', 'opened-1')
      .set('X-Hub-Signature-256', signBody(opened))
      .send(opened)
      .expect(200);

    memory.state.cycles[0].status = 'IN_PROGRESS';
    const { ReviewCycleRepository } = await import(
      '../../src/review-cycles/review-cycle.repository'
    );
    const repo = new ReviewCycleRepository(memory.prisma as never);
    await repo.complete(memory.state.cycles[0].id);

    const nextHead = 'd'.repeat(40);
    const sync = JSON.stringify(
      pullRequestPayload({ action: 'synchronize', headSha: nextHead }),
    );
    await request(app.getHttpServer())
      .post('/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('X-GitHub-Event', 'pull_request')
      .set('X-GitHub-Delivery', 'sync-1')
      .set('X-Hub-Signature-256', signBody(sync))
      .send(sync)
      .expect(200);

    expect(memory.state.cycles).toHaveLength(2);
    const next = memory.state.cycles.find((cycle) => cycle.headSha === nextHead);
    expect(next?.diffBaseSha).toBe('b'.repeat(40));
    expect(next?.diffHeadSha).toBe(nextHead);
  });
});
