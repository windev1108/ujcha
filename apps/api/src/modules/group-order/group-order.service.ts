import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomBytes, randomUUID } from 'node:crypto';
import { GroupOrderStatus, OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { computeFinalPrice } from '../../helper/utils';
import { OrdersGateway } from '../events/orders.gateway';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import type {
  CreateGroupOrderDto,
  GroupOrderItemDto,
  JoinGroupOrderDto,
} from './dto/group-order.dto';

const GROUP_ORDER_CONFIG_KEY = 'kun:group-order:config';
const GROUP_ORDER_CONFIG_TTL = 60; // 60 seconds

function generateShortToken(): string {
  return randomBytes(9).toString('base64url').slice(0, 12);
}

@Injectable()
export class GroupOrderService {
  private readonly logger = new Logger(GroupOrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly ordersGateway: OrdersGateway,
    private readonly notificationService: NotificationService,
  ) { }

  private fullInclude() {
    return {
      participants: {
        include: {
          user: { select: { id: true, name: true, avatar: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, nameTranslation: true, imageUrls: true, price: true, optionGroups: true } },
            },
          },
        },
        orderBy: { joinedAt: 'asc' as const },
      },
      address: { select: { id: true, fullAddress: true } },
      table: { select: { id: true, name: true, area: true } },
      order: { select: { id: true, paymentCode: true, status: true } },
    };
  }

  private serialize(go: any) {
    return {
      id: go.id,
      token: go.token,
      status: go.status,
      paymentMode: go.paymentMode,
      paymentType: go.paymentType ?? 'cash',
      type: go.type,
      shippingFee: go.shippingFee ? Number(go.shippingFee) : 0,
      note: go.note,
      expiresAt: go.expiresAt,
      createdAt: go.createdAt,
      address: go.address,
      table: go.table,
      orderId: go.orderId,
      order: go.order,
      participants: go.participants.map((p: any) => {
        const subtotal = p.items.reduce((sum: number, item: any) => {
          const unit = Number(item.unitPrice);
          const toppings = Array.isArray(item.toppingsJson)
            ? (item.toppingsJson as any[]).reduce(
              (s: number, t: any) => s + Number(t.price ?? 0),
              0,
            )
            : 0;
          return sum + (unit + toppings) * item.quantity;
        }, 0);

        return {
          id: p.id,
          userId: p.userId,
          name: p.user?.name ?? p.guestName ?? 'Khach',
          avatar: p.user?.avatar ?? null,
          isHost: p.isHost,
          isReady: p.isReady,
          paymentStatus: p.paymentStatus,
          paymentType: p.paymentType,
          paymentQrToken: p.paymentQrToken,
          paidAt: p.paidAt,
          joinedAt: p.joinedAt,
          subtotal,
          items: p.items.map((item: any) => ({
            id: item.id,
            productId: item.productId,
            product: item.product,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            selectedOptions: item.selectedOptions,
            toppings: item.toppingsJson,
            note: item.note,
          })),
        };
      }),
    };
  }

  async create(hostUserId: string, dto: CreateGroupOrderDto) {
    // One active group order per host — return the existing one instead of creating a duplicate.
    const existing = await this.prisma.groupOrder.findFirst({
      where: { hostUserId, status: 'collecting', expiresAt: { gt: new Date() } },
      include: this.fullInclude(),
    });
    if (existing) {
      const hostParticipant = existing.participants.find((p) => p.isHost);
      if (dto.deviceId && hostParticipant && !(hostParticipant as any).deviceId) {
        await this.prisma.groupOrderParticipant.update({
          where: { id: hostParticipant.id },
          data: { deviceId: dto.deviceId },
        }).catch(() => {});
      }
      return {
        ...this.serialize(existing),
        hostSessionToken: hostParticipant?.sessionToken ?? '',
        hostParticipantId: hostParticipant?.id ?? null,
      };
    }

    const token = generateShortToken();
    const sessionToken = randomUUID();
    const cfg = await this.getConfig();
    const expiresAt = new Date(Date.now() + (cfg.expiryMinutes ?? 120) * 60 * 1000);

    const go = await this.prisma.groupOrder.create({
      data: {
        token,
        hostUserId,
        paymentMode: dto.paymentMode as any,
        type: dto.type as any,
        addressId: dto.addressId ?? null,
        tableId: dto.tableId ?? null,
        pickupTime: dto.pickupTime ? new Date(dto.pickupTime) : null,
        shippingFee: dto.shippingFee ? new Prisma.Decimal(dto.shippingFee) : new Prisma.Decimal(0),
        note: dto.note ?? null,
        expiresAt,
        participants: {
          create: {
            userId: hostUserId,
            sessionToken,
            isHost: true,
            deviceId: dto.deviceId ?? null,
          },
        },
      },
      include: this.fullInclude(),
    });

    const hostParticipant = go.participants.find((p) => p.isHost);
    return {
      ...this.serialize(go),
      hostSessionToken: sessionToken,
      hostParticipantId: hostParticipant?.id ?? null,
    };
  }

  async findByToken(token: string) {
    const go = await this.prisma.groupOrder.findUnique({
      where: { token },
      include: this.fullInclude(),
    });
    if (!go) throw new NotFoundException('Khong tim thay don nhom.');
    return this.serialize(go);
  }

  async findActiveByUser(userId: string) {
    const rows = await this.prisma.groupOrder.findMany({
      where: {
        hostUserId: userId,
        status: { notIn: ['completed', 'cancelled'] },
        expiresAt: { gt: new Date() },
      },
      select: {
        token: true,
        type: true,
        status: true,
        expiresAt: true,
        paymentMode: true,
        _count: { select: { participants: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      token: r.token,
      type: r.type,
      status: r.status,
      expiresAt: r.expiresAt.toISOString(),
      paymentMode: r.paymentMode,
      participantCount: r._count.participants,
    }));
  }

  async dissolveGroupOrder(token: string, sessionToken: string) {
    const go = await this.prisma.groupOrder.findUnique({
      where: { token },
      include: { participants: true },
    });
    if (!go) throw new NotFoundException('Không tìm thấy đơn nhóm.');
    if (go.status !== 'collecting') {
      throw new BadRequestException({ message: 'Chỉ có thể giải tán khi đơn nhóm đang thu thập.', code: 'GROUP_ORDER_NOT_COLLECTING' });
    }
    const host = go.participants.find((p) => p.isHost && p.sessionToken === sessionToken);
    if (!host) throw new ForbiddenException('Chỉ chủ nhóm mới có thể giải tán nhóm.');
    const updated = await this.prisma.groupOrder.update({
      where: { id: go.id },
      data: { status: GroupOrderStatus.cancelled },
      include: this.fullInclude(),
    });
    return this.serialize(updated);
  }

  async kickParticipant(token: string, sessionToken: string, participantId: string) {
    const go = await this.prisma.groupOrder.findUnique({
      where: { token },
      include: { participants: true },
    });
    if (!go) throw new NotFoundException('Không tìm thấy đơn nhóm.');
    if (go.status !== 'collecting') {
      throw new BadRequestException({ message: 'Chỉ có thể xóa thành viên khi đơn nhóm đang thu thập.', code: 'GROUP_ORDER_NOT_COLLECTING' });
    }
    const host = go.participants.find((p) => p.isHost && p.sessionToken === sessionToken);
    if (!host) throw new ForbiddenException('Chỉ chủ nhóm mới có thể xóa thành viên.');
    const target = go.participants.find((p) => p.id === participantId);
    if (!target) throw new NotFoundException('Không tìm thấy thành viên.');
    if (target.isHost) throw new ForbiddenException('Không thể xóa chủ nhóm.');
    await this.prisma.groupOrderParticipant.delete({ where: { id: participantId } });
    const updated = await this.findByToken(token);
    return { kicked: participantId, groupOrder: updated };
  }

  async join(token: string, userId: string | null, dto: JoinGroupOrderDto) {
    const go = await this.prisma.groupOrder.findUnique({
      where: { token },
      include: { participants: true },
    });
    if (!go) {
      throw new NotFoundException({ message: 'Không tìm thấy đơn nhóm.', code: 'GROUP_ORDER_NOT_FOUND' });
    }
    if (go.expiresAt < new Date()) {
      throw new BadRequestException({ message: 'Đơn nhóm đã hết hạn.', code: 'GROUP_ORDER_EXPIRED' });
    }
    if (go.status !== 'collecting') {
      throw new BadRequestException({ message: 'Đơn nhóm không còn nhận thành viên mới.', code: 'GROUP_ORDER_NOT_COLLECTING' });
    }

    // Logged-in user: return existing session if already joined
    if (userId) {
      const existing = go.participants.find((p) => p.userId === userId);
      if (existing) {
        if (dto.deviceId && !(existing as any).deviceId) {
          await this.prisma.groupOrderParticipant.update({
            where: { id: existing.id },
            data: { deviceId: dto.deviceId },
          }).catch(() => {});
        }
        return { sessionToken: existing.sessionToken, participantId: existing.id, alreadyJoined: true };
      }
    }

    // Anti-cheat: block same device from joining twice
    if (dto.deviceId) {
      const sameDevice = go.participants.find((p) => (p as any).deviceId === dto.deviceId);
      if (sameDevice) {
        throw new ConflictException({
          message: 'Thiết bị này đã tham gia đơn nhóm.',
          code: 'GROUP_ORDER_DEVICE_ALREADY_JOINED',
        });
      }
    }

    const sessionToken = randomUUID();
    const newParticipant = await this.prisma.groupOrderParticipant.create({
      data: {
        groupOrderId: go.id,
        userId: userId ?? null,
        guestName: !userId ? (dto.guestName?.trim() || 'Khách') : null,
        sessionToken,
        isHost: false,
        deviceId: dto.deviceId ?? null,
      },
    });

    return { sessionToken, participantId: newParticipant.id, alreadyJoined: false };
  }

  async updateItems(token: string, sessionToken: string, items: GroupOrderItemDto[]) {
    const { go, participant } = await this.resolveParticipant(token, sessionToken);

    if (go.status !== 'collecting') {
      throw new BadRequestException('Khong the cap nhat mon khi don da khoa.');
    }

    for (const item of items) {
      if (item.quantity < 0) continue;
      const product = await this.prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) {
        throw new BadRequestException(`San pham khong ton tai: ${item.productId}`);
      }
      if (!product.isAvailable || product.isSoldOut) {
        throw new BadRequestException(`San pham khong con phuc vu: ${product.name}`);
      }
    }

    const globalDiscount = await this.getGlobalDiscount();

    await this.prisma.$transaction(async (tx) => {
      await tx.groupOrderParticipantItem.deleteMany({
        where: { participantId: participant.id },
      });

      const validItems = items.filter((i) => i.quantity > 0);
      if (validItems.length > 0) {
        for (const item of validItems) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) continue;
          const effectiveDiscount = globalDiscount > 0 ? globalDiscount : (product.discountPercent ?? 0);
          const finalUnitPrice = computeFinalPrice(product.price, effectiveDiscount);
          await tx.groupOrderParticipantItem.create({
            data: {
              participantId: participant.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: new Prisma.Decimal(finalUnitPrice),
              selectedOptions: item.selectedOptions ?? {},
              toppingsJson: (item.toppings ?? []) as any,
              note: item.note ?? null,
            },
          });
        }
      }

      await tx.groupOrderParticipant.update({
        where: { id: participant.id },
        data: { isReady: false },
      });
    });

    const updated = await this.prisma.groupOrder.findUnique({
      where: { token },
      include: this.fullInclude(),
    });
    return this.serialize(updated!);
  }

  async markReady(token: string, sessionToken: string) {
    const { participant } = await this.resolveParticipant(token, sessionToken);

    await this.prisma.groupOrderParticipant.update({
      where: { id: participant.id },
      data: { isReady: true },
    });

    const updated = await this.prisma.groupOrder.findUnique({
      where: { token },
      include: this.fullInclude(),
    });
    return this.serialize(updated!);
  }

  async lock(token: string, sessionToken: string) {
    const { go, participant } = await this.resolveParticipant(token, sessionToken);

    if (!participant.isHost) {
      throw new ForbiddenException('Chi chu nhom moi co the khoa don.');
    }
    if (go.status !== 'collecting') {
      throw new BadRequestException('Don nhom khong o trang thai thu thap.');
    }

    await this.prisma.groupOrder.update({
      where: { token },
      data: { status: GroupOrderStatus.locked },
    });

    const updated = await this.prisma.groupOrder.findUnique({
      where: { token },
      include: this.fullInclude(),
    });
    return this.serialize(updated!);
  }

  async checkoutHostPays(token: string, sessionToken: string, paymentType: string) {
    const { go, participant } = await this.resolveParticipant(token, sessionToken);

    if (!participant.isHost) {
      throw new ForbiddenException('Chi chu nhom moi co the thanh toan.');
    }
    if (go.status !== 'locked') {
      throw new BadRequestException('Don nhom phai duoc khoa truoc khi thanh toan.');
    }
    if (go.paymentMode !== 'host_pays') {
      throw new BadRequestException('Don nhom nay khong phai che do host tra.');
    }

    const goFull = await this.prisma.groupOrder.findUnique({
      where: { token },
      include: {
        participants: {
          include: { items: true },
        },
      },
    });

    const order = await this.createFinalOrder(goFull!, paymentType as any);

    await this.prisma.groupOrder.update({
      where: { token },
      data: { status: GroupOrderStatus.completed, orderId: order.id },
    });

    const updated = await this.prisma.groupOrder.findUnique({
      where: { token },
      include: this.fullInclude(),
    });
    return { groupOrder: this.serialize(updated!), order };
  }

  async initHostBankTransfer(token: string, sessionToken: string) {
    const { go, participant } = await this.resolveParticipant(token, sessionToken);

    if (!participant.isHost) throw new ForbiddenException('Chi chu nhom moi co the khoi tao thanh toan.');
    if (go.status !== GroupOrderStatus.locked) throw new BadRequestException('Don nhom phai duoc khoa truoc khi thanh toan.');
    if (go.paymentMode !== 'host_pays') throw new BadRequestException('Chi ap dung cho don nhom chu tra.');
    if ((go as any).paymentType !== 'bank_transfer') throw new BadRequestException('Chi ap dung cho thanh toan chuyen khoan.');

    if (!(participant as any).paymentQrToken) {
      await this.prisma.groupOrderParticipant.update({
        where: { id: participant.id },
        data: { paymentQrToken: randomUUID() } as any,
      });
    }

    const updated = await this.prisma.groupOrder.findUnique({
      where: { token },
      include: this.fullInclude(),
    });
    return this.serialize(updated!);
  }

  async initSplitPayment(token: string, sessionToken: string, paymentType: string) {
    const { go, participant } = await this.resolveParticipant(token, sessionToken);

    if (go.status !== 'locked') {
      throw new BadRequestException('Don nhom phai duoc khoa de xac nhan thanh toan.');
    }
    if (go.paymentMode !== 'split') {
      throw new BadRequestException('Don nhom nay khong phai che do chia tien.');
    }

    const updateData: any = {
      paymentType: paymentType as any,
    };

    if (paymentType === 'bank_transfer') {
      updateData.paymentQrToken = randomUUID();
    }

    await this.prisma.groupOrderParticipant.update({
      where: { id: participant.id },
      data: updateData,
    });

    const updated = await this.prisma.groupOrder.findUnique({
      where: { token },
      include: this.fullInclude(),
    });
    return this.serialize(updated!);
  }

  async confirmParticipantPaid(token: string, participantId: string, sessionToken: string) {
    const { go, participant: actor } = await this.resolveParticipant(token, sessionToken);

    if (go.status !== 'locked') {
      throw new BadRequestException('Don nhom phai duoc khoa de xac nhan thanh toan.');
    }

    const isConfirmingSelf = actor.id === participantId;
    const isHostConfirming = actor.isHost;

    if (!isConfirmingSelf && !isHostConfirming) {
      throw new ForbiddenException('Ban khong co quyen xac nhan thanh toan cua nguoi khac.');
    }

    const target = await this.prisma.groupOrderParticipant.findUnique({
      where: { id: participantId },
    });
    if (!target || target.groupOrderId !== go.id) {
      throw new NotFoundException('Khong tim thay thanh vien.');
    }

    // Bank transfer confirmations must come through the payment webhook, not manually
    if (target.paymentType === 'bank_transfer') {
      throw new BadRequestException('Chuyen khoan duoc xac nhan tu dong khi nhan tien.');
    }

    await this.prisma.groupOrderParticipant.update({
      where: { id: participantId },
      data: {
        paymentStatus: 'paid',
        paidAt: new Date(),
      },
    });

    const goCheck = await this.prisma.groupOrder.findUnique({
      where: { token },
      include: {
        participants: { include: { items: true } },
      },
    });

    const withItems = goCheck!.participants.filter((p) => p.items.length > 0);
    const allPaid = withItems.every((p) => p.paymentStatus === 'paid');

    if (allPaid) {
      const firstParticipant = goCheck!.participants.find((p) => p.paymentType != null);
      const paymentType = firstParticipant?.paymentType ?? 'cash';
      // Cash is collected by the shipper on delivery — order stays unpaid until then
      const order = await this.createFinalOrder(goCheck!, paymentType as any, false);
      await this.prisma.groupOrder.update({
        where: { token },
        data: { status: GroupOrderStatus.completed, orderId: order.id },
      });
    }

    const updated = await this.prisma.groupOrder.findUnique({
      where: { token },
      include: this.fullInclude(),
    });
    return this.serialize(updated!);
  }

  async unlock(token: string, sessionToken: string) {
    const { go, participant } = await this.resolveParticipant(token, sessionToken);

    if (!participant.isHost) {
      throw new ForbiddenException('Chi chu nhom moi co the mo khoa.');
    }
    if (go.status !== GroupOrderStatus.locked) {
      throw new BadRequestException('Don nhom chua duoc khoa.');
    }

    await this.prisma.groupOrder.update({
      where: { token },
      data: { status: GroupOrderStatus.collecting },
    });

    const updated = await this.prisma.groupOrder.findUnique({
      where: { token },
      include: this.fullInclude(),
    });
    return this.serialize(updated!);
  }

  async setFulfillment(
    token: string,
    sessionToken: string,
    dto: { type: string; addressId?: string; tableId?: string; pickupTime?: string; shippingFee?: number; paymentType?: string },
  ) {
    const { go, participant } = await this.resolveParticipant(token, sessionToken);

    if (!participant.isHost) {
      throw new ForbiddenException('Chi chu nhom moi co the thiet lap giao hang.');
    }
    if (go.status !== GroupOrderStatus.collecting) {
      throw new BadRequestException('Chi co the thiet lap khi don nhom dang o trang thai thu thap.');
    }

    const data: any = {
      type: dto.type,
      shippingFee: new Prisma.Decimal(dto.shippingFee ?? 0),
      addressId: null,
      tableId: null,
      pickupTime: null,
      ...(dto.paymentType ? { paymentType: dto.paymentType } : {}),
    };

    if (dto.type === 'delivery' && dto.addressId) {
      const addr = await this.prisma.address.findUnique({ where: { id: dto.addressId } });
      if (!addr) throw new BadRequestException('Dia chi khong ton tai.');
      data.addressId = dto.addressId;
    }
    if (dto.type === 'table' && dto.tableId) {
      data.tableId = dto.tableId;
    }
    if (dto.type === 'pickup' && dto.pickupTime) {
      data.pickupTime = new Date(dto.pickupTime);
    }

    await this.prisma.groupOrder.update({
      where: { token },
      data,
    });

    const updated = await this.prisma.groupOrder.findUnique({
      where: { token },
      include: this.fullInclude(),
    });
    return this.serialize(updated!);
  }

  private async getGlobalDiscount(): Promise<number> {
    try {
      const cached = await this.redis.get<number>('kun:shop:globalDiscount');
      if (cached !== null) return cached;
      const settings = await this.prisma.shopSettings.findFirst();
      return settings?.globalDiscountPercent ?? 0;
    } catch {
      return 0;
    }
  }

  async getConfig() {
    const cached = await this.redis.get<ReturnType<typeof this._serializeConfig>>(GROUP_ORDER_CONFIG_KEY);
    if (cached) return cached;

    const cfg = await this.prisma.groupOrderConfig.findUnique({ where: { id: 'default' } });
    const result = cfg
      ? this._serializeConfig(cfg)
      : { id: 'default', isEnabled: true, expiryMinutes: 120, discountTiers: [] as unknown[] };

    await this.redis.set(GROUP_ORDER_CONFIG_KEY, result, GROUP_ORDER_CONFIG_TTL);
    return result;
  }

  async updateConfig(data: {
    isEnabled?: boolean;
    expiryMinutes?: number;
    discountTiers?: Array<{ minParticipants: number; discountPercent: number }>;
  }) {
    const updateData: any = { updatedAt: new Date() };
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;
    if (data.expiryMinutes !== undefined) updateData.expiryMinutes = Math.max(5, data.expiryMinutes);
    if (data.discountTiers !== undefined) {
      updateData.discountTiersJson = [...data.discountTiers].sort(
        (a, b) => b.minParticipants - a.minParticipants,
      );
    }

    const cfg = await this.prisma.groupOrderConfig.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        isEnabled: data.isEnabled ?? true,
        expiryMinutes: data.expiryMinutes ?? 120,
        discountTiersJson: updateData.discountTiersJson ?? [],
      },
      update: updateData,
    });

    await this.redis.del(GROUP_ORDER_CONFIG_KEY);
    return this._serializeConfig(cfg);
  }

  private _serializeConfig(cfg: { id: string; isEnabled: boolean; expiryMinutes: number; discountTiersJson: unknown }) {
    return {
      id: cfg.id,
      isEnabled: cfg.isEnabled,
      expiryMinutes: cfg.expiryMinutes,
      discountTiers: Array.isArray(cfg.discountTiersJson) ? cfg.discountTiersJson : [],
    };
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanupExpiredGroupOrders() {
    const deleted = await this.prisma.groupOrder.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
        status: { in: [GroupOrderStatus.collecting, GroupOrderStatus.locked] },
      },
    });
    if (deleted.count > 0) {
      this.logger.log(`Cleaned up ${deleted.count} expired group order(s).`);
    }
  }

  private async resolveGroupDiscount(participantCount: number): Promise<number> {
    const cfg = await this.prisma.groupOrderConfig.findUnique({ where: { id: 'default' } });
    if (!cfg || !cfg.isEnabled) return 0;
    const tiers = Array.isArray(cfg.discountTiersJson)
      ? (cfg.discountTiersJson as Array<{ minParticipants: number; discountPercent: number }>)
      : [];
    const sorted = [...tiers].sort((a, b) => b.minParticipants - a.minParticipants);
    const match = sorted.find((t) => participantCount >= t.minParticipants);
    return match?.discountPercent ?? 0;
  }

  async autoConfirmParticipantPaid(participantId: string): Promise<{ token: string; state: ReturnType<typeof this.serialize> } | null> {
    const participant = await this.prisma.groupOrderParticipant.findUnique({
      where: { id: participantId },
      select: { id: true, paymentStatus: true, groupOrderId: true },
    });
    if (!participant || (participant.paymentStatus as string) === 'paid') return null;

    const groupOrder = await this.prisma.groupOrder.findUnique({
      where: { id: participant.groupOrderId },
      select: { token: true },
    });
    if (!groupOrder) return null;
    const { token } = groupOrder;

    await this.prisma.groupOrderParticipant.update({
      where: { id: participantId },
      data: { paymentStatus: 'paid' as any, paidAt: new Date() },
    });

    const goCheck = await this.prisma.groupOrder.findUnique({
      where: { token },
      include: { participants: { include: { items: true } } },
    });
    if (!goCheck) return null;

    const shouldCreateOrder = (() => {
      if (goCheck.status !== GroupOrderStatus.locked) return false;
      if ((goCheck as any).paymentMode === 'host_pays') {
        // Host pays for all — create order when the host's payment is confirmed
        return goCheck.participants.some((p) => p.id === participantId && p.isHost);
      }
      // Split: create order when every participant with items has paid
      const withItems = goCheck.participants.filter((p) => p.items.length > 0);
      return withItems.every((p) => (p.paymentStatus as string) === 'paid');
    })();

    if (shouldCreateOrder) {
      const pt = goCheck.participants.find((p) => p.paymentType != null)?.paymentType ?? 'cash';
      const order = await this.createFinalOrder(goCheck, pt as any, true);
      await this.prisma.groupOrder.update({
        where: { token },
        data: { status: GroupOrderStatus.completed, orderId: order.id },
      });
    }

    const updated = await this.prisma.groupOrder.findUnique({
      where: { token },
      include: this.fullInclude(),
    });
    return { token, state: this.serialize(updated!) };
  }

  private async createFinalOrder(
    go: any,
    paymentType: 'cash' | 'bank_transfer',
    alreadyPaid = false,
  ) {
    let totalAmount = new Prisma.Decimal(0);

    const orderItemsData: Prisma.OrderItemCreateManyOrderInput[] = [];

    for (const participant of go.participants) {
      for (const item of participant.items) {
        const toppings = Array.isArray(item.toppingsJson) ? item.toppingsJson : [];
        const toppingSum = toppings.reduce((s: number, t: any) => s + Number(t.price ?? 0), 0);
        const unitPrice = new Prisma.Decimal(item.unitPrice).add(new Prisma.Decimal(toppingSum));
        const lineTotal = unitPrice.mul(item.quantity);
        totalAmount = totalAmount.add(lineTotal);

        orderItemsData.push({
          productId: item.productId,
          quantity: item.quantity,
          price: unitPrice,
          extrasJson: item.toppingsJson ?? [],
          optionsJson: item.selectedOptions ?? {},
          optionDetailsJson: [],
          note: item.note ?? null,
        });
      }
    }

    const activeParticipants = go.participants.filter((p: any) => p.items.length > 0);
    const discountPercent = await this.resolveGroupDiscount(activeParticipants.length);
    const discountAmount =
      discountPercent > 0
        ? totalAmount
          .mul(new Prisma.Decimal(discountPercent))
          .div(new Prisma.Decimal(100))
          .toDecimalPlaces(0)
        : new Prisma.Decimal(0);

    const shippingFee = new Prisma.Decimal(go.shippingFee ?? 0);
    const finalAmount = totalAmount.sub(discountAmount).add(shippingFee);
    const paymentCode = await this.generateOrderPaymentCode();

    const order = await this.prisma.order.create({
      data: {
        userId: go.hostUserId ?? null,
        type: go.type,
        addressId: go.addressId ?? null,
        tableId: go.tableId ?? null,
        pickupTime: go.pickupTime ?? null,
        totalAmount,
        discountAmount,
        pointDiscountAmount: new Prisma.Decimal(0),
        finalAmount,
        shippingFee,
        status: OrderStatus.pending,
        paymentStatus: alreadyPaid ? PaymentStatus.paid : PaymentStatus.pending,
        paidAt: alreadyPaid ? new Date() : null,
        paymentType: paymentType as any,
        paymentCode,
        items: { createMany: { data: orderItemsData } },
      },
    });

    this.ordersGateway.emitOrderCreated({ orderId: order.id, type: order.type });

    void this.notifyGroupOrderCreated(go.participants, order.id, paymentCode).catch((err: unknown) =>
      this.logger.error(`Group order notification failed: ${err}`),
    );

    return { ...order, discountPercent };
  }

  private async notifyGroupOrderCreated(
    participants: Array<{ userId: string | null; items: unknown[] }>,
    orderId: string,
    paymentCode: string,
  ) {
    const userIds = participants
      .filter((p) => p.userId != null && p.items.length > 0)
      .map((p) => p.userId!);

    await Promise.allSettled(
      userIds.map((userId) =>
        this.notificationService.createAndEmit({
          userId,
          type: 'order',
          title: 'Đơn nhóm đã được đặt',
          content: `Đơn nhóm đã được đặt thành công! Mã đơn: #${paymentCode}`,
          data: { orderId, paymentCode, notifKey: 'group_order_placed' },
        }),
      ),
    );
  }

  async checkoutSplitCash(token: string, sessionToken: string) {
    const { go, participant } = await this.resolveParticipant(token, sessionToken);

    if (!participant.isHost) throw new ForbiddenException('Chi chu nhom moi co the dat don.');
    if (go.status !== GroupOrderStatus.collecting && go.status !== GroupOrderStatus.locked) {
      throw new BadRequestException('Don nhom khong o trang thai hop le.');
    }
    if ((go as any).paymentMode !== 'split') throw new BadRequestException('Chi ap dung cho don nhom chia tien.');
    if ((go as any).paymentType !== null && (go as any).paymentType !== 'cash') {
      throw new BadRequestException('Chi ap dung cho phuong thuc tien mat.');
    }

    const goFull = await this.prisma.groupOrder.findUnique({
      where: { token },
      include: { participants: { include: { items: true } } },
    });

    const withItems = goFull!.participants.filter((p: any) => p.items.length > 0);
    if (withItems.length === 0) throw new BadRequestException('Chua co mon nao duoc chon.');

    // Lock (if still collecting) + mark all participants as cash/paid atomically
    const lockOp = go.status === GroupOrderStatus.collecting
      ? [this.prisma.groupOrder.update({ where: { token }, data: { status: GroupOrderStatus.locked } })]
      : [];

    await this.prisma.$transaction([
      ...lockOp,
      ...withItems.map((p: any) =>
        this.prisma.groupOrderParticipant.update({
          where: { id: p.id },
          data: { paymentType: 'cash' as any, paymentStatus: 'paid' as any, paidAt: new Date() },
        }),
      ),
    ]);

    // Re-fetch with updated payment fields for createFinalOrder
    const goForOrder = await this.prisma.groupOrder.findUnique({
      where: { token },
      include: { participants: { include: { items: true } } },
    });

    // Cash delivery: shipper collects on arrival → paymentStatus = pending on the Order
    const order = await this.createFinalOrder(goForOrder!, 'cash', false);

    await this.prisma.groupOrder.update({
      where: { token },
      data: { status: GroupOrderStatus.completed, orderId: order.id },
    });

    const updated = await this.prisma.groupOrder.findUnique({
      where: { token },
      include: this.fullInclude(),
    });
    return { groupOrder: this.serialize(updated!), order };
  }

  private async generateOrderPaymentCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = `UJCHA-${randomBytes(4).toString('hex').toUpperCase()}`;
      const clash = await this.prisma.order.findUnique({ where: { paymentCode: code } });
      if (!clash) return code;
    }
    throw new InternalServerErrorException('Could not generate unique payment code.');
  }

  private async resolveParticipant(token: string, sessionToken: string) {
    const go = await this.prisma.groupOrder.findUnique({
      where: { token },
      include: { participants: true },
    });
    if (!go) {
      throw new NotFoundException({ message: 'Không tìm thấy đơn nhóm.', code: 'GROUP_ORDER_NOT_FOUND' });
    }

    const participant = go.participants.find((p) => p.sessionToken === sessionToken);
    if (!participant) {
      throw new ForbiddenException({ message: 'Phiên làm việc không hợp lệ.', code: 'GROUP_ORDER_SESSION_INVALID' });
    }

    return { go, participant };
  }
}
