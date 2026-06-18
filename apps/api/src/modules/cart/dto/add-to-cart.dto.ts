import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class AddToCartDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  productId!: string;

  @ApiProperty({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999_999)
  quantity!: number;

  @ApiPropertyOptional({ description: '{ [groupName]: label }' })
  @IsOptional()
  @IsObject()
  selectedOptions?: Record<string, string>;

  @ApiPropertyOptional({ type: [String], description: 'IDs of product-local toppings' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  toppingIds?: string[];

  @ApiPropertyOptional({ description: 'Ghi chú riêng cho dòng hàng (ít đá, không đường…)', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
