// admin-product/dto/set-product-recipe.dto.ts
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';


export class RecipeConditionDto {
  @IsString()
  @MinLength(1)
  group!: string;

  @IsString()
  @MinLength(1)
  value!: string;
}

export class RecipeItemDto {
  @IsUUID()
  ingredientId!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => RecipeConditionDto)
  conditions?: RecipeConditionDto[];

  @IsNumber()
  @Min(0)
  quantity!: number;
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
