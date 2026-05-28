import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AdminReferralInvitationsQueryDto {
  @ApiPropertyOptional({
    description: 'Lọc theo mã giới thiệu của người mời (= referredBy của người được mời)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  referrerCode?: string;

  @ApiPropertyOptional({ default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;
}
