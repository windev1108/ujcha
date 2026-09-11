import { IsNumber, IsOptional, IsString } from 'class-validator';

export class AdjustIngredientStockDto {
  /** Dương = nhập kho, âm = điều chỉnh giảm thủ công (hao hụt, hỏng...) */
  @IsNumber() changeQty!: number;
  @IsOptional() @IsString() note?: string;
}
