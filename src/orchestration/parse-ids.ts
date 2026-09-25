import { BadRequestException } from '@nestjs/common';

const GITHUB_REPO_ID_PATTERN = /^\d{1,20}$/;

export function parseGithubRepoId(value: string): bigint {
  if (!GITHUB_REPO_ID_PATTERN.test(value)) {
    throw new BadRequestException(
      'githubRepoId must be the numeric GitHub repository id (not the internal UUID). Example: 1387749206',
    );
  }
  return BigInt(value);
}

export function parsePullNumber(value: string | number): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new BadRequestException('pull number must be a positive integer');
  }
  return number;
}
