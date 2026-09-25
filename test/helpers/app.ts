import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { GITHUB_APP_PORT, type GitHubAppPort } from '../../src/github/github-app.interface';
import { createMemoryPrisma } from './memory-prisma';

export async function createTestApp(github: GitHubAppPort): Promise<{
  app: INestApplication;
  memory: ReturnType<typeof createMemoryPrisma>;
}> {
  const memory = createMemoryPrisma();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(memory.prisma)
    .overrideProvider(GITHUB_APP_PORT)
    .useValue(github)
    .compile();

  const app = moduleRef.createNestApplication({ rawBody: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();
  return { app, memory };
}

export function createGitHubMock(
  overrides: Partial<GitHubAppPort> = {},
): GitHubAppPort {
  return {
    getPullRequest: async () => ({
      githubRepoId: 123456789n,
      githubPullId: 99n,
      number: 42,
      title: 'Add feature',
      state: 'open',
      owner: 'org',
      repo: 'repo',
      baseSha: 'a'.repeat(40),
      headSha: 'b'.repeat(40),
    }),
    compare: async () => ({
      files: [],
      truncated: false,
      mergeBaseCommitSha: 'a'.repeat(40),
    }),
    listPullFiles: async () => [],
    getFileContents: async () => null,
    ...overrides,
  };
}
