import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class AdminOrderMetricsQueryDto {
  @ApiPropertyOptional({ description: 'ISO date — bắt đầu khoảng (00:00 UTC)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date — kết thúc khoảng (cuối ngày UTC)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
