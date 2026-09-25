import {
  extractJsonPayload,
  fingerprintFinding,
} from '../../src/review/ai-reviewer.interface';

describe('AI review helpers', () => {
  it('extracts JSON from a fenced response', () => {
    const payload = extractJsonPayload(
      'Here you go:\n```json\n{"summary":"ok","findings":[]}\n```\n',
    );
    expect(payload).toEqual({ summary: 'ok', findings: [] });
  });

  it('builds a stable finding fingerprint', () => {
    const a = fingerprintFinding({
      path: 'src/a.ts',
      line: 10,
      severity: 'HIGH',
      message: 'Null check missing',
    });
    const b = fingerprintFinding({
      path: 'src/a.ts',
      line: 10,
      severity: 'HIGH',
      message: 'Null check missing',
    });
    expect(a).toBe(b);
    expect(a).toHaveLength(32);
  });
});
