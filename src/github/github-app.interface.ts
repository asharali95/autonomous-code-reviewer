import type { CompareUnavailableReason } from './github.errors';

export const GITHUB_APP_PORT = 'GITHUB_APP_PORT';

export type DiffFileStatus =
  | 'added'
  | 'modified'
  | 'removed'
  | 'renamed'
  | 'copied'
  | 'changed'
  | 'unchanged';

export interface PullRequestMetadata {
  githubRepoId: bigint;
  githubPullId: bigint;
  number: number;
  title: string;
  state: 'open' | 'closed';
  owner: string;
  repo: string;
  baseSha: string;
  headSha: string;
}

export interface CompareFile {
  path: string;
  previousPath: string | null;
  status: DiffFileStatus;
  additions: number;
  deletions: number;
  patch: string | null;
  binary: boolean;
  tooLarge: boolean;
}

export interface CompareResult {
  files: CompareFile[];
  truncated: boolean;
  mergeBaseCommitSha: string | null;
}

export interface GitHubAppPort {
  getPullRequest(
    owner: string,
    repo: string,
    number: number,
  ): Promise<PullRequestMetadata>;
  compare(
    owner: string,
    repo: string,
    base: string,
    head: string,
  ): Promise<CompareResult>;
  listPullFiles(
    owner: string,
    repo: string,
    number: number,
  ): Promise<CompareFile[]>;
  getFileContents(
    owner: string,
    repo: string,
    path: string,
    ref: string,
  ): Promise<string | null>;
}

export type { CompareUnavailableReason };
