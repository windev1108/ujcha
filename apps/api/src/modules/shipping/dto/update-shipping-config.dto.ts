import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class WeatherTierDto {
  @IsString()
  @MaxLength(50)
  label!: string;

  /** Mưa: mm/h — Gió giật: km/h. */
  @IsNumber()
  @Min(0.1)
  minValue!: number;

  @IsInt()
  @Min(0)
  @Max(100000)
  fee!: number;
}

export class UpdateShippingConfigDto {
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) baseFee?: number;
  @IsOptional() @IsNumber() @Min(0) baseKm?: number;
  @IsOptional() @IsInt() @Min(0) feePerKm?: number;
  @IsOptional() @IsNumber() @Min(1) maxDistanceKm?: number;
  @IsOptional() @IsInt() @Min(0) freeThreshold?: number;
  @IsOptional() @IsNumber() @Min(0) freeShipDistanceKm?: number;

  @IsOptional() @IsBoolean() weatherSurchargeActive?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(100000) weatherSurchargeFee?: number;

  @IsOptional() @IsBoolean() weatherAutoMode?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(100000) weatherThunderstormFee?: number;
  @IsOptional() @IsInt() @Min(15) @Max(1440) weatherStaleMinutes?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => WeatherTierDto)
  weatherRainTiersJson?: WeatherTierDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => WeatherTierDto)
  weatherWindTiersJson?: WeatherTierDto[];
}
