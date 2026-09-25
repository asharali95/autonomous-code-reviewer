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
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { N8nBearerGuard } from '../common/guards/n8n-bearer.guard';
import { DiffBuilderService } from '../diffs/diff-builder.service';
import { ReviewCyclesService } from '../review-cycles/review-cycles.service';
import { ReviewService } from '../review/review.service';
import { ClaimReviewCycleDto } from './dto/claim-review-cycle.dto';
import { CompleteReviewCycleDto } from './dto/complete-review-cycle.dto';
import { FailReviewCycleDto } from './dto/fail-review-cycle.dto';
import {
  ClaimReviewCycleResponseDto,
  CompleteCycleResponseDto,
  DiffManifestResponseDto,
  FailCycleResponseDto,
  PrStateResponseDto,
  RunAiReviewResponseDto,
} from './dto/swagger-responses.dto';
import { parseGithubRepoId, parsePullNumber } from './parse-ids';

@ApiTags('orchestration')
@ApiBearerAuth('n8n-bearer')
@ApiUnauthorizedResponse({ description: 'Missing or invalid N8N_API_TOKEN' })
@Controller('api/v1/orchestration')
@UseGuards(N8nBearerGuard)
export class OrchestrationController {
  constructor(
    private readonly reviewCycles: ReviewCyclesService,
    private readonly diffs: DiffBuilderService,
    private readonly review: ReviewService,
  ) {}

  @Get('repositories/:githubRepoId/pulls/:number')
  @ApiOperation({
    summary: 'Get PR state',
    description:
      'Returns persisted repository/PR metadata and the active review cycle for the current head SHA (if any). `githubRepoId` is GitHub\'s numeric repository id (e.g. 1387749206), not the internal database UUID.',
  })
  @ApiParam({
    name: 'githubRepoId',
    example: '1387749206',
    description: 'Numeric GitHub repository id',
  })
  @ApiParam({ name: 'number', example: '1' })
  @ApiOkResponse({ type: PrStateResponseDto })
  @ApiBadRequestResponse({
    description: 'githubRepoId is not a numeric GitHub repository id',
  })
  async getPrState(
    @Param('githubRepoId') githubRepoId: string,
    @Param('number') number: string,
  ) {
    const state = await this.reviewCycles.getPrState(
      parseGithubRepoId(githubRepoId),
      parsePullNumber(number),
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
  @ApiOperation({
    summary: 'Claim or start a review cycle',
    description:
      'Refreshes PR metadata from GitHub, ensures one cycle per (PR, headSha), then atomically moves PENDING/FAILED → IN_PROGRESS.',
  })
  @ApiOkResponse({ type: ClaimReviewCycleResponseDto })
  async claim(@Body() body: ClaimReviewCycleDto) {
    const result = await this.reviewCycles.claim({
      githubRepoId: parseGithubRepoId(body.githubRepoId),
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
  @ApiOperation({
    summary: 'Get prepared diff manifest',
    description:
      'Builds an incremental file list for the cycle range (with force-push fallback). Supports cursor pagination.',
  })
  @ApiParam({
    name: 'reviewCycleId',
    format: 'uuid',
    example: '42531d89-bfb7-48ca-bab5-cedb666785e2',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Offset cursor from a previous pageInfo.nextCursor',
  })
  @ApiOkResponse({ type: DiffManifestResponseDto })
  getDiffManifest(
    @Param('reviewCycleId') reviewCycleId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.diffs.buildManifest(reviewCycleId, cursor);
  }

  @Post('review-cycles/:reviewCycleId/review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Run Cursor AI review for an IN_PROGRESS cycle',
    description:
      'Loads the prepared diff manifest, calls Cursor Agent (text-only) with patch excerpts, persists Finding rows, and returns a summary. Does not complete the cycle — call /complete afterward. Slack is out of scope.',
  })
  @ApiParam({ name: 'reviewCycleId', format: 'uuid' })
  @ApiOkResponse({ type: RunAiReviewResponseDto })
  runAiReview(@Param('reviewCycleId') reviewCycleId: string) {
    return this.review.runReview(reviewCycleId);
  }

  @Post('review-cycles/:reviewCycleId/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete a review cycle',
    description:
      'Marks IN_PROGRESS → COMPLETED, advances lastReviewedSha only when PR head still matches the cycle head, and writes an outbox event.',
  })
  @ApiParam({ name: 'reviewCycleId', format: 'uuid' })
  @ApiOkResponse({ type: CompleteCycleResponseDto })
  complete(
    @Param('reviewCycleId') reviewCycleId: string,
    @Body() _body: CompleteReviewCycleDto,
  ) {
    return this.reviewCycles.complete(reviewCycleId);
  }

  @Post('review-cycles/:reviewCycleId/fail')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark a review cycle failed',
    description:
      'Marks IN_PROGRESS → FAILED without advancing lastReviewedSha. The same cycle can be reclaimed later.',
  })
  @ApiParam({ name: 'reviewCycleId', format: 'uuid' })
  @ApiOkResponse({ type: FailCycleResponseDto })
  fail(
    @Param('reviewCycleId') reviewCycleId: string,
    @Body() body: FailReviewCycleDto,
  ) {
    return this.reviewCycles.fail(reviewCycleId, body.reason);
  }
}
