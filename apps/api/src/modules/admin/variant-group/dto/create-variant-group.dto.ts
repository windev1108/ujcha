import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class VariantGroupValueDto {
  @ApiProperty({ example: 'L' })
  @IsString() @MinLength(1) @MaxLength(80)
  label!: string;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  priceDelta?: number;
}

export class CreateVariantGroupDto {
  @ApiProperty({ example: 'Kích thước' })
  @IsString() @MinLength(1) @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ type: [VariantGroupValueDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(40)
  @Type(() => VariantGroupValueDto)
  values?: VariantGroupValueDto[];

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(9999)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
