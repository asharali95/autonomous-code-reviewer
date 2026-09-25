import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, Matches, Min } from 'class-validator';

export class ClaimReviewCycleDto {
  @ApiProperty({
    example: '1387749206',
    description: 'Stable numeric GitHub repository id (not the internal UUID)',
  })
  @IsString()
  githubRepoId!: string;

  @ApiProperty({ example: 42 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pullNumber!: number;

  @ApiProperty({
    example: 'de1fec8d0bf25dc05d86c7099544063e560bca66',
    description: 'PR head SHA to claim',
  })
  @IsString()
  @Matches(/^[0-9a-f]{40,64}$/i)
  headSha!: string;

  @ApiProperty({ example: 'n8n-workflow-1' })
  @IsString()
  workerId!: string;
}
