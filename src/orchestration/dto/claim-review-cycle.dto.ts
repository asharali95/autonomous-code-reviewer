import { IsInt, IsString, Matches, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ClaimReviewCycleDto {
  @IsString()
  githubRepoId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  pullNumber!: number;

  @IsString()
  @Matches(/^[0-9a-f]{40,64}$/i)
  headSha!: string;

  @IsString()
  workerId!: string;
}
