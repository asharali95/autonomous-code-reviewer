import { createHmac } from 'crypto';

export const WEBHOOK_SECRET = 'test-webhook-secret';

export function signBody(body: string): string {
  return `sha256=${createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')}`;
}

export function pullRequestPayload(overrides?: {
  action?: string;
  number?: number;
  headSha?: string;
  baseSha?: string;
  repoId?: number;
}) {
  return {
    action: overrides?.action ?? 'opened',
    pull_request: {
      id: 99,
      number: overrides?.number ?? 42,
      title: 'Add feature',
      state: 'open',
      base: { sha: overrides?.baseSha ?? 'a'.repeat(40) },
      head: { sha: overrides?.headSha ?? 'b'.repeat(40) },
    },
    repository: {
      id: overrides?.repoId ?? 123456789,
      name: 'repo',
      full_name: 'org/repo',
      owner: { login: 'org' },
    },
  };
}
