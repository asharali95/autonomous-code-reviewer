import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { App } from 'octokit';
import type { AppEnv } from '../config/env';
import { CompareUnavailableError } from './github.errors';
import type {
  CompareFile,
  CompareResult,
  GitHubAppPort,
  PullRequestMetadata,
} from './github-app.interface';
import { mapGitHubFile, type GitHubFilePayload } from './github-mapper';

interface PullResponse {
  data: {
    id: number;
    number: number;
    title: string;
    state: string;
    base: {
      sha: string;
      repo: { id: number; name: string; owner: { login: string } };
    };
    head: { sha: string };
  };
}

interface ContentResponse {
  data: { type?: string; content?: string } | Array<unknown>;
}

interface InstallationClient {
  rest: {
    pulls: {
      get: (params: {
        owner: string;
        repo: string;
        pull_number: number;
      }) => Promise<PullResponse>;
      listFiles: (params: Record<string, unknown>) => Promise<unknown>;
    };
    repos: {
      compareCommitsWithBasehead: (
        params: Record<string, unknown>,
      ) => Promise<unknown>;
      getContent: (params: {
        owner: string;
        repo: string;
        path: string;
        ref: string;
      }) => Promise<ContentResponse>;
    };
    apps: {
      getRepoInstallation: (params: {
        owner: string;
        repo: string;
      }) => Promise<{ data: { id: number } }>;
    };
  };
  paginate: {
    (
      endpoint: unknown,
      params: Record<string, unknown>,
    ): Promise<GitHubFilePayload[]>;
    iterator: (
      endpoint: unknown,
      params: Record<string, unknown>,
    ) => AsyncIterable<{ data: unknown }>;
  };
}

@Injectable()
export class GitHubAppService implements GitHubAppPort {
  private readonly logger = new Logger(GitHubAppService.name);
  private app: App | undefined;

  constructor(private readonly config: ConfigService<AppEnv, true>) {}

  async getPullRequest(
    owner: string,
    repo: string,
    number: number,
  ): Promise<PullRequestMetadata> {
    const octokit = await this.octokitFor(owner, repo);
    const { data } = await this.withRetry(() =>
      octokit.rest.pulls.get({ owner, repo, pull_number: number }),
    );
    return {
      githubRepoId: BigInt(data.base.repo.id),
      githubPullId: BigInt(data.id),
      number: data.number,
      title: data.title,
      state: data.state === 'open' ? 'open' : 'closed',
      owner: data.base.repo.owner.login,
      repo: data.base.repo.name,
      baseSha: data.base.sha,
      headSha: data.head.sha,
    };
  }

  async compare(
    owner: string,
    repo: string,
    base: string,
    head: string,
  ): Promise<CompareResult> {
    const octokit = await this.octokitFor(owner, repo);
    try {
      const collected: CompareFile[] = [];
      let truncated = false;
      let mergeBaseCommitSha: string | null = null;

      for await (const page of octokit.paginate.iterator(
        octokit.rest.repos.compareCommitsWithBasehead,
        { owner, repo, basehead: `${base}...${head}`, per_page: 100 },
      )) {
        const data = page.data as {
          files?: GitHubFilePayload[];
          truncated?: boolean;
          merge_base_commit?: { sha?: string };
        };
        mergeBaseCommitSha = data.merge_base_commit?.sha ?? mergeBaseCommitSha;
        truncated = truncated || Boolean(data.truncated);
        for (const file of data.files ?? []) {
          collected.push(mapGitHubFile(file));
        }
      }

      if (!mergeBaseCommitSha) {
        throw new CompareUnavailableError('MISSING_MERGE_BASE');
      }

      return { files: collected, truncated, mergeBaseCommitSha };
    } catch (error) {
      if (error instanceof CompareUnavailableError) {
        throw error;
      }
      throw this.toCompareError(error);
    }
  }

  async listPullFiles(
    owner: string,
    repo: string,
    number: number,
  ): Promise<CompareFile[]> {
    const octokit = await this.octokitFor(owner, repo);
    const files = await this.withRetry(() =>
      octokit.paginate(octokit.rest.pulls.listFiles, {
        owner,
        repo,
        pull_number: number,
        per_page: 100,
      }),
    );
    return files.map((file) => mapGitHubFile(file));
  }

  async getFileContents(
    owner: string,
    repo: string,
    path: string,
    ref: string,
  ): Promise<string | null> {
    const octokit = await this.octokitFor(owner, repo);
    try {
      const { data } = await this.withRetry(() =>
        octokit.rest.repos.getContent({ owner, repo, path, ref }),
      );
      if (Array.isArray(data) || data.type !== 'file' || !data.content) {
        return null;
      }
      return Buffer.from(data.content, 'base64').toString('utf8');
    } catch (error) {
      if (statusOf(error) === 404) {
        return null;
      }
      throw error;
    }
  }

  private getApp(): App {
    if (!this.app) {
      this.app = new App({
        appId: this.config.get('GITHUB_APP_ID', { infer: true }),
        privateKey: this.loadPrivateKey(),
      });
    }
    return this.app;
  }

  private async octokitFor(
    owner: string,
    repo: string,
  ): Promise<InstallationClient> {
    const configured = this.config.get('GITHUB_INSTALLATION_ID', {
      infer: true,
    });
    if (configured) {
      return (await this.getApp().getInstallationOctokit(
        Number(configured),
      )) as unknown as InstallationClient;
    }
    const appOctokit = this.getApp().octokit as unknown as InstallationClient;
    const installation = await appOctokit.rest.apps.getRepoInstallation({
      owner,
      repo,
    });
    return (await this.getApp().getInstallationOctokit(
      installation.data.id,
    )) as unknown as InstallationClient;
  }

  private loadPrivateKey(): string {
    const path = this.config.get('GITHUB_APP_PRIVATE_KEY_PATH', { infer: true });
    if (path) {
      return readFileSync(path, 'utf8');
    }
    const pem = this.config.get('GITHUB_APP_PRIVATE_KEY', { infer: true });
    return pem.replace(/\\n/g, '\n');
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    const max = this.config.get('GITHUB_API_MAX_RETRIES', { infer: true });
    let lastError: unknown;
    for (let attempt = 0; attempt <= max; attempt += 1) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const status = statusOf(error);
        if (status && status < 500 && status !== 429) {
          throw error;
        }
        if (attempt === max) {
          break;
        }
        const retryAfter = retryAfterMs(error);
        const backoff = Math.min(1000 * 2 ** attempt, 8000);
        this.logger.warn(
          `Retrying GitHub API call attempt=${attempt} status=${status ?? 'unknown'}`,
        );
        await sleep(retryAfter ?? backoff);
      }
    }
    throw lastError;
  }

  private toCompareError(error: unknown): Error {
    const status = statusOf(error);
    if (status === 422) {
      return new CompareUnavailableError('FORCE_PUSH');
    }
    if (status === 404) {
      return new CompareUnavailableError('COMPARE_UNREACHABLE');
    }
    return error instanceof Error ? error : new Error('GitHub compare failed');
  }
}

function statusOf(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    return Number((error as { status: number }).status);
  }
  return undefined;
}

function retryAfterMs(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return undefined;
  }
  const headers = (error as { response?: { headers?: Record<string, string> } })
    .response?.headers;
  const value = headers?.['retry-after'];
  if (!value) {
    return undefined;
  }
  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds * 1000 : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
