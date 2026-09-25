import { mapGitHubFile } from '../../src/github/github-mapper';

describe('mapGitHubFile', () => {
  it('marks missing patches with line changes as too large', () => {
    const file = mapGitHubFile({
      filename: 'src/big.ts',
      status: 'modified',
      additions: 400,
      deletions: 20,
    });
    expect(file.patchAvailable ?? file.patch).toBeNull();
    expect(file.tooLarge).toBe(true);
    expect(file.binary).toBe(false);
  });

  it('marks files without a patch and no line changes as binary', () => {
    const file = mapGitHubFile({
      filename: 'assets/logo.png',
      status: 'added',
      additions: 0,
      deletions: 0,
    });
    expect(file.binary).toBe(true);
    expect(file.tooLarge).toBe(false);
  });

  it('preserves rename metadata', () => {
    const file = mapGitHubFile({
      filename: 'src/new.ts',
      previous_filename: 'src/old.ts',
      status: 'renamed',
      additions: 1,
      deletions: 1,
      patch: '@@ -1 +1 @@',
    });
    expect(file.status).toBe('renamed');
    expect(file.previousPath).toBe('src/old.ts');
  });

  it('maps deleted files', () => {
    const file = mapGitHubFile({
      filename: 'gone.ts',
      status: 'removed',
      additions: 0,
      deletions: 4,
      patch: '@@ -1,4 +0,0 @@',
    });
    expect(file.status).toBe('removed');
  });
});
