// src/modules/admin/toppings/dto/set-topping-recipe.dto.ts
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ToppingRecipeLineDto {
  @IsUUID() ingredientId!: string;
  @IsNumber() @Min(0) quantity!: number;
}

export class SetToppingRecipeDto {
  @IsString() @MinLength(1) name!: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ToppingRecipeLineDto)
  items!: ToppingRecipeLineDto[];
}
