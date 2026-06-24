import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/group',
  cors: { origin: '*', credentials: true },
})
export class GroupOrderGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('join-room')
  handleJoinRoom(
    @MessageBody() data: { token: string },
    @ConnectedSocket() client: Socket,
  ) {
    void client.join(`room:${data.token}`);
    client.emit('joined', { token: data.token });
  }

  broadcast(token: string, state: unknown) {
    this.server.to(`room:${token}`).emit('updated', state);
  }

  broadcastKick(token: string, participantId: string) {
    this.server.to(`room:${token}`).emit('kicked', { participantId });
  }

  broadcastDissolved(token: string) {
    this.server.to(`room:${token}`).emit('dissolved');
  }

  broadcastLeave(token: string, name: string) {
    this.server.to(`room:${token}`).emit('member-left', { name });
  }
}
