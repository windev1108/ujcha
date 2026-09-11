import { IsBoolean, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateShippingConfigDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  baseFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  baseKm?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  feePerKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxDistanceKm?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  freeThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  freeShipDistanceKm?: number;

  @IsOptional()
  @IsBoolean()
  weatherSurchargeActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  weatherSurchargeFee?: number;
}