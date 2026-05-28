import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, ValidateNested } from 'class-validator';
import { PaymentType } from '@prisma/client';
import { CreateOrderItemDto } from '../../order/dto/create-order-item.dto';

export class CreateTableOrderDto {
  @ApiPropertyOptional({ enum: PaymentType, description: 'Phương thức thanh toán. Mặc định: cash.' })
  @IsOptional()
  @IsEnum(PaymentType)
  paymentType?: PaymentType;

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}
