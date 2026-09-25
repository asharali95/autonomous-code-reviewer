import { Module } from '@nestjs/common';
import { DiffsModule } from '../diffs/diffs.module';
import { ReviewCyclesModule } from '../review-cycles/review-cycles.module';
import { AI_REVIEWER_PORT } from './ai-reviewer.interface';
import { CursorAiReviewerService } from './cursor-ai-reviewer.service';
import { FindingsService } from './findings.service';
import { ReviewService } from './review.service';

@Module({
  imports: [DiffsModule, ReviewCyclesModule],
  providers: [
    FindingsService,
    ReviewService,
    { provide: AI_REVIEWER_PORT, useClass: CursorAiReviewerService },
  ],
  exports: [ReviewService, FindingsService, AI_REVIEWER_PORT],
})
export class ReviewModule {}
