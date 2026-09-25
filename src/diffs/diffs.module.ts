import { Module } from '@nestjs/common';
import { GitHubModule } from '../github/github.module';
import { ReviewCyclesModule } from '../review-cycles/review-cycles.module';
import { AiReviewConfigService } from './ai-review-config.service';
import { DiffBuilderService } from './diff-builder.service';

@Module({
  imports: [GitHubModule, ReviewCyclesModule],
  providers: [AiReviewConfigService, DiffBuilderService],
  exports: [AiReviewConfigService, DiffBuilderService],
})
export class DiffsModule {}
