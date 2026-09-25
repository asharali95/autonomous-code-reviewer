export type CompareUnavailableReason =
  | 'FORCE_PUSH'
  | 'COMPARE_UNREACHABLE'
  | 'MISSING_MERGE_BASE';

export class CompareUnavailableError extends Error {
  constructor(public readonly reason: CompareUnavailableReason) {
    super(reason);
    this.name = 'CompareUnavailableError';
  }
}
