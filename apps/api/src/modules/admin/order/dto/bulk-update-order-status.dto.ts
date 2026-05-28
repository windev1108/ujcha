import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsUUID, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class BulkUpdateOrderStatusDto {
  @ApiProperty({ type: [String], description: 'Danh sách ID đơn hàng (UUID)' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  orderIds: string[];

  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
