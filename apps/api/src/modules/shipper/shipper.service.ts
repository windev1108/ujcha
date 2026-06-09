import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OrderStatus, OrderType, PaymentStatus, PaymentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersGateway } from '../events/orders.gateway';
import { PointOrderRewardService } from '../point/point-order-reward.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class ShipperService {
  private readonly logger = new Logger(ShipperService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersGateway: OrdersGateway,
    private readonly pointOrderReward: PointOrderRewardService,
    private readonly notificationService: NotificationService,
  ) {}

  async getAvailableOrders() {
    const orders = await this.prisma.order.findMany({
      where: {
        type: OrderType.delivery,
        shipperId: null,
        status: { in: [OrderStatus.confirmed, OrderStatus.preparing, OrderStatus.ready] },
      },
      include: {
        items: {
          include: { product: { select: { name: true, imageUrls: true } } },
        },
        address: { select: { fullAddress: true, lat: true, lng: true, note: true } },
        user: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return orders.map((o) => ({
      orderId: o.id,
      paymentCode: o.paymentCode,
      customerName: o.user?.name ?? o.guestDeliveryName ?? 'Khách',
      customerPhone: o.user?.phone ?? o.guestDeliveryPhone ?? '',
      address: o.address?.fullAddress ?? o.guestDeliveryAddress ?? '',
      addressNote: o.address?.note ?? null,
      lat: (o.address as any)?.lat ?? null,
      lng: (o.address as any)?.lng ?? null,
      items: o.items.map((i) => ({
        name: i.product?.name ?? '',
        quantity: i.quantity,
        price: Number(i.price),
        imageUrl: i.product?.imageUrls?.[0] ?? null,
        optionsJson: (i.optionsJson ?? {}) as Record<string, string>,
        extrasJson: (i.extrasJson ?? []) as Array<{ name: string; price: number }>,
        note: i.note ?? null,
      })),
      totalAmount: Number(o.finalAmount),
      shippingFee: Number(o.shippingFee),
      paymentType: o.paymentType,
    }));
  }

  async getAssignedOrders(shipperId: string) {
    return this.prisma.order.findMany({
      where: {
        shipperId,
        type: OrderType.delivery,
        status: {
          in: [
            OrderStatus.confirmed,
            OrderStatus.preparing,
            OrderStatus.ready,
            OrderStatus.delivering,
            OrderStatus.picked_up,
            OrderStatus.arrived,
          ],
        },
      },
      include: {
        items: {
          include: {
            product: { select: { name: true, imageUrls: true, price: true } },
          },
        },
        address: { select: { fullAddress: true, lat: true, lng: true, note: true } },
        user: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrderDetail(shipperId: string, orderId: string) {
    const order = await this.assertShipperOwnsOrder(shipperId, orderId);
    return this.prisma.order.findUnique({
      where: { id: order.id },
      include: {
        items: {
          include: {
            product: { select: { name: true, imageUrls: true } },
          },
        },
        address: true,
        user: { select: { name: true, phone: true } },
      },
    });
  }

  async getOrderHistory(shipperId: string) {
    return this.prisma.order.findMany({
      where: {
        shipperId,
        type: OrderType.delivery,
        status: { in: [OrderStatus.completed, OrderStatus.cancelled] },
      },
      select: {
        id: true,
        status: true,
        finalAmount: true,
        shippingFee: true,
        createdAt: true,
        updatedAt: true,
        address: { select: { fullAddress: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
  }

  async acceptOrder(shipperId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, type: true, shipperId: true },
    });

    if (!order) {
      throw new ForbiddenException({ message: 'Không tìm thấy đơn hàng.', code: 'ORDER_NOT_FOUND' });
    }

    if (order.type !== OrderType.delivery) {
      throw new ForbiddenException({ message: 'Chỉ đơn giao hàng mới nhận được.', code: 'ORDER_NOT_DELIVERY' });
    }

    const acceptableStatuses: OrderStatus[] = [OrderStatus.confirmed, OrderStatus.preparing, OrderStatus.ready];
    if (!acceptableStatuses.includes(order.status)) {
      throw new ForbiddenException({ message: 'Đơn chưa thể nhận.', code: 'ORDER_NOT_AVAILABLE' });
    }

    if (order.shipperId !== null) {
      throw new ForbiddenException({ message: 'Đơn hàng đã được nhận bởi shipper khác.', code: 'ORDER_ALREADY_TAKEN' });
    }

    // Just assign the shipper — status is controlled by POS (confirmed→preparing→ready)
    // and by the shipper via pickup/arrived/complete actions
    const updated = await this.prisma.order.update({
      where: { id: orderId, shipperId: null },
      data: { shipperId },
    });

    this.ordersGateway.emitDeliveryOrderTaken({ orderId });
    this.ordersGateway.emitShipperOrderStatusUpdated({ orderId, status: updated.status, shipperId });
    return updated;
  }

  async markPickedUp(shipperId: string, orderId: string) {
    const order = await this.assertShipperOwnsOrder(shipperId, orderId);

    if (order.status !== OrderStatus.ready) {
      throw new ForbiddenException({
        message: 'Đơn hàng chưa sẵn sàng để lấy.',
        code: 'ORDER_NOT_READY',
      });
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.delivering, deliveringAt: new Date() },
      select: { userId: true, paymentCode: true },
    });

    this.ordersGateway.emitOrderStatusUpdated({ orderId, status: OrderStatus.delivering });
    this.ordersGateway.emitShipperOrderStatusUpdated({ orderId, status: OrderStatus.delivering, shipperId });
    void this.notifyOrderUsers(updated, orderId, {
      title: 'Đơn đang trên đường giao',
      content: `Đơn #${updated.paymentCode} đang trên đường đến bạn.`,
      notifKey: 'order_delivering',
    });
    return updated;
  }

  async markArrived(shipperId: string, orderId: string) {
    const order = await this.assertShipperOwnsOrder(shipperId, orderId);

    // Accept both delivering (new flow) and picked_up (legacy in-flight orders)
    if (order.status !== OrderStatus.delivering && order.status !== OrderStatus.picked_up) {
      throw new ForbiddenException({
        message: 'Chưa lấy hàng.',
        code: 'ORDER_NOT_PICKED_UP',
      });
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.arrived, arrivedAt: new Date() },
      select: { userId: true, paymentCode: true },
    });

    this.ordersGateway.emitOrderStatusUpdated({ orderId, status: OrderStatus.arrived });
    this.ordersGateway.emitShipperOrderStatusUpdated({ orderId, status: OrderStatus.arrived, shipperId });
    void this.notifyOrderUsers(updated, orderId, {
      title: 'Shipper đã đến nơi',
      content: `Đơn #${updated.paymentCode} đã đến địa chỉ giao hàng.`,
      notifKey: 'order_arrived',
    });
    return updated;
  }

  async completeDelivery(shipperId: string, orderId: string) {
    const order = await this.assertShipperOwnsOrder(shipperId, orderId);

    const completableStatuses: OrderStatus[] = [OrderStatus.arrived, OrderStatus.delivering];
    if (!completableStatuses.includes(order.status)) {
      throw new ForbiddenException({
        message: 'Chưa đến điểm giao.',
        code: 'ORDER_NOT_ARRIVED',
      });
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.completed,
        completedAt: new Date(),
        ...(order.paymentType === PaymentType.cash && {
          paymentStatus: PaymentStatus.paid,
        }),
      },
      select: { userId: true, paymentCode: true },
    });

    this.ordersGateway.emitOrderStatusUpdated({ orderId, status: OrderStatus.completed });
    this.ordersGateway.emitShipperOrderStatusUpdated({ orderId, status: OrderStatus.completed, shipperId });

    void this.pointOrderReward.tryRewardOrderCompletion(orderId).catch((err: unknown) => {
      this.logger.error(`Point reward failed for order ${orderId}: ${err instanceof Error ? err.message : err}`);
    });

    void this.notifyOrderUsers(updated, orderId, {
      title: 'Đơn hàng đã hoàn thành',
      content: `Đơn #${updated.paymentCode} đã được giao thành công. Cảm ơn bạn!`,
      notifKey: 'order_completed',
    });

    return updated;
  }

  private async notifyOrderUsers(
    order: { userId: string | null; paymentCode: string },
    orderId: string,
    notif: { title: string; content: string; notifKey: string },
  ) {
    if (!order.userId) return;
    await this.notificationService
      .upsertOrderNotificationForMany([order.userId], {
        type: 'order',
        title: notif.title,
        content: notif.content,
        data: { orderId, paymentCode: order.paymentCode, notifKey: notif.notifKey },
      })
      .catch((err: unknown) => {
        this.logger.error(`Notification failed for order ${orderId}: ${err instanceof Error ? err.message : err}`);
      });
  }

  private async assertShipperOwnsOrder(shipperId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, shipperId: true, status: true, type: true, paymentType: true },
    });

    if (!order) {
      throw new NotFoundException({ message: 'Không tìm thấy đơn hàng.', code: 'ORDER_NOT_FOUND' });
    }

    if (order.shipperId !== shipperId || order.type !== OrderType.delivery) {
      throw new ForbiddenException({ message: 'Không có quyền truy cập đơn hàng này.', code: 'ORDER_FORBIDDEN' });
    }

    return order;
  }
}
