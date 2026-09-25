import { AiReviewConfigService } from '../../src/diffs/ai-review-config.service';
import { DEFAULT_IGNORE_GLOBS } from '../../src/diffs/ai-review-config.schema';
import type { GitHubAppPort } from '../../src/github/github-app.interface';

describe('AiReviewConfigService', () => {
  const github: GitHubAppPort = {
    getPullRequest: jest.fn(),
    compare: jest.fn(),
    listPullFiles: jest.fn(),
    getFileContents: jest.fn(),
  };
  const service = new AiReviewConfigService(github);

  it('uses default ignore rules when the file is missing', async () => {
    (github.getFileContents as jest.Mock).mockResolvedValueOnce(null);
    const loaded = await service.load('org', 'repo', 'abc');
    expect(loaded.source).toBe('defaults');
    expect(loaded.valid).toBe(true);
    expect(loaded.ignoreGlobs).toEqual(expect.arrayContaining(DEFAULT_IGNORE_GLOBS));
  });

  it('rejects invalid YAML and falls back to defaults', () => {
    const loaded = service.parse('ignore: [');
    expect(loaded.valid).toBe(false);
    expect(loaded.warnings[0]).toMatch(/Invalid YAML/);
    expect(loaded.ignoreGlobs).toEqual(expect.arrayContaining(DEFAULT_IGNORE_GLOBS));
  });

  it('rejects an invalid schema and falls back to defaults', () => {
    const loaded = service.parse('ignore: 12');
    expect(loaded.valid).toBe(false);
    expect(loaded.warnings[0]).toMatch(/schema/);
  });

  it('classifies risk with first matching glob', () => {
    const rules = [
      { glob: 'src/auth/**', risk: 'high' as const },
      { glob: 'src/**', risk: 'medium' as const },
    ];
    expect(service.classifyRisk('src/auth/login.ts', rules)).toBe('high');
    expect(service.classifyRisk('src/app.ts', rules)).toBe('medium');
    expect(service.classifyRisk('docs/readme.md', rules)).toBe('medium');
  });
});
