import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingService, type StoredLocation } from './tracking.service';
import type { LocationUpdateDto } from './dto/location-update.dto';
import { SHIPPER_JWT_ENV } from '../shipper-auth/config/shipper-jwt.config';
import { SHIPPER_JWT_TYPE, type ShipperJwtPayload } from '../shipper-auth/shipper-jwt.types';

const _wsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3001')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

@WebSocketGateway({
  namespace: '/tracking',
  cors: {
    origin: (origin: string, cb: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || _wsOrigins.includes(origin)) cb(null, true);
      else cb(new Error(`Origin ${origin} not allowed`));
    },
    credentials: true,
  },
})
export class TrackingGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TrackingGateway.name);
  private readonly shipperSockets = new Map<string, string>(); // socketId → shipperId

  constructor(
    private readonly trackingService: TrackingService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleDisconnect(client: Socket) {
    const shipperId = this.shipperSockets.get(client.id);
    if (shipperId) {
      await this.trackingService.markOffline(shipperId);
      this.server.to(`shipper:${shipperId}`).emit('shipper:offline', { shipperId });
      this.shipperSockets.delete(client.id);
      this.logger.log(`Shipper ${shipperId} disconnected → offline`);
    }
  }

  @SubscribeMessage('shipper:auth')
  async handleAuth(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { token: string },
  ) {
    try {
      const secret = this.config.getOrThrow<string>(SHIPPER_JWT_ENV.ACCESS_SECRET);
      const payload = await this.jwt.verifyAsync<ShipperJwtPayload>(data.token, { secret });

      if (payload.typ !== SHIPPER_JWT_TYPE) throw new Error('wrong token type');

      this.shipperSockets.set(client.id, payload.shipperId);
      client.data.shipperId = payload.shipperId;
      void client.join(`shipper:${payload.shipperId}`);
      void client.join('room:shippers');

      client.emit('shipper:auth:ok', { shipperId: payload.shipperId });
      this.logger.log(`Shipper ${payload.shipperId} authenticated on socket ${client.id}`);
    } catch {
      client.emit('shipper:auth:error', { message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  @SubscribeMessage('location:update')
  async handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: LocationUpdateDto,
  ) {
    const shipperId = client.data.shipperId as string | undefined;
    if (!shipperId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      const loc = await this.trackingService.updateLocation(shipperId, dto);
      this.server.to(`order:${dto.orderId}`).emit('shipper:location', {
        shipperId,
        orderId: dto.orderId,
        lat: loc.lat,
        lng: loc.lng,
        timestamp: loc.timestamp,
        speed: loc.speed,
      });
    } catch (err: unknown) {
      this.logger.warn(`Location rejected for ${shipperId}: ${(err as Error).message}`);
    }
  }

  /** Customer joins a room to watch an order's delivery in real-time. */
  @SubscribeMessage('order:watch')
  async handleWatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string },
  ) {
    void client.join(`order:${data.orderId}`);

    // Look up the assigned shipper so we can query the correct Redis keys.
    // Redis stores location by shipperId, not orderId.
    const order = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      select: { shipperId: true },
    });

    let currentLocation: StoredLocation | null = null;
    let status: 'online' | 'offline' = 'offline';

    if (order?.shipperId) {
      [currentLocation, status] = await Promise.all([
        this.trackingService.getLocation(order.shipperId),
        this.trackingService.getStatus(order.shipperId),
      ]);
    }

    client.emit('order:watch:ok', { orderId: data.orderId, currentLocation, status });
  }

  @SubscribeMessage('order:unwatch')
  handleUnwatch(@ConnectedSocket() client: Socket, @MessageBody() data: { orderId: string }) {
    void client.leave(`order:${data.orderId}`);
  }
}
