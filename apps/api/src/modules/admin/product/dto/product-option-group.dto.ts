import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';


export class ProductOptionValueDto {
  @ApiProperty({ example: 'L' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label!: string;

  @ApiPropertyOptional({
    example: 5000,
    description: 'Phụ phí cộng thêm khi chọn giá trị này (VNĐ), giống topping.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  priceDelta?: number;

  @ApiPropertyOptional({ description: 'Bản dịch nhãn giá trị: { "en": "..." }' })
  @IsOptional()
  @IsObject()
  nameTranslation?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Bản dịch mô tả giá trị: { "en": "..." }' })
  @IsOptional()
  @IsObject()
  descriptionTranslation?: Record<string, string>;
}

/**
 * Trả về instance `ProductOptionValueDto` để `ValidateNested` + `forbidNonWhitelisted`
 * nhận đúng metadata (plain object sau Transform bị coi là thuộc tính lạ).
 */
function transformOptionValues({ value }: { value: unknown }): ProductOptionValueDto[] {
  if (!Array.isArray(value)) return [];
  const out: ProductOptionValueDto[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      const label = item.trim();
      if (label) {
        out.push(
          plainToInstance(ProductOptionValueDto, { label, priceDelta: 0 }),
        );
      }
      continue;
    }
    if (item && typeof item === 'object' && item !== null && 'label' in item) {
      const label = String((item as { label: unknown }).label).trim();
      if (!label) continue;
      const raw = (item as { priceDelta?: unknown }).priceDelta;
      let priceDelta = 0;
      if (raw !== undefined && raw !== null && raw !== '') {
        const n = Number(raw);
        if (Number.isFinite(n) && n >= 0) priceDelta = Math.round(n * 100) / 100;
      }
      const nt = (item as { nameTranslation?: unknown }).nameTranslation;
      const dt = (item as { descriptionTranslation?: unknown }).descriptionTranslation;
      out.push(
        plainToInstance(ProductOptionValueDto, {
          label,
          priceDelta,
          ...(nt && typeof nt === 'object' ? { nameTranslation: nt } : {}),
          ...(dt && typeof dt === 'object' ? { descriptionTranslation: dt } : {}),
        }),
      );
    }
  }
  return out;
}

export class ProductOptionGroupDto {
  @ApiPropertyOptional({ example: 'grp-size-1', description: 'Client-generated ID; server generates uuid if omitted' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  @ApiProperty({ example: 'Kích thước' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 1, description: 'Số lựa chọn tối thiểu (0 = tùy chọn, ≥1 = bắt buộc)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  selectionMin?: number;

  @ApiPropertyOptional({ example: 1, description: 'Số lựa chọn tối đa' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  selectionMax?: number;

  @ApiPropertyOptional({ description: 'Bản dịch tên nhóm: { "en": "..." }' })
  @IsOptional()
  @IsObject()
  nameTranslation?: Record<string, string>;

  @ApiProperty({
    example: [
      { label: 'S', priceDelta: 0 },
      { label: 'L', priceDelta: 5000 },
    ],
    description: 'Mỗi giá trị có thể có phụ phí (size L, XL…).',
  })
  @Transform(transformOptionValues, { toClassOnly: true })
  @IsArray()
  @ArrayMaxSize(40)
  @Type(() => ProductOptionValueDto)
  @ValidateNested({ each: true })
  values!: ProductOptionValueDto[];
}
