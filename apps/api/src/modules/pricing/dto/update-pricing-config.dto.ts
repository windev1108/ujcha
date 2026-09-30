import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class UpdatePricingConfigDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  /** null = xoá markup mặc định. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000)
  defaultMarkupPercent?: number | null;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(100000)
  roundingStep?: number;
}
