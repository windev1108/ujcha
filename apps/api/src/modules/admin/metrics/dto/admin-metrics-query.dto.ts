import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export enum MetricsGroupBy {
  none = 'none',
  day = 'day',
  week = 'week',
  month = 'month',
}

export class AdminMetricsQueryDto {
  @ApiProperty({ description: 'Bắt đầu khoảng (ISO 8601)', example: '2026-03-01T00:00:00.000Z' })
  @IsDateString()
  from!: string;

  @ApiProperty({ description: 'Kết thúc khoảng (ISO 8601)', example: '2026-03-31T23:59:59.999Z' })
  @IsDateString()
  to!: string;

  @ApiPropertyOptional({
    enum: MetricsGroupBy,
    default: MetricsGroupBy.none,
    description:
      'none: một tổng; day/week/month: chuỗi bucket theo date_trunc (UTC)',
  })
  @IsOptional()
  @IsEnum(MetricsGroupBy)
  groupBy?: MetricsGroupBy;
}
