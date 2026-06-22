import { ApiPropertyOptional } from '@nestjs/swagger';
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
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProductOptionGroupDto } from './product-option-group.dto';
import { ProductToppingDto } from './product-topping.dto';

export class UpdateProductDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Để chuỗi rỗng để tự sinh lại SKU từ tên' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  name?: string;

  @ApiPropertyOptional()
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

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(2000, { each: true })
  imageUrls?: string[];

  @ApiPropertyOptional({ description: 'Bản dịch tên món: { "en": "...", "ko": "..." }' })
  @IsOptional()
  @IsObject()
  nameTranslation?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Bản dịch mô tả món: { "en": "...", "ko": "..." }' })
  @IsOptional()
  @IsObject()
  descriptionTranslation?: Record<string, string>;

  @ApiPropertyOptional({ type: [ProductOptionGroupDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @Type(() => ProductOptionGroupDto)
  @ValidateNested({ each: true })
  optionGroups?: ProductOptionGroupDto[];

  @ApiPropertyOptional({ type: [ProductToppingDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @Type(() => ProductToppingDto)
  @ValidateNested({ each: true })
  toppings?: ProductToppingDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSoldOut?: boolean;

  @ApiPropertyOptional({ description: '0–100' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional({ description: 'Gắn nhãn bán chạy — badge Best Seller + ưu tiên nổi bật' })
  @IsOptional()
  @IsBoolean()
  isBestSeller?: boolean;
}
