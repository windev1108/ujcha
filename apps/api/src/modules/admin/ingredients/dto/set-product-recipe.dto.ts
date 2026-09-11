// admin-product/dto/set-product-recipe.dto.ts
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class RecipeItemDto {
  @IsUUID() ingredientId!: string;
  @IsOptional() @IsString() optionGroupName?: string;
  @IsOptional() @IsString() optionValueLabel?: string;
  @IsNumber() @Min(0.001) quantity!: number;
}

export class ToppingRecipeItemDto {
  @IsString() toppingId!: string;
  @IsUUID() ingredientId!: string;
  @IsNumber() @Min(0) quantity!: number;
}

export class SetProductRecipeDto {
  @IsOptional() @IsString() recipeNote?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeItemDto)
  items!: RecipeItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ToppingRecipeItemDto)
  toppingItems?: ToppingRecipeItemDto[];
}
