import { verifyGitHubSignature } from '../../src/webhooks/github-signature';
import { signBody, WEBHOOK_SECRET } from '../helpers/webhook';

describe('verifyGitHubSignature', () => {
  it('accepts a valid sha256 signature over the raw body', () => {
    const raw = Buffer.from('{"action":"opened"}');
    expect(
      verifyGitHubSignature(WEBHOOK_SECRET, raw, signBody(raw.toString())),
    ).toBe(true);
  });

  it('rejects an invalid signature', () => {
    expect(
      verifyGitHubSignature(
        WEBHOOK_SECRET,
        Buffer.from('{"action":"opened"}'),
        'sha256=deadbeef',
      ),
    ).toBe(false);
  });

  it('rejects a missing or malformed header', () => {
    const raw = Buffer.from('{}');
    expect(verifyGitHubSignature(WEBHOOK_SECRET, raw, undefined)).toBe(false);
    expect(verifyGitHubSignature(WEBHOOK_SECRET, raw, 'md5=abc')).toBe(false);
  });
});
