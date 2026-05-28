import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server } from 'socket.io';

const _wsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3001')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

@WebSocketGateway({
  cors: {
    origin: (origin: string, cb: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || _wsOrigins.includes(origin) || _wsOrigins.includes('null')) cb(null, true)
      else cb(new Error(`Origin ${origin} not allowed`))
    },
    credentials: true,
  },
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
    this.server.emit('order:new', data);
  }

  emitShipperAssigned(data: { orderId: string; shipperId: string }) {
    this.server.emit('order:shipper-assigned', data);
  }

  emitOrderStatusUpdated(data: { orderId: string; status: string }) {
    this.server.emit('order:status', data);
  }

  emitExternalOrderCreated(data: { orderId: string; platform: string }) {
    this.server.emit('order:external', data);
  }
}
