import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { OrderType, PaymentType } from '@prisma/client';
import { CreateOrderItemDto } from './create-order-item.dto';

export class InlineAddressDto {
  @ApiProperty({ description: 'Địa chỉ đầy đủ' })
  @IsString()
  @MaxLength(2000)
  fullAddress!: string;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 6 })
  lat!: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 6 })
  lng!: number;
}

export class CreateOrderDto {
  @ApiProperty({ enum: OrderType })
  @IsEnum(OrderType)
  type!: OrderType;

  @ApiPropertyOptional({
    enum: PaymentType,
    description: 'Hình thức thanh toán. Mặc định cash.',
  })
  @IsOptional()
  @IsEnum(PaymentType)
  paymentType!: PaymentType;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Địa chỉ đã lưu — khi có user (app / POS gắn khách).',
  })
  @IsOptional()
  @IsUUID('4')
  addressId?: string;

  @ApiPropertyOptional({
    description: 'Địa chỉ mới (inline) — tự động lưu nếu user < 3 địa chỉ. Không dùng cùng lúc với addressId.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => InlineAddressDto)
  inlineAddress?: InlineAddressDto;

  @ApiPropertyOptional({
    description:
      'Giao hàng không member: địa chỉ đầy đủ (POS). Không dùng cùng lúc với addressId.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  guestDeliveryAddress?: string;

  @ApiPropertyOptional({ description: 'SĐT người nhận (khách không tài khoản).' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  guestDeliveryPhone?: string;

  @ApiPropertyOptional({ description: 'Tên người nhận (khách không tài khoản).' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  guestDeliveryName?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((o: CreateOrderDto) => o.type === OrderType.table)
  @IsNotEmpty()
  @IsUUID('4')
  tableId?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 — bắt buộc với pickup' })
  @ValidateIf((o: CreateOrderDto) => o.type === OrderType.pickup)
  @IsNotEmpty()
  @IsDateString()
  pickupTime?: string;

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @ApiPropertyOptional({
    description: 'Mã voucher đã áp dụng — backend dùng để mark UserVoucher.usedAt.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  voucherCode?: string;

  @ApiPropertyOptional({
    description:
      'Giảm giá tuyến tính (mở rộng: voucher/referral map vào đây sau khi resolve).',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({
    description: 'Phí giao hàng (tính từ GPS). Chỉ áp dụng cho đơn delivery.',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  shippingFee?: number;
}
