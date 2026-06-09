import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class OrdersGateway {
  @WebSocketServer()
  server: Server;

  emitOrderPaid(data: {
    orderId: string;
    paymentCode: string;
    transferAmount: number;
    transactionId: string;
  }) {
    this.server.emit('order:paid', data);
  }

  emitOrderCreated(data: { orderId: string; type: string }) {
    const connected = this.server.sockets.sockets.size;
    console.log(`[OrdersGateway] emit order:new — orderId=${data.orderId} clients=${connected}`);
    this.server.emit('order:new', data);
  }

  emitShipperAssigned(data: { orderId: string; shipperId: string }) {
    this.server.emit('order:shipper-assigned', data);
  }

  emitOrderStatusUpdated(data: { orderId: string; status: string }) {
    this.server.emit('order:status', data);
    // Also push into /tracking so ShipperLiveMap (which joins order:{id} room there) receives it
    this.server.of('/tracking').to(`order:${data.orderId}`).emit('order:status', data);
  }

  emitExternalOrderCreated(data: { orderId: string; platform: string }) {
    this.server.emit('order:external', data);
  }

  emitNewDeliveryOrder(data: {
    orderId: string;
    paymentCode: string;
    customerName: string;
    customerPhone: string;
    address: string;
    addressNote: string | null;
    lat: number | null;
    lng: number | null;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
      imageUrl: string | null;
      optionsJson: Record<string, string>;
      extrasJson: Array<{ name: string; price: number }>;
      note: string | null;
    }>;
    totalAmount: number;
    shippingFee: number;
    paymentType: string;
  }) {
    this.server.of('/tracking').to('room:shippers').emit('order:new-delivery', data);
  }

  emitDeliveryOrderTaken(data: { orderId: string }) {
    this.server.of('/tracking').to('room:shippers').emit('order:delivery-taken', data);
  }

  /** Broadcast status change of an unassigned delivery order to all shippers */
  emitAvailableOrderStatus(data: { orderId: string; status: string }) {
    this.server.of('/tracking').to('room:shippers').emit('order:status', data);
  }

  emitShipperOrderStatusUpdated(data: { orderId: string; status: string; shipperId: string }) {
    this.server.of('/tracking').to(`shipper:${data.shipperId}`).emit('order:status', {
      orderId: data.orderId,
      status: data.status,
    });
  }
}
