import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  OrderStatus,
  OrderType,
  PaymentStatus,
  PaymentType,
  PointSource,
  PointTransactionType,
  Prisma,
} from '@prisma/client';
import { PointOrderRewardService } from '../point/point-order-reward.service';
import { PointService } from '../point/point.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReferralRewardProcessingService } from '../referral/referral-reward-processing.service';
import type { CreateOrderDto } from './dto/create-order.dto';
import type { CreateOrderItemDto } from './dto/create-order-item.dto';
import type { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { NotificationService } from '../notification/notification.service';
import { OrderValidationService } from './order-validation.service';

export type OrderDetail = Prisma.OrderGetPayload<{
  include: {
    items: { include: { product: { select: { id: true; name: true; nameTranslation: true; imageUrls: true } } } };
    address: true;
    table: true;
    shipper: { select: { id: true; name: true; phone: true } };
    user: { select: { name: true; phone: true } };
  };
}>;

/** Mở rộng voucher / referral: thêm mã, rule resolve → discountAmount. */
export interface OrderDiscountContext {
  userId: string | null;
  totalAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  finalAmount: Prisma.Decimal;
}

/** Catalog JSON: giá trị là string (legacy) hoặc { label, priceDelta, nameTranslation? }. */
function parseOptionCatalogValue(
  v: unknown,
): { label: string; priceDelta: number; nameTranslation?: Record<string, string> } | null {
  if (typeof v === 'string') {
    const label = v.trim();
    return label ? { label, priceDelta: 0 } : null;
  }
  if (v && typeof v === 'object' && 'label' in v) {
    const label = String((v as { label?: unknown }).label ?? '').trim();
    if (!label) return null;
    const raw = (v as { priceDelta?: unknown }).priceDelta;
    let priceDelta = 0;
    if (raw !== undefined && raw !== null && raw !== '') {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) priceDelta = n;
    }
    const nt = (v as { nameTranslation?: unknown }).nameTranslation;
    const nameTranslation =
      nt && typeof nt === 'object' && !Array.isArray(nt)
        ? (nt as Record<string, string>)
        : undefined;
    return { label, priceDelta, nameTranslation };
  }
  return null;
}

/**
 * Cộng phụ phí tuỳ chọn nhóm (size, v.v.), bắt buộc đủ lựa chọn theo catalog.
 */
