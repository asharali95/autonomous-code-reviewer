import { Module } from '@nestjs/common';
import { PullRequestsModule } from '../pull-requests/pull-requests.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { ReviewCyclesModule } from '../review-cycles/review-cycles.module';
import { GitHubSignatureGuard } from './github-signature.guard';
import { PullRequestWebhookHandler } from './pull-request-webhook.handler';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [RepositoriesModule, PullRequestsModule, ReviewCyclesModule],
  controllers: [WebhooksController],
  providers: [PullRequestWebhookHandler, GitHubSignatureGuard],
})
export class WebhooksModule {}
