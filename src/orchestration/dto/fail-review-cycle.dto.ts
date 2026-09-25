import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class FailReviewCycleDto {
  @ApiProperty({ example: 'n8n-workflow-1' })
  @IsString()
  workerId!: string;

  @ApiProperty({ example: 'GITHUB_RATE_LIMIT' })
  @IsString()
  reason!: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  retryable?: boolean;
}
