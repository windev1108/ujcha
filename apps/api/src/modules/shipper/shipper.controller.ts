import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ShipperJwtGuard } from '../shipper-auth/shipper-jwt.guard';
import { CurrentShipper } from '../shipper-auth/decorators/current-shipper.decorator';
import type { ShipperJwtUser } from '../shipper-auth/shipper-jwt.types';
import { ShipperService } from './shipper.service';

@Controller('shipper')
@UseGuards(ShipperJwtGuard)
export class ShipperController {
  constructor(private readonly service: ShipperService) {}

  @Get('orders')
  getOrders(@CurrentShipper() shipper: ShipperJwtUser) {
    return this.service.getAssignedOrders(shipper.shipperId);
  }

  @Get('orders/available')
  getAvailableOrders() {
    return this.service.getAvailableOrders();
  }

  @Get('orders/history')
  getHistory(@CurrentShipper() shipper: ShipperJwtUser) {
    return this.service.getOrderHistory(shipper.shipperId);
  }

  @Get('orders/:id')
  getOrder(@CurrentShipper() shipper: ShipperJwtUser, @Param('id') id: string) {
    return this.service.getOrderDetail(shipper.shipperId, id);
  }

  @Patch('orders/:id/accept')
  accept(@CurrentShipper() shipper: ShipperJwtUser, @Param('id') id: string) {
    return this.service.acceptOrder(shipper.shipperId, id);
  }

  /** Shipper đã lấy hàng từ cửa hàng (ready → picked_up) */
  @Patch('orders/:id/pickup')
  pickup(@CurrentShipper() shipper: ShipperJwtUser, @Param('id') id: string) {
    return this.service.markPickedUp(shipper.shipperId, id);
  }

  /** Backward-compat alias for pickup */
  @Patch('orders/:id/start')
  start(@CurrentShipper() shipper: ShipperJwtUser, @Param('id') id: string) {
    return this.service.markPickedUp(shipper.shipperId, id);
  }

  /** Shipper đã đến điểm giao (picked_up → arrived) */
  @Patch('orders/:id/arrived')
  arrived(@CurrentShipper() shipper: ShipperJwtUser, @Param('id') id: string) {
    return this.service.markArrived(shipper.shipperId, id);
  }

  /** Giao xong (arrived → completed) */
  @Patch('orders/:id/complete')
  complete(@CurrentShipper() shipper: ShipperJwtUser, @Param('id') id: string) {
    return this.service.completeDelivery(shipper.shipperId, id);
  }
}
