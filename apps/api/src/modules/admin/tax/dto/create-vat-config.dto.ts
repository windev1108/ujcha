import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateVatConfigDto {
  @ApiProperty({ description: 'Tên cấu hình VAT (ví dụ: "VAT 10% – 2024")' })
  @IsString()
  @MaxLength(255)
  label: string;

  @ApiProperty({ description: 'Tỷ lệ VAT tính theo %, ví dụ 10', minimum: 0, maximum: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  vatPercent: number;

  @ApiProperty({ description: 'Ngày hiệu lực từ (ISO 8601, ví dụ 2024-01-01)' })
  @IsDateString()
  effectiveFrom: string;

  @ApiPropertyOptional({ description: 'Ngày hết hiệu lực (null = không xác định)' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional({ description: 'Đặt ngay làm cấu hình đang dùng (deactivate các config khác)', default: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
