import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateShopSettingsDto {
  @ApiProperty({ example: 10, description: 'Giảm giá toàn shop 0–100% (cộng với giảm giá từng sản phẩm)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  globalDiscountPercent!: number;
}
