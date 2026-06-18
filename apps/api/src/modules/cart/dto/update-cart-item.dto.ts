import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateCartItemDto {
  @ApiProperty({ minimum: 0, description: '0 = xóa dòng khỏi giỏ' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
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

  @ApiPropertyOptional({ description: 'Ghi chú riêng cho dòng hàng', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
