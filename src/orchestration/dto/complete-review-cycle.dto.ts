import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CompleteReviewCycleDto {
  @ApiProperty({ example: 'n8n-workflow-1' })
  @IsString()
  workerId!: string;

  @ApiPropertyOptional({
    example: 'Review finished, no findings persisted in v1',
  })
  @IsOptional()
  @IsString()
  summary?: string;
}
