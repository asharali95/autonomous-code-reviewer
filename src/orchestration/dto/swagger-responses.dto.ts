import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RepositorySummaryDto {
  @ApiProperty({ example: '1387749206' })
  githubRepoId!: string;

  @ApiProperty({ example: 'org/repo' })
  fullName!: string;
}

export class PullRequestStateDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 42 })
  number!: number;

  @ApiProperty({ example: 'open', enum: ['open', 'closed'] })
  state!: string;

  @ApiProperty()
  baseSha!: string;

  @ApiProperty()
  headSha!: string;

  @ApiPropertyOptional({ nullable: true })
  lastReviewedSha!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  lastReviewedAt!: string | null;
}

export class ActiveCycleDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  headSha!: string;

  @ApiProperty({
    enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'],
  })
  status!: string;

  @ApiProperty()
  diffBaseSha!: string;

  @ApiProperty()
  diffHeadSha!: string;

  @ApiPropertyOptional({
    nullable: true,
    enum: ['FORCE_PUSH', 'COMPARE_UNREACHABLE', 'MISSING_MERGE_BASE'],
  })
  diffFallbackReason!: string | null;
}

export class PrStateResponseDto {
  @ApiProperty({ type: RepositorySummaryDto })
  repository!: RepositorySummaryDto;

  @ApiProperty({ type: PullRequestStateDto })
  pullRequest!: PullRequestStateDto;

  @ApiPropertyOptional({ type: ActiveCycleDto, nullable: true })
  activeCycle!: ActiveCycleDto | null;
}

export class ClaimedReviewCycleDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'],
  })
  status!: string;

  @ApiProperty()
  diffBaseSha!: string;

  @ApiProperty()
  diffHeadSha!: string;

  @ApiPropertyOptional({ nullable: true })
  diffFallbackReason!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'n8n-workflow-1' })
  claimedBy!: string | null;
}

export class ClaimReviewCycleResponseDto {
  @ApiProperty({ type: ClaimedReviewCycleDto })
  reviewCycle!: ClaimedReviewCycleDto;

  @ApiProperty({
    description: 'True when this claim created a new cycle row for the head SHA',
  })
  created!: boolean;
}

export class CompleteCycleResponseDto {
  @ApiProperty({ example: 'COMPLETED' })
  status!: string;

  @ApiPropertyOptional({ nullable: true })
  lastReviewedSha!: string | null;
}

export class FailCycleResponseDto {
  @ApiProperty({ example: 'FAILED' })
  status!: string;
}

export class RunAiReviewResponseDto {
  @ApiProperty({ format: 'uuid' })
  reviewCycleId!: string;

  @ApiProperty({ example: 'reviewed' })
  status!: string;

  @ApiProperty({ example: 'Found one potential null dereference in auth flow.' })
  summary!: string;

  @ApiProperty({ example: 1 })
  findingsCount!: number;

  @ApiProperty({ example: 'composer-2.5' })
  modelId!: string;

  @ApiProperty({ example: 3 })
  filesReviewed!: number;

  @ApiProperty({
    example: 0,
    description: 'Reviewable files omitted due to AI_REVIEW_MAX_FILES / prompt size caps',
  })
  filesSkipped!: number;
}

export class DiffManifestFileDto {
  @ApiProperty({ example: 'src/foo.ts' })
  path!: string;

  @ApiPropertyOptional({ nullable: true })
  previousPath!: string | null;

  @ApiProperty({ example: 'modified' })
  status!: string;

  @ApiProperty({ enum: ['low', 'medium', 'high', 'critical'] })
  risk!: string;

  @ApiProperty()
  binary!: boolean;

  @ApiProperty()
  patchAvailable!: boolean;

  @ApiProperty()
  additions!: number;

  @ApiProperty()
  deletions!: number;

  @ApiPropertyOptional({ nullable: true, description: 'Omitted when too large or binary' })
  patch!: string | null;

  @ApiProperty()
  tooLarge!: boolean;
}

export class DiffManifestResponseDto {
  @ApiProperty({ format: 'uuid' })
  reviewCycleId!: string;

  @ApiProperty()
  range!: {
    baseSha: string;
    headSha: string;
    fallbackReason: string | null;
  };

  @ApiProperty()
  config!: {
    source: string;
    valid: boolean;
    warnings: string[];
    ignoreGlobs: string[];
    riskRules: { glob: string; risk: string }[];
  };

  @ApiProperty({ type: [DiffManifestFileDto] })
  files!: DiffManifestFileDto[];

  @ApiProperty()
  truncated!: boolean;

  @ApiProperty()
  pageInfo!: { nextCursor: string | null };
}

export class WebhookResultDto {
  @ApiProperty({ enum: ['processed', 'ignored'] })
  status!: string;
}

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: string;
}
