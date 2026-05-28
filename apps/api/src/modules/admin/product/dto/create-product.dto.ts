import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  categoryId!: string;

  @ApiPropertyOptional({
    example: 'KUN-MTC-001',
    description: 'Tuỳ chọn — để trống sẽ tự sinh từ tên (slugify, tối đa 80 ký tự)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  name!: string;

  @ApiPropertyOptional({ description: 'Nếu bỏ trống sẽ sinh từ name' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string;

  @ApiProperty({ example: 35000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @ApiPropertyOptional({
    type: [String],
    description: 'Danh sách URL ảnh (CDN / link ngoài)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(2000, { each: true })
  imageUrls?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'IDs của VariantGroup áp dụng cho sản phẩm này',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  variantGroupIds?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: 'Đánh dấu hết hàng (khách vẫn thấy món nếu đang hiển thị)',
  })
  @IsOptional()
  @IsBoolean()
  isSoldOut?: boolean;

  @ApiPropertyOptional({
    default: 0,
    description: 'Giảm giá theo sản phẩm 0–100% (cộng với giảm giá toàn shop)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  discountPercent?: number;
}
