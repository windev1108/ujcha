import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Đồ uống' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({
    description: 'URL slug; nếu bỏ trống sẽ sinh từ name',
    example: 'do-uong',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  slug?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    description: 'URL ảnh thumbnail cho card danh mục trên trang chủ',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  thumbnail?: string | null;

  @ApiPropertyOptional({
    description: 'Bản dịch tên danh mục: { "en": "...", "ko": "..." }',
  })
  @IsOptional()
  @IsObject()
  nameTranslation?: Record<string, string>;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000)
  pricingMarginPercent?: number | null;
}
