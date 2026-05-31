import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class OrderItemExtraDto {
  @ApiProperty({ description: 'ID of the product-local topping' })
  @IsString()
  @MaxLength(64)
  toppingId!: string;
}
