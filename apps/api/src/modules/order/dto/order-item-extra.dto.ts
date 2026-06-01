import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class OrderItemExtraDto {
  @ApiProperty({ description: 'ID of the product-local topping' })
  @IsString()
  @MaxLength(64)
  toppingId!: string;

  @ApiPropertyOptional({ description: 'Client-side nameTranslation snapshot — used as fallback when the product record has none.' })
  @IsOptional()
  @IsObject()
  nameTranslation?: Record<string, string>;
}
