import { ApiPropertyOptional } from '@nestjs/swagger';
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

export class UpdateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ nullable: true })
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

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Biên lợi nhuận gộp mục tiêu (%) trên giá bán, 0 ≤ x < 100. null = kế thừa global.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99.99)
  pricingMarginPercent?: number | null;
}
