import { Module } from '@nestjs/common';
import { GitHubModule } from '../github/github.module';
import { PullRequestsModule } from '../pull-requests/pull-requests.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { ReviewCycleRepository } from './review-cycle.repository';
import { ReviewCyclesService } from './review-cycles.service';

@Module({
  imports: [GitHubModule, PullRequestsModule, RepositoriesModule],
  providers: [ReviewCycleRepository, ReviewCyclesService],
  exports: [ReviewCycleRepository, ReviewCyclesService],
})
export class ReviewCyclesModule {}
