import { Module } from '@nestjs/common';
import { GITHUB_APP_PORT } from './github-app.interface';
import { GitHubAppService } from './github-app.service';

@Module({
  providers: [{ provide: GITHUB_APP_PORT, useClass: GitHubAppService }],
  exports: [GITHUB_APP_PORT],
})
export class GitHubModule {}
