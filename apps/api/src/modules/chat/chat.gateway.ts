import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

type ChatRoomKind = 'order' | 'group';

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  private roomName(kind: ChatRoomKind, id: string): string {
    return `room:${kind}:${id}`;
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(
    @MessageBody() data: { kind: ChatRoomKind; id: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(this.roomName(data.kind, data.id));
    // Trả ack — client chỉ coi là "đã vào room" sau khi nhận response này,
    // loại bỏ race giữa emit('join-room') và server broadcast.
    return { ok: true };
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(
    @MessageBody() data: { kind: ChatRoomKind; id: string },
    @ConnectedSocket() client: Socket,
  ) {
    void client.leave(this.roomName(data.kind, data.id));
    return { ok: true };
  }

  @SubscribeMessage('join-staff-lobby')
  handleJoinStaffLobby(@ConnectedSocket() client: Socket) {
    void client.join('room:staff-lobby');
    return { ok: true };
  }

  @SubscribeMessage('leave-staff-lobby')
  handleLeaveStaffLobby(@ConnectedSocket() client: Socket) {
    void client.leave('room:staff-lobby');
    return { ok: true };
  }

  broadcastToRoom(kind: ChatRoomKind, id: string, message: unknown) {
    this.server.to(this.roomName(kind, id)).emit('message', message);
  }

  notifyStaffNewMessage(kind: ChatRoomKind, id: string) {
    this.server.to('room:staff-lobby').emit('chat:new-message', { kind, id });
  }

  notifyRoomClosed(kind: ChatRoomKind, id: string) {
    this.server.to(this.roomName(kind, id)).emit('room:closed', { kind, id });
    this.server.to('room:staff-lobby').emit('chat:room-closed', { kind, id });
  }
}