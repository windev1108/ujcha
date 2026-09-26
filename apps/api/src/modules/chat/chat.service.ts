import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ChatGateway } from './chat.gateway';
import { UploadService } from '../upload/upload.service';

const DEFAULT_PAGE_SIZE = 20;

export interface ChatMessagePage {
  messages: ChatMessagePayload[];
  hasMore: boolean;
}

export type ChatRoomKind = 'order' | 'group';

export type ChatViewer =
  | { kind: 'order-guest'; orderId: string }
  | { kind: 'order-owner'; orderId: string; userId: string }
  | {
    kind: 'group-participant';
    groupOrderId: string;
    participantId: string;
    userId: string | null;
    guestName: string | null;
    avatar: string | null;
  };

export interface ChatMessagePayload {
  id: string;
  /**
   * Định danh ổn định của người gửi — participantId cho group chat (nhiều
   * participant cùng senderType customer/guest, chỉ senderId mới phân biệt
   * được "tin của mình" với "tin của người khác trong nhóm"), userId/guest
   * identifier cho order chat 1:1, 'staff' cho tin của nhân viên.
   */
  senderId: string;
  senderType: 'customer' | 'guest' | 'staff';
  displayName: string;
  avatar: string | null;
  content: string;
  type: 'text' | 'sticker' | 'image';
  createdAt: string; // ISO
}
const MAX_IMAGES_PER_ROOM = 200;
const MAX_MESSAGES_PER_ROOM = 200;
/// Lưới an toàn — tự dọn nếu vì lý do gì đó hook đóng phòng không chạy
/// (đơn bị xóa thủ công, lỗi runtime...). Không phải cơ chế chính.
const ROOM_SAFETY_TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly gateway: ChatGateway,
    private readonly uploadService: UploadService,
  ) { }

  // ── Redis key helpers ────────────────────────────────────────────────

  private key(kind: ChatRoomKind, id: string): string {
    return `chat:${kind}:${id}:messages`;
  }

  private imagesKey(kind: ChatRoomKind, id: string): string {
    return `chat:${kind}:${id}:images`;
  }

  private static readonly ACTIVE_ROOMS_KEY = 'chat:active-rooms';

  // ── Viewer resolution ────────────────────────────────────────────────
  // Cùng mô hình tin cậy với OrderService.getOrderDetail (biết paymentCode
  // là đủ) và GroupOrderService.resolveParticipant (sessionToken là đủ).

  async resolveOrderViewer(
    paymentCode: string | undefined,
    userId: string | null,
  ): Promise<ChatViewer> {
    if (!paymentCode?.trim()) {
      throw new BadRequestException({
        message: 'Cần paymentCode để truy cập chat của đơn.',
        code: 'CHAT_PAYMENT_CODE_REQUIRED',
      });
    }
    const order = await this.prisma.order.findFirst({
      where: { paymentCode: paymentCode.trim() },
      select: { id: true, userId: true, status: true },
    });
    if (!order) {
      throw new NotFoundException({
        message: 'Không tìm thấy đơn.',
        code: 'ORDER_NOT_FOUND',
      });
    }
    if (order.status === 'completed' || order.status === 'cancelled') {
      throw new BadRequestException({
        message: 'Đơn đã kết thúc, không thể tiếp tục trò chuyện.',
        code: 'CHAT_ORDER_CLOSED',
      });
    }
    if (userId && order.userId === userId) {
      return { kind: 'order-owner', orderId: order.id, userId };
    }
    return { kind: 'order-guest', orderId: order.id };
  }

  async resolveGroupViewer(
    token: string,
    sessionToken: string | undefined,
  ): Promise<ChatViewer> {
    if (!sessionToken?.trim()) {
      throw new BadRequestException({
        message: 'Cần sessionToken để truy cập chat của đơn nhóm.',
        code: 'CHAT_SESSION_TOKEN_REQUIRED',
      });
    }
    const go = await this.prisma.groupOrder.findUnique({
      where: { token },
      select: { id: true, status: true },
    });
    if (!go) {
      throw new NotFoundException({
        message: 'Không tìm thấy đơn nhóm.',
        code: 'GROUP_ORDER_NOT_FOUND',
      });
    }
    if (go.status === 'completed' || go.status === 'cancelled') {
      throw new BadRequestException({
        message: 'Đơn nhóm đã kết thúc, không thể tiếp tục trò chuyện.',
        code: 'CHAT_GROUP_ORDER_CLOSED',
      });
    }
    const participant = await this.prisma.groupOrderParticipant.findFirst({
      where: { groupOrderId: go.id, sessionToken: sessionToken.trim() },
      select: {
        id: true,
        userId: true,
        guestName: true,
        user: { select: { name: true, avatar: true } },
      },
    });
    if (!participant) {
      throw new ForbiddenException({
        message: 'Phiên làm việc không hợp lệ.',
        code: 'GROUP_ORDER_SESSION_INVALID',
      });
    }
    return {
      kind: 'group-participant',
      groupOrderId: go.id,
      participantId: participant.id,
      userId: participant.userId,
      guestName: participant.user?.name ?? participant.guestName,
      avatar: participant.user?.avatar ?? null,
    };
  }

  // ── History ──────────────────────────────────────────────────────────

  async listMessages(
    kind: ChatRoomKind,
    id: string,
    opts: { limit?: number; beforeId?: string } = {},
  ): Promise<ChatMessagePage> {
    const limit = Math.min(
      Math.max(opts.limit ?? DEFAULT_PAGE_SIZE, 1),
      MAX_MESSAGES_PER_ROOM,
    );
    // Room bị cap ở 200 tin nên lấy toàn bộ rồi slice trong bộ nhớ vẫn rẻ —
    // tránh phải maintain thêm index structure trong Redis chỉ để phân trang.
    const all = await this.redis.lrange<ChatMessagePayload>(
      this.key(kind, id),
      0,
      -1,
    ); // oldest → newest

    let endIdx = all.length;
    if (opts.beforeId) {
      const idx = all.findIndex((m) => m.id === opts.beforeId);
      if (idx !== -1) endIdx = idx;
    }
    const startIdx = Math.max(0, endIdx - limit);
    const messages = all.slice(startIdx, endIdx);
    const hasMore = startIdx > 0;
    return { messages, hasMore };
  }

  // ── Send ─────────────────────────────────────────────────────────────

  async sendAsViewer(
    viewer: ChatViewer,
    content: string,
    type: 'text' | 'sticker' | 'image' = 'text',
  ): Promise<{ kind: ChatRoomKind; id: string; message: ChatMessagePayload }> {
    const trimmed = content.trim();
    this.validateContent(trimmed, type);

    let kind: ChatRoomKind;
    let id: string;
    let senderId: string;
    let senderType: ChatMessagePayload['senderType'];
    let displayName: string;
    let avatar: string | null = null;

    switch (viewer.kind) {
      case 'order-owner': {
        const user = await this.prisma.user.findUnique({
          where: { id: viewer.userId },
          select: { name: true, avatar: true },
        });
        kind = 'order';
        id = viewer.orderId;
        senderId = viewer.userId;
        senderType = 'customer';
        displayName = user?.name ?? 'Khách hàng';
        avatar = user?.avatar ?? null;
        break;
      }
      case 'order-guest': {
        kind = 'order';
        id = viewer.orderId;
        senderId = `guest:${viewer.orderId}`;
        senderType = 'guest';
        displayName = 'Khách';
        break;
      }
      case 'group-participant': {
        kind = 'group';
        id = viewer.groupOrderId;
        senderId = viewer.participantId;
        senderType = viewer.userId ? 'customer' : 'guest';
        displayName = viewer.guestName ?? 'Khách';
        avatar = viewer.avatar;
        break;
      }
    }

    const message: ChatMessagePayload = {
      id: randomUUID(),
      senderId,
      senderType,
      displayName,
      avatar,
      content: trimmed,
      type,
      createdAt: new Date().toISOString(),
    };

    await this.pushAndTouch(kind, id, message);
    return { kind, id, message };
  }

  private validateContent(
    trimmed: string,
    type: 'text' | 'sticker' | 'image',
  ): void {
    if (!trimmed) {
      throw new BadRequestException({
        message: 'Nội dung tin nhắn không được để trống.',
        code: 'CHAT_CONTENT_EMPTY',
      });
    }
    if (trimmed.length > 2000) {
      throw new BadRequestException({
        message: 'Tin nhắn quá dài (tối đa 2000 ký tự).',
        code: 'CHAT_CONTENT_TOO_LONG',
      });
    }
    if (type === 'sticker' || type === 'image') {
      // Không whitelist domain theo yêu cầu — chỉ đảm bảo là URL http(s) hợp lệ,
      // tránh lưu rác/script injection vào field content (vd: "javascript:...").
      if (!/^https?:\/\/\S+$/.test(trimmed)) {
        throw new BadRequestException({
          message: 'URL ảnh không hợp lệ.',
          code: 'CHAT_INVALID_MEDIA_URL',
        });
      }
    }
  }

  async sendAsStaff(
    kind: ChatRoomKind,
    id: string,
    content: string,
    type: 'text' | 'sticker' | 'image' = 'text',
  ): Promise<ChatMessagePayload> {
    const trimmed = content.trim();
    this.validateContent(trimmed, type);

    const message: ChatMessagePayload = {
      id: randomUUID(),
      senderId: 'staff',
      senderType: 'staff',
      displayName: 'UjCha',
      avatar: null,
      content: trimmed,
      type,
      createdAt: new Date().toISOString(),
    };

    await this.pushAndTouch(kind, id, message);
    return message;
  }

  private async pushAndTouch(
    kind: ChatRoomKind,
    id: string,
    message: ChatMessagePayload,
  ) {
    const key = this.key(kind, id);
    await this.redis.rpush(key, message, MAX_MESSAGES_PER_ROOM);
    await this.redis.expire(key, ROOM_SAFETY_TTL_SECONDS);
    await this.redis.zadd(
      ChatService.ACTIVE_ROOMS_KEY,
      Date.now(),
      `${kind}:${id}`,
    );

    if (message.type === 'image') {
      const imgKey = this.imagesKey(kind, id);
      await this.redis.rpush(imgKey, message.content, MAX_IMAGES_PER_ROOM);
      await this.redis.expire(imgKey, ROOM_SAFETY_TTL_SECONDS);
    }
  }

  // ── Đóng phòng ─────────────────────────────────────────────────────
  // Gọi khi: đơn thường completed/cancelled (OrderService/AdminOrderService),
  // VÀ — quan trọng — ngay khi group order CHỐT thành đơn thật
  // (GroupOrderService.checkoutHostPays / checkoutSplitCash), KHÔNG chờ tới
  // lúc group order tự chuyển sang "completed": từ thời điểm chốt đơn, cuộc
  // trò chuyện phải tiếp tục ở phòng "order" mới (host <-> staff) chứ không
  // phải phòng "group" cũ nữa, nên phòng group phải đóng ngay lúc đó.

  async closeRoom(kind: ChatRoomKind, id: string): Promise<void> {
    const imageUrls = await this.redis
      .lrange<string>(this.imagesKey(kind, id), 0, -1)
      .catch(() => [] as string[]);

    if (imageUrls.length > 0) {
      await this.uploadService.deleteByUrls(imageUrls).catch((err) => {
        this.logger.error(`Dọn ảnh chat thất bại (${kind}:${id}): ${err}`);
      });
    }
    await this.redis.zrem(ChatService.ACTIVE_ROOMS_KEY, `${kind}:${id}`);
    await this.redis.del(this.key(kind, id));
    await this.redis.del(this.imagesKey(kind, id))
    // Trước đây chỉ dọn Redis — client đang mở đúng phòng này (nếu có) sẽ
    // không biết gì cho tới khi tự F5 lại trang. Bắn 'room:closed' ngay để
    // FE tự khoá input / hiện banner "đã kết thúc" theo thời gian thực.
    this.gateway.notifyRoomClosed(kind, id);
  }

  async closeRoomForOrder(orderId: string): Promise<void> {
    await this.closeRoom('order', orderId);
  }

  async closeRoomForGroupOrder(groupOrderId: string): Promise<void> {
    await this.closeRoom('group', groupOrderId);
  }

  async closeRoomsForOrders(orderIds: string[]): Promise<void> {
    await Promise.all(orderIds.map((id) => this.closeRoomForOrder(id)));
  }

  // ── POS: danh sách phòng đang hoạt động ─────────────────────────────

  async listActiveRooms(limit = 100) {
    const members = await this.redis.zrevrange(
      ChatService.ACTIVE_ROOMS_KEY,
      0,
      limit - 1,
    );

    const result: Array<{
      kind: ChatRoomKind;
      id: string;
      lastMessage: ChatMessagePayload | null;
      paymentCode?: string;
      groupOrderToken?: string;
      customerName: string;
    }> = [];

    for (const m of members) {
      const separatorIdx = m.indexOf(':');
      const kind = m.slice(0, separatorIdx) as ChatRoomKind;
      const id = m.slice(separatorIdx + 1);

      const { messages } = await this.listMessages(kind, id);
      const lastMessage = messages[messages.length - 1] ?? null;

      if (kind === 'order') {
        const order = await this.prisma.order.findUnique({
          where: { id },
          select: {
            paymentCode: true,
            guestDeliveryName: true,
            user: { select: { name: true } },
          },
        });
        // Đơn đã bị xóa hẳn (admin xóa cứng) nhưng key Redis còn sót lại — bỏ qua và tự dọn key này.
        if (!order) {
          await this.closeRoom(kind, id);
          continue;
        }
        result.push({
          kind,
          id,
          lastMessage,
          paymentCode: order.paymentCode,
          customerName: order.user?.name ?? order.guestDeliveryName ?? 'Khách',
        });
      } else {
        const go = await this.prisma.groupOrder.findUnique({
          where: { id },
          select: { token: true, host: { select: { name: true } } },
        });
        if (!go) {
          await this.closeRoom(kind, id);
          continue;
        }
        result.push({
          kind,
          id,
          lastMessage,
          groupOrderToken: go.token,
          customerName: go.host?.name ?? 'Khách',
        });
      }
    }

    return result;
  }
}
