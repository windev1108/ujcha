import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsUUID, Max, Min } from 'class-validator';

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

  @ApiPropertyOptional({ description: '{ [groupId]: value }' })
  @IsOptional()
  @IsObject()
  selectedOptions?: Record<string, string>;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { each: true })
  toppingIds?: string[];
}
