import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProductOptionGroupDto } from './product-option-group.dto';
import { ProductToppingDto } from './product-topping.dto';

export class CreateProductDto {
  @ApiProperty({ format: 'uuid' })
  @IsString()
  categoryId!: string;

  @ApiPropertyOptional({
    example: 'Ujcha-MTC-001',
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
    description: 'Nhóm biến thể per-product (bắt buộc chọn ≥1 hoặc tuỳ chọn)',
    type: [ProductOptionGroupDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @Type(() => ProductOptionGroupDto)
  @ValidateNested({ each: true })
  optionGroups?: ProductOptionGroupDto[];

  @ApiPropertyOptional({
    description: 'Bản dịch tên món: { "en": "...", "ko": "..." }',
    example: { en: 'Matcha Latte', ko: '말차 라떼' },
  })
  @IsOptional()
  @IsObject()
  nameTranslation?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Bản dịch mô tả món: { "en": "...", "ko": "..." }',
  })
  @IsOptional()
  @IsObject()
  descriptionTranslation?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Topping per-product (tuỳ chọn thêm vào món)',
    type: [ProductToppingDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @Type(() => ProductToppingDto)
  @ValidateNested({ each: true })
  toppings?: ProductToppingDto[];

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

  @ApiPropertyOptional({ default: false, description: 'Gắn nhãn bán chạy — badge Best Seller + ưu tiên nổi bật' })
  @IsOptional()
  @IsBoolean()
  isBestSeller?: boolean;
}
