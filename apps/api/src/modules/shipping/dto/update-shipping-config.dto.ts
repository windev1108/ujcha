import { IsBoolean, IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateShippingConfigDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  baseFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  baseKm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  feePerKm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxDistanceKm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  freeThreshold?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  freeShipDistanceKm?: number;
}