function validateOptionsAndSurcharge(
  optionGroupsJson: unknown,
  options: Record<string, string> | undefined,
): {
  surcharge: Prisma.Decimal;
  normalized: Record<string, string>;
  details: Array<{ group: string; label: string; priceDelta: number; nameTranslation?: Record<string, string> }>;
} {
  const normalized: Record<string, string> = {};
  const details: Array<{ group: string; label: string; priceDelta: number; nameTranslation?: Record<string, string> }> = [];
  let surcharge = new Prisma.Decimal(0);
  const groups = Array.isArray(optionGroupsJson) ? optionGroupsJson : [];
  const opts =
    options && typeof options === 'object' && !Array.isArray(options)
      ? options
      : {};

  for (const g of groups) {
    if (!g || typeof g !== 'object') continue;
    const name = String((g as { name?: unknown }).name ?? '').trim();
    if (!name) continue;
    const rawVals = (g as { values?: unknown }).values;
    if (!Array.isArray(rawVals) || rawVals.length === 0) continue;

    const sel = opts[name];
    if (sel === undefined || sel === null || String(sel).trim() === '') {
      throw new BadRequestException({
        message: `Thiếu tuỳ chọn «${name}».`,
        code: 'ORDER_OPTIONS_INCOMPLETE',
      });
    }
    const selTrim = String(sel).trim();
    let matched: { label: string; priceDelta: number; nameTranslation?: Record<string, string> } | null = null;
    for (const rv of rawVals) {
      const parsed = parseOptionCatalogValue(rv);
      if (!parsed) continue;
      if (parsed.label.trim() === selTrim.trim()) {
        matched = parsed;
        break;
      }
    }
    if (!matched) {
      throw new BadRequestException({
        message: `Giá trị tuỳ chọn không hợp lệ cho «${name}».`,
        code: 'ORDER_OPTIONS_INVALID',
      });
    }

    surcharge = surcharge.add(new Prisma.Decimal(matched.priceDelta));
    normalized[name] = selTrim;

    // ← Lưu snapshot đầy đủ để audit sau
    details.push({
      group: name,
      label: selTrim,
      priceDelta: matched.priceDelta,
      ...(matched.nameTranslation ? { nameTranslation: matched.nameTranslation } : {}),
    });
  }

  return { surcharge, normalized, details };
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderValidation: OrderValidationService,
    private readonly pointOrderReward: PointOrderRewardService,
    private readonly pointService: PointService,
    private readonly referralRewardProcessing: ReferralRewardProcessingService,
    private readonly notificationService: NotificationService,
  ) { }

  calculateTotal(items: CreateOrderItemDto[]): Prisma.Decimal {
    let sum = new Prisma.Decimal(0);
    for (const line of items) {
      const unit = new Prisma.Decimal(line.price);
      sum = sum.add(unit.mul(line.quantity));
    }
    return sum;
  }

  private priceTolerance(): Prisma.Decimal {
    return new Prisma.Decimal('0.05');
  }

  /**
   * Chuẩn hoá đơn giá từ DB (sản phẩm + topping + phụ phí tuỳ chọn nhóm), kiểm tra khớp với giá client (POS).
   */
  private async buildOrderItemRows(items: CreateOrderItemDto[], skipOptionValidation = false) {
    const rows: Array<{
      productId: string;
      quantity: number;
      price: Prisma.Decimal;
      extrasJson: Prisma.JsonValue;
      optionsJson: Prisma.JsonValue;
      // Thêm field mới để lưu snapshot đầy đủ cho audit
      optionDetailsJson: Prisma.JsonValue;
      note: string | null;
    }> = [];

    for (const item of items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });
      if (!product) {
        throw new BadRequestException({
          message: `Sản phẩm không tồn tại (id: ${item.productId}).`,
          code: 'ORDER_PRODUCT_NOT_FOUND',
        });
      }
      if (!product.isAvailable || product.isSoldOut) {
        throw new BadRequestException({
          message: `Sản phẩm «${product.name}» hiện không bán.`,
          code: 'ORDER_PRODUCT_UNAVAILABLE',
        });
      }

      // ── Base price từ DB ─────────────────────────────────────────────────
      let unit = new Prisma.Decimal(product.price);

      // ── Extras (toppings) — validated against product's inline toppings ───
      const extrasSnap: { toppingId: string; name: string; price: number; nameTranslation: Record<string, string> }[] = [];
      const productToppings = Array.isArray(product.toppings) ? product.toppings as any[] : [];

      for (const ex of item.extras ?? []) {
        const t = productToppings.find(
          (pt: any) => pt.id === ex.toppingId && pt.isActive !== false,
        );
        if (!t) {
          throw new BadRequestException({
            message: 'Topping không tồn tại hoặc đã tắt.',
            code: 'ORDER_TOPPING_INVALID',
          });
        }
        unit = unit.add(new Prisma.Decimal(Number(t.price)));
        extrasSnap.push({ toppingId: t.id, name: t.name, price: Number(t.price), nameTranslation: (t as any).nameTranslation ?? ex.nameTranslation ?? {} });
      }

      // optionGroups is now fully inline — no DB lookup needed
      const optionGroupsResolved = Array.isArray(product.optionGroups)
        ? product.optionGroups as any[]
        : [];

      // ── Options — BE tự tính priceDelta, lưu snapshot đầy đủ ────────────
      const {
        surcharge: optionSurcharge,
        normalized: optionsNormalized,
        details: optionDetails,
      } = skipOptionValidation
          ? { surcharge: new Prisma.Decimal(0), normalized: {} as Record<string, string>, details: [] as { group: string; label: string; priceDelta: number; nameTranslation?: Record<string, string> }[] }
          : validateOptionsAndSurcharge(optionGroupsResolved, item.options);
      unit = unit.add(optionSurcharge);

      // Merge client-provided nameTranslation as fallback for option values the product record may lack.
      if (item.optionTranslations) {
        for (const d of optionDetails) {
          if (!d.nameTranslation && item.optionTranslations[d.group]) {
            d.nameTranslation = item.optionTranslations[d.group];
          }
        }
      }

      const noteTrim = item.note?.trim()
        ? item.note.trim().slice(0, 500)
        : null;

      rows.push({
        productId: item.productId,
        quantity: item.quantity,
        price: unit, // ← giá BE tính: base + extras + optionSurcharge
        extrasJson: extrasSnap,
        optionsJson: optionsNormalized,
        optionDetailsJson: optionDetails, // ← snapshot đầy đủ cho audit
        note: noteTrim,
      });
    }

    return rows;
  }
  /**
   * Áp giảm giá tuyến tính. Sau này: gọi từ pipeline voucher (context đầy đủ hơn `OrderDiscountContext`).
   */
  applyDiscount(
    totalAmount: Prisma.Decimal,
    discountAmount: number,
  ): Prisma.Decimal {
    const disc = new Prisma.Decimal(discountAmount);
    if (disc.lessThan(0)) {
      throw new BadRequestException({
        message: 'discountAmount không được âm.',
        code: 'ORDER_DISCOUNT_NEGATIVE',
      });
    }
    let final = totalAmount.sub(disc);
    if (final.lessThan(0)) {
      final = new Prisma.Decimal(0);
    }
    return final;
  }

  async createOrder(
    userId: string | null,
    dto: CreateOrderDto,
    options?: {
      skipPickupLead?: boolean;
      /** Chỉ gọi từ admin POS — gán paid/pending lúc tạo đơn. */
      initialPaymentStatus?: PaymentStatus;
      /** Bỏ qua validate option groups — dùng cho đơn external (GrabFood, ShopeeFood). */
      skipOptionValidation?: boolean;
    },
  ): Promise<OrderDetail> {
    if (!dto.items.length) {
      throw new BadRequestException({
        message: 'Đơn phải có ít nhất một dòng hàng.',
        code: 'ORDER_ITEMS_EMPTY',
      });
    }

    this.orderValidation.assertCreateOrderTypeRules(dto);

    const pickupDate =
      dto.type === OrderType.pickup && dto.pickupTime
        ? new Date(dto.pickupTime)
        : null;

    if (dto.type === OrderType.pickup && pickupDate) {
      if (Number.isNaN(pickupDate.getTime())) {
        throw new BadRequestException({
          message: 'pickupTime không hợp lệ.',
          code: 'ORDER_PICKUP_TIME_INVALID',
        });
      }
      this.orderValidation.assertPickupWindow(pickupDate, new Date(), {
        skipMinLead: options?.skipPickupLead === true,
      });
    }

    const MAX_SAVED_ADDRESSES = 3;

    if (dto.type === OrderType.delivery) {
      if (userId) {
        const hasAddressId = !!dto.addressId?.trim();
        const hasInline = !!dto.inlineAddress;
        if (!hasAddressId && !hasInline) {
          throw new BadRequestException({
            message: 'Đơn gắn khách cần addressId hoặc inlineAddress.',
            code: 'ORDER_DELIVERY_ADDRESS_REQUIRED',
          });
        }
        if (hasAddressId && hasInline) {
          throw new BadRequestException({
            message: 'Không dùng cùng lúc addressId và inlineAddress.',
            code: 'ORDER_DELIVERY_ADDRESS_CONFLICT',
          });
        }
        if (dto.guestDeliveryAddress?.trim()) {
          throw new BadRequestException({
            message: 'Không kết hợp addressId/inlineAddress với guestDeliveryAddress.',
            code: 'ORDER_DELIVERY_ADDRESS_CONFLICT',
          });
        }
        if (hasAddressId) {
          const addr = await this.prisma.address.findFirst({
            where: { id: dto.addressId!, userId },
          });
          if (!addr) {
            throw new BadRequestException({
              message: 'Địa chỉ không tồn tại hoặc không thuộc tài khoản.',
              code: 'ORDER_ADDRESS_INVALID',
            });
          }
        }
      } else {
        if (!dto.guestDeliveryAddress?.trim()) {
          throw new BadRequestException({
            message: 'Giao hàng không tài khoản cần guestDeliveryAddress.',
            code: 'ORDER_GUEST_DELIVERY_ADDRESS_REQUIRED',
          });
        }
        if (dto.addressId?.trim()) {
          throw new BadRequestException({
            message:
              'Đơn không gắn tài khoản không dùng addressId — nhập guestDeliveryAddress.',
            code: 'ORDER_DELIVERY_ADDRESS_ID_WITHOUT_USER',
          });
        }
      }
    }

    if (dto.type === OrderType.table) {
      const table = await this.prisma.table.findFirst({
        where: { id: dto.tableId!, isActive: true },
      });
      if (!table) {
        throw new BadRequestException({
          message: 'Bàn không tồn tại hoặc đang tắt.',
          code: 'ORDER_TABLE_INVALID',
        });
      }
    }

    const itemRows = await this.buildOrderItemRows(dto.items, options?.skipOptionValidation);
    const totalAmount = itemRows.reduce(
      (sum, r) => sum.add(r.price.mul(r.quantity)),
      new Prisma.Decimal(0),
    );
    const discountRaw = dto.discountAmount ?? 0;
    const discountAmount = new Prisma.Decimal(discountRaw);
    if (discountAmount.greaterThan(totalAmount)) {
      throw new BadRequestException({
        message: 'Giảm giá không được vượt tổng tiền hàng.',
        code: 'ORDER_DISCOUNT_EXCEEDS_TOTAL',
      });
    }
    const shippingFeeRaw = dto.type === OrderType.delivery ? (dto.shippingFee ?? 0) : 0;
    const shippingFee = new Prisma.Decimal(shippingFeeRaw);
    const finalAmount = this.applyDiscount(totalAmount, discountRaw).add(shippingFee);

    const paymentStatusOnCreate =
      options?.initialPaymentStatus ?? PaymentStatus.pending;

    const order = await this.prisma.$transaction(async (tx) => {
      const paymentCode = await this.allocPaymentCode(tx);

      // Resolve address for logged-in delivery orders using inlineAddress
      let resolvedAddressId: string | null = null;
      let resolvedGuestAddress: string | null = null;

      if (dto.type === OrderType.delivery) {
        if (userId && dto.inlineAddress) {
          const existingCount = await tx.address.count({ where: { userId } });
          if (existingCount < MAX_SAVED_ADDRESSES) {
            const isFirst = existingCount === 0;
            if (isFirst) {
              await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
            }
            const saved = await tx.address.create({
              data: {
                userId,
                fullAddress: dto.inlineAddress.fullAddress,
                lat: dto.inlineAddress.lat,
                lng: dto.inlineAddress.lng,
                isDefault: isFirst,
              },
            });
            resolvedAddressId = saved.id;
          } else {
            resolvedGuestAddress = dto.inlineAddress.fullAddress;
          }
        } else if (userId && dto.addressId) {
          resolvedAddressId = dto.addressId;
        } else if (!userId) {
          resolvedGuestAddress = dto.guestDeliveryAddress!.trim();
        }
      }

      const activeVat = await tx.vatConfig.findFirst({
        where: { isActive: true },
      });
      const vatPercent = activeVat ? Number(activeVat.vatPercent) : 0;
      const vatAmount =
        vatPercent > 0
          ? new Prisma.Decimal(
            Math.round((Number(finalAmount) * vatPercent) / 100),
          )
          : new Prisma.Decimal(0);
      const vatRate = new Prisma.Decimal(vatPercent);

      const order = await tx.order.create({
        data: {
          userId,
          type: dto.type,
          addressId: resolvedAddressId,
          guestDeliveryAddress: resolvedGuestAddress,
          guestDeliveryPhone: dto.guestDeliveryPhone?.trim() || null,
          guestDeliveryName: dto.guestDeliveryName?.trim() || null,
          tableId: dto.type === OrderType.table ? dto.tableId! : null,
          pickupTime: dto.type === OrderType.pickup ? pickupDate! : null,
          totalAmount,
          discountAmount,
          shippingFee,
          finalAmount,
          vatConfigId: activeVat?.id ?? null,
          vatRate,
          vatAmount,
          status: OrderStatus.pending,
          paymentStatus: paymentStatusOnCreate,
          paymentCode,
          paymentType: dto.paymentType ?? ('cash' as PaymentType),
          paidAt: paymentStatusOnCreate === 'paid' ? new Date() : null,
        },
      });

      await tx.orderItem.createMany({
        data: itemRows.map((row) => ({
          orderId: order.id,
          productId: row.productId,
          quantity: row.quantity,
          price: row.price,
          extrasJson: row.extrasJson as Prisma.InputJsonValue,
          optionsJson: row.optionsJson as Prisma.InputJsonValue,
          optionDetailsJson: row.optionDetailsJson as Prisma.InputJsonValue,
          note: row.note,
        })),
      });

      // Mark the user's voucher as used atomically with the order
      if (dto.voucherCode && userId) {
        const voucherCode = dto.voucherCode.trim().toUpperCase();
        const voucher = await tx.voucher.findUnique({
          where: { code: voucherCode },
          select: { id: true },
        });
        if (voucher) {
          await tx.userVoucher.updateMany({
            where: { userId, voucherId: voucher.id, usedAt: null },
            data: { usedAt: new Date() },
          });
        }
      }

      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: {
          items: {
            orderBy: { id: 'asc' },
            include: { product: { select: { id: true, name: true, nameTranslation: true, imageUrls: true } } },
          },
          address: true,
          table: true,
          shipper: { select: { id: true, name: true, phone: true } },
          user: { select: { name: true, phone: true } },
        },
      });
    });

    if (userId) {
      void this.notificationService.createAndEmit({
        userId,
        type: 'order',
        title: 'Đặt đơn thành công',
        content: `Đơn #${order.paymentCode} đã được tạo và đang chờ xác nhận.`,
        data: { orderId: order.id, paymentCode: order.paymentCode, notifKey: 'order_created' },
      }).catch(() => null);
    }

    return order;
  }

  async updateStatus(
    userId: string,
    orderId: string,
    dto: UpdateOrderStatusDto,
  ): Promise<OrderDetail> {
    if (dto.status === undefined && dto.paymentStatus === undefined) {
      throw new BadRequestException({
        message: 'Cần ít nhất status hoặc paymentStatus.',
        code: 'ORDER_STATUS_UPDATE_EMPTY',
      });
    }

    const existing = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
    });

    if (!existing) {
      throw new NotFoundException({
        message: 'Không tìm thấy đơn.',
        code: 'ORDER_NOT_FOUND',
      });
    }

    const shouldRewardPoints =
      dto.status === OrderStatus.completed &&
      existing.status !== OrderStatus.completed;

    const shouldSpendPoints =
      dto.paymentStatus === PaymentStatus.paid &&
      existing.paymentStatus !== PaymentStatus.paid &&
      existing.pointsReserved > 0;

    if (shouldSpendPoints) {
      if (!existing.userId) {
        throw new BadRequestException({
          message:
            'Đơn không gắn tài khoản không thể trừ điểm đã giữ (pointsReserved).',
          code: 'ORDER_POINTS_REQUIRE_USER',
        });
      }
      const updated = await this.prisma.$transaction(async (tx) => {
        await this.pointService.spendPointsTx(
          tx,
          existing.userId!,
          existing.pointsReserved,
          {
            source: PointSource.order,
            referenceId: orderId,
          },
        );
        return tx.order.update({
          where: { id: orderId },
          data: {
            ...(dto.status !== undefined && { status: dto.status }),
            ...(dto.paymentStatus !== undefined && {
              paymentStatus: dto.paymentStatus,
            }),
            pointsConsumed: existing.pointsReserved,
            pointsReserved: 0,
          },
          include: {
            items: {
              orderBy: { id: 'asc' },
              include: { product: { select: { id: true, name: true, nameTranslation: true, imageUrls: true } } },
            },
            address: true,
            table: true,
            shipper: { select: { id: true, name: true, phone: true } },
            user: { select: { name: true, phone: true } },
          },
        });
      });

      if (shouldRewardPoints) {
        this.fireOrderCompletionSideEffects(updated.id, updated.userId, updated.paymentCode);
      }

      return updated;
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.paymentStatus !== undefined && { paymentStatus: dto.paymentStatus }),
      },
      include: {
        items: {
          orderBy: { id: 'asc' },
          include: { product: { select: { id: true, name: true, nameTranslation: true, imageUrls: true } } },
        },
        address: true,
        table: true,
        shipper: { select: { id: true, name: true, phone: true } },
        user: { select: { name: true, phone: true } },
      },
    });

    if (shouldRewardPoints) {
      this.fireOrderCompletionSideEffects(updated.id, updated.userId);
    }

    return updated;
  }

  private fireOrderCompletionSideEffects(orderId: string, userId?: string | null, paymentCode?: string) {
    void this.referralRewardProcessing
      .tryProcessReferralOnOrderCompleted(orderId)
      .catch((err: unknown) => { this.logger.error(err); });
    void this.rewardAndNotifyCompletion(orderId, userId ?? null, paymentCode ?? '')
      .catch((err: unknown) => { this.logger.error(err); });
  }

  private async rewardAndNotifyCompletion(orderId: string, userId: string | null, paymentCode: string) {
    try {
      await this.pointOrderReward.tryRewardOrderCompletion(orderId);
    } catch (err) {
      this.logger.error(err);
    }
    if (!userId) return;

    const earnedTxn = await this.prisma.pointTransaction.findFirst({
      where: { userId, source: PointSource.order, referenceId: orderId, type: PointTransactionType.earn },
      select: { amount: true },
    }).catch(() => null);

    const points = earnedTxn?.amount ?? 0;

    await this.notificationService.createAndEmit({
      userId,
      type: 'order',
      title: 'Đơn hàng hoàn thành',
      content: points > 0
        ? `Đơn #${paymentCode} hoàn thành. Bạn tích được ${points} điểm!`
        : `Đơn #${paymentCode} hoàn thành. Cảm ơn bạn đã sử dụng UjCha!`,
      data: { orderId, paymentCode, earnedPoints: points, notifKey: 'order_completed' },
    });
  }

  async getPaymentStatus(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: { id: true, paymentStatus: true, paymentCode: true, status: true, createdAt: true },
    });

    if (!order) {
      throw new NotFoundException({
        message: 'Không tìm thấy đơn.',
        code: 'ORDER_NOT_FOUND',
      });
    }

    return {
      id: order.id,
      paymentStatus: order.paymentStatus,
      paymentCode: order.paymentCode,
      status: order.status,
      createdAt: order.createdAt,
    };
  }

  async getMyOrders(userId: string, page = 1, pageSize = 10) {
    const skip = (page - 1) * pageSize;

    // Include orders linked via group order participation (non-host members)
    const participantLinks = await this.prisma.groupOrderParticipant.findMany({
      where: { userId, groupOrder: { orderId: { not: null } } },
      select: { groupOrder: { select: { orderId: true } } },
    });
    const groupLinkedOrderIds = participantLinks
      .map((p) => p.groupOrder.orderId)
      .filter((id): id is string => id !== null);

    const where: Prisma.OrderWhereInput = {
      OR: [
        { userId },
        ...(groupLinkedOrderIds.length > 0 ? [{ id: { in: groupLinkedOrderIds } }] : []),
      ],
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          items: {
            orderBy: { id: 'asc' },
            include: {
              product: { select: { id: true, name: true, nameTranslation: true, imageUrls: true } },
            },
          },
          address: { select: { id: true, fullAddress: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    const orderIds = orders.map((o) => o.id);
    const earnedMap = new Map<string, number>();

    const [txns, groupLinks] = await Promise.all([
      orderIds.length > 0
        ? this.prisma.pointTransaction.findMany({
          where: {
            userId,
            type: PointTransactionType.earn,
            source: PointSource.order,
            referenceId: { in: orderIds },
          },
          select: { referenceId: true, amount: true },
        })
        : Promise.resolve([]),
      orderIds.length > 0
        ? this.prisma.groupOrder.findMany({
          where: { orderId: { in: orderIds } },
          select: { orderId: true, token: true },
        })
        : Promise.resolve([]),
    ]);

    for (const t of txns) {
      if (t.referenceId) {
        earnedMap.set(t.referenceId, (earnedMap.get(t.referenceId) ?? 0) + t.amount);
      }
    }
    const groupOrderByOrderId = new Map(groupLinks.map((g) => [g.orderId, g.token] as [string | null, string]));

    return {
      items: orders.map((o) => ({
        ...o,
        earnedPoints: earnedMap.get(o.id) ?? 0,
        isGroupOrder: groupOrderByOrderId.has(o.id),
        groupOrderToken: groupOrderByOrderId.get(o.id) ?? null,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getOrderDetail(userId: string | null, paymentCode: string): Promise<OrderDetail & { isGroupOrder: boolean; groupOrderToken: string | null; earnedPoints: number }> {
    const order = await this.prisma.order.findFirst({
      where: { paymentCode },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, nameTranslation: true, imageUrls: true } } },
          orderBy: { id: 'asc' },
        },
        address: true,
        table: true,
        shipper: { select: { id: true, name: true, phone: true } },
        user: { select: { name: true, phone: true } },
      },
    });

    if (!order) {
      throw new NotFoundException({
        message: 'Không tìm thấy đơn.',
        code: 'ORDER_NOT_FOUND',
      });
    }

    // Guest (userId = null): paymentCode là đủ xác thực vì mã không đoán được.
    if (!userId) {
      const [groupOrderLink, earnedTxn] = await Promise.all([
        this.prisma.groupOrder.findFirst({
          where: { orderId: order.id },
          select: { token: true },
        }),
        // Kiểm tra đơn đã được tích điểm bởi bất kỳ user nào (guest claim sau khi đăng nhập)
        this.prisma.pointTransaction.findFirst({
          where: {
            type: PointTransactionType.earn,
            source: PointSource.order,
            referenceId: order.id,
          },
          select: { amount: true },
        }),
      ]);
      return {
        ...order,
        isGroupOrder: !!groupOrderLink,
        groupOrderToken: groupOrderLink?.token ?? null,
        earnedPoints: earnedTxn?.amount ?? 0,
      };
    }

    // Allow host (userId match) or any group order participant
    const [groupOrderLink, earnedTxn] = await Promise.all([
      this.prisma.groupOrder.findFirst({
        where: { orderId: order.id },
        select: { token: true },
      }),
      this.prisma.pointTransaction.findFirst({
        where: {
          userId,
          type: PointTransactionType.earn,
          source: PointSource.order,
          referenceId: order.id,
        },
        select: { amount: true },
      }),
    ]);

    if (order.userId !== userId && !groupOrderLink) {
      throw new NotFoundException({ message: 'Không tìm thấy đơn.', code: 'ORDER_NOT_FOUND' });
    }

    if (order.userId !== userId && groupOrderLink) {
      const isParticipant = await this.prisma.groupOrderParticipant.findFirst({
        where: { userId, groupOrder: { orderId: order.id } },
        select: { id: true },
      });
      if (!isParticipant) {
        throw new NotFoundException({ message: 'Không tìm thấy đơn.', code: 'ORDER_NOT_FOUND' });
      }
    }

    return {
      ...order,
      isGroupOrder: !!groupOrderLink,
      groupOrderToken: groupOrderLink?.token ?? null,
      earnedPoints: earnedTxn?.amount ?? 0,
    };
  }

  private async allocPaymentCode(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const paymentCode = `UJCHA-${randomBytes(4).toString('hex').toUpperCase()}`;
      const clash = await tx.order.findUnique({
        where: { paymentCode },
        select: { id: true },
      });
      if (!clash) return paymentCode;
    }
    throw new InternalServerErrorException({
      message: 'Không tạo được mã thanh toán duy nhất.',
      code: 'ORDER_PAYMENT_CODE_COLLISION',
    });
  }

  async previewVoucher(code: string, orderAmount: number) {
    const normalized = code.trim().toUpperCase();
    const voucher = await this.prisma.voucher.findUnique({
      where: { code: normalized },
    });

    if (!voucher || !voucher.isActive) {
      throw new BadRequestException({
        message: 'Mã voucher không tồn tại hoặc đã bị tắt.',
        code: 'VOUCHER_NOT_FOUND',
      });
    }

    const now = new Date();
    if (voucher.startsAt && voucher.startsAt > now) {
      throw new BadRequestException({
        message: 'Voucher chưa đến thời gian áp dụng.',
        code: 'VOUCHER_NOT_STARTED',
      });
    }
    if (voucher.endsAt && voucher.endsAt < now) {
      throw new BadRequestException({
        message: 'Mã voucher đã hết hạn.',
        code: 'VOUCHER_EXPIRED',
      });
    }

    const minOrder = Number(voucher.minOrderAmount);
    if (minOrder > 0 && orderAmount < minOrder) {
      throw new BadRequestException({
        message: `Đơn tối thiểu ${new Intl.NumberFormat('vi-VN').format(minOrder)}đ để dùng mã này.`,
        code: 'VOUCHER_MIN_ORDER',
      });
    }

    let discountAmount: number;
    const dv = Number(voucher.discountValue);
    if (voucher.discountType === 'percent') {
      discountAmount = (orderAmount * dv) / 100;
      if (voucher.maxDiscountAmount) {
        discountAmount = Math.min(discountAmount, Number(voucher.maxDiscountAmount));
      }
    } else {
      discountAmount = dv;
    }
    discountAmount = Math.min(Math.round(discountAmount), orderAmount);

    return {
      valid: true as const,
      code: voucher.code,
      name: voucher.name,
      discountType: voucher.discountType,
      discountValue: dv,
      discountAmount,
      maxDiscountAmount: voucher.maxDiscountAmount ? Number(voucher.maxDiscountAmount) : null,
      minOrderAmount: minOrder,
    };
  }
}
