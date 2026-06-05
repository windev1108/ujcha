import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

const _wsOrigins = (process.env.WS_CORS_ORIGINS ?? '*').split(',').map((s) => s.trim());

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: (origin: string, cb: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || _wsOrigins.includes(origin) || _wsOrigins.includes('*')) cb(null, true);
      else cb(new Error(`Origin ${origin} not allowed`));
    },
    credentials: true,
  },
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  // userId → set of socketIds (multiple tabs / devices)
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  handleConnection(socket: Socket) {
    const token = socket.handshake.query.token as string | undefined;
    if (!token) return;
    try {
      const payload = this.jwtService.verify<{ sub: string }>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      socket.data.userId = payload.sub;
      if (!this.userSockets.has(payload.sub)) {
        this.userSockets.set(payload.sub, new Set());
      }
      this.userSockets.get(payload.sub)!.add(socket.id);
    } catch {
      // Invalid / expired token — connection allowed but no user bound
    }
  }

  handleDisconnect(socket: Socket) {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;
    sockets.delete(socket.id);
    if (sockets.size === 0) this.userSockets.delete(userId);
  }

  emitToUser(userId: string, data: unknown) {
    const sockets = this.userSockets.get(userId);
    if (!sockets || sockets.size === 0) return;
    for (const id of sockets) {
      this.server.to(id).emit('notification', data);
    }
  }

  broadcastToAllUsers(event: string, data: unknown) {
    for (const [, sockets] of this.userSockets) {
      for (const id of sockets) {
        this.server.to(id).emit(event, data);
      }
    }
  }
}
