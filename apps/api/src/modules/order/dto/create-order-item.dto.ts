import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { OrderItemExtraDto } from './order-item-extra.dto';

export class CreateOrderItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  productId!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999_999)
  quantity!: number;

  @ApiProperty({ description: 'Đơn giá snapshot tại thời điểm đặt (catalog / POS).' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ type: [OrderItemExtraDto], description: 'Topping kèm' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemExtraDto)
  extras?: OrderItemExtraDto[];

  @ApiPropertyOptional({
    description: 'Tuỳ chọn nhóm (size, đường, đá…)',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  options?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'nameTranslation keyed by group name for the selected option value — used as fallback when product record has none.',
    type: 'object',
    additionalProperties: { type: 'object', additionalProperties: { type: 'string' } },
  })
  @IsOptional()
  @IsObject()
  optionTranslations?: Record<string, Record<string, string>>;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
