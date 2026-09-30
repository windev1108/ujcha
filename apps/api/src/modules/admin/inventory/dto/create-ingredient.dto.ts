import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateIngredientDto {
  @IsString() @MinLength(1) name!: string;
  @IsString() @MinLength(1) unit!: string;
  @IsOptional() @IsNumber() @Min(0) stockQty?: number;
  @IsOptional() @IsNumber() @Min(0) lowStockThreshold?: number;
  @IsOptional() @IsString() note?: string;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Giá vốn / 1 đơn vị (VND). null = xoá giá vốn.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  costPerUnit?: number | null;
}
