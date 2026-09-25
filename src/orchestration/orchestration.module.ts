import { Module } from '@nestjs/common';
import { DiffsModule } from '../diffs/diffs.module';
import { ReviewCyclesModule } from '../review-cycles/review-cycles.module';
import { OrchestrationController } from './orchestration.controller';

@Module({
  imports: [ReviewCyclesModule, DiffsModule],
  controllers: [OrchestrationController],
})
export class OrchestrationModule {}
