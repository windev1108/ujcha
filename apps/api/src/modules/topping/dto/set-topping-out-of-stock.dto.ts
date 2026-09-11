// topping/dto/set-topping-out-of-stock.dto.ts
import { IsBoolean, IsString, MinLength } from 'class-validator';

export class SetToppingOutOfStockDto {
  @IsString() @MinLength(1) name!: string;
  @IsBoolean() isOutOfStock!: boolean;
}
