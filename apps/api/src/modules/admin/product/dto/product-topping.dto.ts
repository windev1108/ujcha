import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsObject, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class ProductToppingDto {
  @ApiPropertyOptional({ description: 'Client-generated ID; server generates uuid if omitted' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  @ApiProperty({ example: 'Trân châu' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 5000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Bản dịch tên topping: { "en": "..." }' })
  @IsOptional()
  @IsObject()
  nameTranslation?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Bản dịch mô tả topping: { "en": "..." }' })
  @IsOptional()
  @IsObject()
  descriptionTranslation?: Record<string, string>;
}
