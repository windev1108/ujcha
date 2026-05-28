import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { PaymentStatus } from '@prisma/client';

import { CreateOrderDto } from '../../../order/dto/create-order.dto';

/** Tạo đơn thay khách (POS / hỗ trợ) — dùng chung validation với CreateOrderDto. */
export class AdminCreateOrderDto extends CreateOrderDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Khách có tài khoản (tích điểm). Bỏ trống = khách lẻ / giao không đăng ký (nhập guestDelivery* khi giao hàng).',
  })
  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @ApiPropertyOptional({
    enum: PaymentStatus,
    description: 'Trạng thái thanh toán khi tạo đơn (POS: đã thu / chưa thu). Mặc định pending.',
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

}
