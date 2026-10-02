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

  /** null = xoá margin mặc định. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000)
  defaultMarginPercent?: number | null;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(100000)
  roundingStep?: number;
}
