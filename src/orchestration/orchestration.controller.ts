import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { N8nBearerGuard } from '../common/guards/n8n-bearer.guard';
import { DiffBuilderService } from '../diffs/diff-builder.service';
import { ReviewCyclesService } from '../review-cycles/review-cycles.service';
import { ClaimReviewCycleDto } from './dto/claim-review-cycle.dto';
import { CompleteReviewCycleDto } from './dto/complete-review-cycle.dto';
import { FailReviewCycleDto } from './dto/fail-review-cycle.dto';

@Controller('api/v1/orchestration')
@UseGuards(N8nBearerGuard)
export class OrchestrationController {
  constructor(
    private readonly reviewCycles: ReviewCyclesService,
    private readonly diffs: DiffBuilderService,
  ) {}

  @Get('repositories/:githubRepoId/pulls/:number')
  async getPrState(
    @Param('githubRepoId') githubRepoId: string,
    @Param('number') number: string,
  ) {
    const state = await this.reviewCycles.getPrState(
      BigInt(githubRepoId),
      Number(number),
    );
    return {
      repository: {
        githubRepoId: state.repository.githubRepoId.toString(),
        fullName: state.repository.fullName,
      },
      pullRequest: {
        id: state.pullRequest.id,
        number: state.pullRequest.number,
        state: state.pullRequest.state.toLowerCase(),
        baseSha: state.pullRequest.baseSha,
        headSha: state.pullRequest.headSha,
        lastReviewedSha: state.pullRequest.lastReviewedSha,
        lastReviewedAt: state.pullRequest.lastReviewedAt,
      },
      activeCycle: state.activeCycle
        ? {
            id: state.activeCycle.id,
            headSha: state.activeCycle.headSha,
            status: state.activeCycle.status,
            diffBaseSha: state.activeCycle.diffBaseSha,
            diffHeadSha: state.activeCycle.diffHeadSha,
            diffFallbackReason: state.activeCycle.diffFallbackReason,
          }
        : null,
    };
  }

  @Post('review-cycles/claim')
  @HttpCode(HttpStatus.OK)
  async claim(@Body() body: ClaimReviewCycleDto) {
    const result = await this.reviewCycles.claim({
      githubRepoId: BigInt(body.githubRepoId),
      pullNumber: body.pullNumber,
      headSha: body.headSha,
      workerId: body.workerId,
    });
    return {
      reviewCycle: {
        id: result.reviewCycle.id,
        status: result.reviewCycle.status,
        diffBaseSha: result.reviewCycle.diffBaseSha,
        diffHeadSha: result.reviewCycle.diffHeadSha,
        diffFallbackReason: result.reviewCycle.diffFallbackReason,
        claimedBy: result.reviewCycle.claimedBy,
      },
      created: result.created,
    };
  }

  @Get('review-cycles/:reviewCycleId/diff-manifest')
  getDiffManifest(
    @Param('reviewCycleId') reviewCycleId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.diffs.buildManifest(reviewCycleId, cursor);
  }

  @Post('review-cycles/:reviewCycleId/complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @Param('reviewCycleId') reviewCycleId: string,
    @Body() _body: CompleteReviewCycleDto,
  ) {
    return this.reviewCycles.complete(reviewCycleId);
  }

  @Post('review-cycles/:reviewCycleId/fail')
  @HttpCode(HttpStatus.OK)
  fail(
    @Param('reviewCycleId') reviewCycleId: string,
    @Body() body: FailReviewCycleDto,
  ) {
    return this.reviewCycles.fail(reviewCycleId, body.reason);
  }
}
