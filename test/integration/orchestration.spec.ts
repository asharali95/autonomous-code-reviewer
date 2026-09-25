import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { CompareUnavailableError } from '../../src/github/github.errors';
import { createGitHubMock, createTestApp } from '../helpers/app';
import { pullRequestPayload, signBody } from '../helpers/webhook';

const TOKEN = 'test-n8n-token';

describe('Orchestration API', () => {
  let app: INestApplication;

  beforeEach(async () => {
    ({ app } = await createTestApp(
      createGitHubMock({
        compare: async (_owner, _repo, base) => {
          if (base === 'c'.repeat(40)) {
            throw new CompareUnavailableError('COMPARE_UNREACHABLE');
          }
          return {
            files: [
              {
                path: 'src/foo.ts',
                previousPath: null,
                status: 'modified',
                additions: 10,
                deletions: 2,
                patch: '@@ patch',
                binary: false,
                tooLarge: false,
              },
            ],
            truncated: false,
            mergeBaseCommitSha: base,
          };
        },
      }),
    ));
  });

  afterEach(async () => {
    await app.close();
  });

  async function ingestOpened() {
    const body = JSON.stringify(pullRequestPayload());
    await request(app.getHttpServer())
      .post('/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('X-GitHub-Event', 'pull_request')
      .set('X-GitHub-Delivery', 'orch-open')
      .set('X-Hub-Signature-256', signBody(body))
      .send(body)
      .expect(200);
  }

  it('requires a bearer token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/orchestration/repositories/123456789/pulls/42')
      .expect(401);
  });

  it('reads PR state, claims a cycle, returns a manifest, and completes', async () => {
    await ingestOpened();

    const state = await request(app.getHttpServer())
      .get('/api/v1/orchestration/repositories/123456789/pulls/42')
      .set('Authorization', `Bearer ${TOKEN}`)
      .expect(200);

    expect(state.body.pullRequest.headSha).toBe('b'.repeat(40));
    expect(state.body.activeCycle.status).toBe('PENDING');

    const claimed = await request(app.getHttpServer())
      .post('/api/v1/orchestration/review-cycles/claim')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        githubRepoId: '123456789',
        pullNumber: 42,
        headSha: 'b'.repeat(40),
        workerId: 'n8n-workflow-1',
      })
      .expect(200);

    expect(claimed.body.reviewCycle.status).toBe('IN_PROGRESS');
    const cycleId = claimed.body.reviewCycle.id as string;

    const manifest = await request(app.getHttpServer())
      .get(`/api/v1/orchestration/review-cycles/${cycleId}/diff-manifest`)
      .set('Authorization', `Bearer ${TOKEN}`)
      .expect(200);

    expect(manifest.body.files[0].path).toBe('src/foo.ts');
    expect(manifest.body.config.source).toBe('defaults');

    const completed = await request(app.getHttpServer())
      .post(`/api/v1/orchestration/review-cycles/${cycleId}/complete`)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ workerId: 'n8n-workflow-1', summary: 'done' })
      .expect(200);

    expect(completed.body.status).toBe('COMPLETED');
    expect(completed.body.lastReviewedSha).toBe('b'.repeat(40));
  });

  it('can mark a cycle failed', async () => {
    await ingestOpened();
    const claimed = await request(app.getHttpServer())
      .post('/api/v1/orchestration/review-cycles/claim')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        githubRepoId: '123456789',
        pullNumber: 42,
        headSha: 'b'.repeat(40),
        workerId: 'n8n-workflow-1',
      })
      .expect(200);

    const failed = await request(app.getHttpServer())
      .post(
        `/api/v1/orchestration/review-cycles/${claimed.body.reviewCycle.id}/fail`,
      )
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        workerId: 'n8n-workflow-1',
        reason: 'GITHUB_RATE_LIMIT',
        retryable: true,
      })
      .expect(200);

    expect(failed.body.status).toBe('FAILED');
  });
});
