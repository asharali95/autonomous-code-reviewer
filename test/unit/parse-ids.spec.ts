import { parseGithubRepoId, parsePullNumber } from '../../src/orchestration/parse-ids';

describe('parseGithubRepoId', () => {
  it('accepts numeric GitHub repository ids', () => {
    expect(parseGithubRepoId('1387749206')).toBe(1387749206n);
  });

  it('rejects internal UUIDs with a clear 400', () => {
    expect(() =>
      parseGithubRepoId('6e2e4df5-4050-4a4e-bb90-9d80cdd37330'),
    ).toThrow(/numeric GitHub repository id/);
  });
});

describe('parsePullNumber', () => {
  it('accepts positive integers', () => {
    expect(parsePullNumber('1')).toBe(1);
  });

  it('rejects invalid values', () => {
    expect(() => parsePullNumber('0')).toThrow(/positive integer/);
  });
});
