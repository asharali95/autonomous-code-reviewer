import { IsOptional, IsString } from 'class-validator';

export class CompleteReviewCycleDto {
  @IsString()
  workerId!: string;

  @IsOptional()
  @IsString()
  summary?: string;
}
