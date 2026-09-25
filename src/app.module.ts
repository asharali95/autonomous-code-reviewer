import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './common/prisma/prisma.module';
import { validateEnv } from './config/env';
import { DiffsModule } from './diffs/diffs.module';
import { GitHubModule } from './github/github.module';
import { HealthModule } from './health/health.module';
import { OrchestrationModule } from './orchestration/orchestration.module';
import { OutboxModule } from './outbox/outbox.module';
import { PullRequestsModule } from './pull-requests/pull-requests.module';
import { RepositoriesModule } from './repositories/repositories.module';
import { ReviewCyclesModule } from './review-cycles/review-cycles.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level:
          process.env.LOG_LEVEL ??
          (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
        autoLogging: process.env.NODE_ENV !== 'test',
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers["x-hub-signature-256"]',
            'req.headers["x-github-token"]',
          ],
          remove: true,
        },
      },
    }),
    PrismaModule,
    GitHubModule,
    RepositoriesModule,
    PullRequestsModule,
    ReviewCyclesModule,
    DiffsModule,
    OutboxModule,
    WebhooksModule,
    OrchestrationModule,
    HealthModule,
  ],
})
export class AppModule {}
