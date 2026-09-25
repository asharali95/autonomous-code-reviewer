import type { CompareFile, DiffFileStatus } from './github-app.interface';

export interface GitHubFilePayload {
  filename: string;
  previous_filename?: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export function mapGitHubFile(file: GitHubFilePayload): CompareFile {
  const patch = file.patch ?? null;
  const lineChanges = file.additions + file.deletions;
  const binary =
    patch === null && lineChanges === 0 && file.status !== 'removed';
  const tooLarge = patch === null && lineChanges > 0;
  return {
    path: file.filename,
    previousPath: file.previous_filename ?? null,
    status: normalizeStatus(file.status),
    additions: file.additions,
    deletions: file.deletions,
    patch,
    binary,
    tooLarge,
  };
}

function normalizeStatus(status: string): DiffFileStatus {
  switch (status) {
    case 'added':
    case 'modified':
    case 'removed':
    case 'renamed':
    case 'copied':
    case 'changed':
    case 'unchanged':
      return status;
    default:
      return 'modified';
  }
}
