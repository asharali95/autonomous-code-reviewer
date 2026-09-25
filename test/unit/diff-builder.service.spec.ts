import { ConfigService } from '@nestjs/config';
import { DiffFallbackReason, ReviewCycleStatus } from '@prisma/client';
import { AiReviewConfigService } from '../../src/diffs/ai-review-config.service';
import { DiffBuilderService } from '../../src/diffs/diff-builder.service';
import { CompareUnavailableError } from '../../src/github/github.errors';
import type { CompareFile, GitHubAppPort } from '../../src/github/github-app.interface';
import { ReviewCycleRepository } from '../../src/review-cycles/review-cycle.repository';

const filesPage: CompareFile[] = [
  {
    path: 'src/a.ts',
    previousPath: null,
    status: 'modified',
    additions: 1,
    deletions: 0,
    patch: '@@ a',
    binary: false,
    tooLarge: false,
  },
  {
    path: 'src/b.ts',
    previousPath: null,
    status: 'modified',
    additions: 1,
    deletions: 0,
    patch: '@@ b',
    binary: false,
    tooLarge: false,
  },
  {
    path: 'src/c.ts',
    previousPath: null,
    status: 'modified',
    additions: 1,
    deletions: 0,
    patch: '@@ c',
    binary: false,
    tooLarge: false,
  },
  {
    path: 'node_modules/pkg/index.js',
    previousPath: null,
    status: 'modified',
    additions: 1,
    deletions: 0,
    patch: '@@ skip',
    binary: false,
    tooLarge: false,
  },
];

function cycleRecord(fallback: DiffFallbackReason | null = null) {
  return {
    id: 'cycle-1',
    pullRequestId: 'pr-1',
    headSha: 'b'.repeat(40),
    status: ReviewCycleStatus.IN_PROGRESS,
    diffBaseSha: 'c'.repeat(40),
    diffHeadSha: 'b'.repeat(40),
    diffFallbackReason: fallback,
    failureReason: null,
    claimedAt: null,
    claimedBy: null,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    pullRequest: {
      id: 'pr-1',
      number: 42,
      baseSha: 'a'.repeat(40),
      headSha: 'b'.repeat(40),
      repository: {
        owner: 'org',
        name: 'repo',
      },
    },
  };
}

describe('DiffBuilderService', () => {
  const github: GitHubAppPort = {
    getPullRequest: jest.fn(),
    compare: jest.fn(),
    listPullFiles: jest.fn(),
    getFileContents: jest.fn().mockResolvedValue(null),
  };
  const cycles = {
    findByIdWithPullRequest: jest.fn(),
    setFallbackReason: jest.fn(),
  };
  const config = {
    get: (key: string) => (key === 'MAX_PATCH_BYTES' ? 1000 : 2),
  };

  const service = new DiffBuilderService(
    cycles as unknown as ReviewCycleRepository,
    new AiReviewConfigService(github),
    github,
    config as unknown as ConfigService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    (github.getFileContents as jest.Mock).mockResolvedValue(null);
  });

  it('paginates the prepared manifest and omits ignored paths', async () => {
    cycles.findByIdWithPullRequest.mockResolvedValue(cycleRecord());
    (github.compare as jest.Mock).mockResolvedValue({
      files: filesPage,
      truncated: true,
      mergeBaseCommitSha: 'c'.repeat(40),
    });

    const first = await service.buildManifest('cycle-1');
    expect(first.files.map((file) => file.path)).toEqual(['src/a.ts', 'src/b.ts']);
    expect(first.pageInfo.nextCursor).toBe('2');
    expect(first.truncated).toBe(true);

    const second = await service.buildManifest('cycle-1', '2');
    expect(second.files.map((file) => file.path)).toEqual(['src/c.ts']);
    expect(second.pageInfo.nextCursor).toBeNull();
  });

  it('falls back to the PR base when the previous SHA cannot be compared', async () => {
    cycles.findByIdWithPullRequest.mockResolvedValue(cycleRecord());
    (github.compare as jest.Mock)
      .mockRejectedValueOnce(new CompareUnavailableError('FORCE_PUSH'))
      .mockResolvedValueOnce({
        files: [filesPage[0]],
        truncated: false,
        mergeBaseCommitSha: 'a'.repeat(40),
      });

    const manifest = await service.buildManifest('cycle-1');
    expect(cycles.setFallbackReason).toHaveBeenCalledWith(
      'cycle-1',
      'FORCE_PUSH',
    );
    expect(manifest.range.fallbackReason).toBe('FORCE_PUSH');
    expect(manifest.range.baseSha).toBe('a'.repeat(40));
  });

  it('omits oversized patches from the manifest', async () => {
    cycles.findByIdWithPullRequest.mockResolvedValue(cycleRecord());
    (github.compare as jest.Mock).mockResolvedValue({
      files: [
        {
          path: 'src/huge.ts',
          previousPath: null,
          status: 'modified',
          additions: 10,
          deletions: 1,
          patch: 'x'.repeat(2000),
          binary: false,
          tooLarge: false,
        },
      ],
      truncated: false,
      mergeBaseCommitSha: 'c'.repeat(40),
    });

    const manifest = await service.buildManifest('cycle-1');
    expect(manifest.files[0].patchAvailable).toBe(false);
    expect(manifest.files[0].tooLarge).toBe(true);
    expect(manifest.files[0].patch).toBeNull();
  });
});
