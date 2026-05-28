import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAddressDto {
  @ApiProperty({ example: '123 Đường ABC, Quận 1, TP.HCM' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  fullAddress!: string;

  @ApiProperty({ example: 10.7769 })
  @Type(() => Number)
  @IsNumber()
  lat!: number;

  @ApiProperty({ example: 106.7009 })
  @Type(() => Number)
  @IsNumber()
  lng!: number;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({
    description: 'Đặt làm địa chỉ mặc định (bỏ qua nếu đây là địa chỉ đầu tiên — luôn mặc định)',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isDefault?: boolean;
}
