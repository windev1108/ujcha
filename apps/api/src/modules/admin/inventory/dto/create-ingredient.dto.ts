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
}
