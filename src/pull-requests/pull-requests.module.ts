import { Module } from '@nestjs/common';
import { PullRequestsService } from './pull-requests.service';

@Module({
  providers: [PullRequestsService],
  exports: [PullRequestsService],
})
export class PullRequestsModule {}
