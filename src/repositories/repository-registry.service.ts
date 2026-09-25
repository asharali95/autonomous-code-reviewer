import { Injectable } from '@nestjs/common';
import type { GitHubRepository } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class RepositoryRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  upsert(input: {
    githubRepoId: bigint;
    owner: string;
    name: string;
    fullName: string;
  }): Promise<GitHubRepository> {
    return this.prisma.gitHubRepository.upsert({
      where: { githubRepoId: input.githubRepoId },
      create: {
        githubRepoId: input.githubRepoId,
        owner: input.owner,
        name: input.name,
        fullName: input.fullName,
        webhookEnabledAt: new Date(),
      },
      update: {
        owner: input.owner,
        name: input.name,
        fullName: input.fullName,
      },
    });
  }

  findByGithubRepoId(githubRepoId: bigint): Promise<GitHubRepository | null> {
    return this.prisma.gitHubRepository.findUnique({
      where: { githubRepoId },
    });
  }
}
