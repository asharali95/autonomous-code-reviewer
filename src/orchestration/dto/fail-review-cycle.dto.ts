import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class FailReviewCycleDto {
  @IsString()
  workerId!: string;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsBoolean()
  retryable?: boolean;
}
