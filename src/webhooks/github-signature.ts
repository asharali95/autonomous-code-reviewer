import { createHmac, timingSafeEqual } from 'crypto';

export function verifyGitHubSignature(
  secret: string,
  rawBody: Buffer,
  signatureHeader: string | undefined,
): boolean {
  if (!signatureHeader?.startsWith('sha256=')) {
    return false;
  }
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const left = Buffer.from(expected);
  const right = Buffer.from(signatureHeader);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}
