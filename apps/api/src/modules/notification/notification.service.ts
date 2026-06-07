import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationGateway } from './notification.gateway';

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  content: string;
  data?: Record<string, unknown>;
}

export type BroadcastNotificationInput = Omit<CreateNotificationInput, 'userId'>;

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationGateway,
  ) {}

  async createAndEmit(input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        content: input.content,
        data: input.data !== undefined ? (input.data as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
    this.gateway.emitToUser(input.userId, notification);
    return notification;
  }

  /**
   * Upserts an order-type notification keyed on data.orderId so there is
   * exactly one notification record per order per user. Always emits via
   * socket so the frontend can show a toast on every status transition.
   */
  async upsertOrderNotification(input: CreateNotificationInput) {
    const orderId = (input.data as Record<string, unknown> | undefined)?.orderId as string | undefined;

    let notification;

    if (orderId) {
      const existing = await this.prisma.notification.findFirst({
        where: {
          userId: input.userId,
          type: input.type,
          data: { path: ['orderId'], equals: orderId },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existing) {
        notification = await this.prisma.notification.update({
          where: { id: existing.id },
          data: {
            title: input.title,
            content: input.content,
            isRead: false,
            data: input.data !== undefined ? (input.data as Prisma.InputJsonValue) : Prisma.JsonNull,
          },
        });
      }
    }

    if (!notification) {
      notification = await this.prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          content: input.content,
          data: input.data !== undefined ? (input.data as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
      });
    }

    this.gateway.emitToUser(input.userId, notification);
    return notification;
  }

  async upsertOrderNotificationForMany(
    userIds: string[],
    input: Omit<CreateNotificationInput, 'userId'>,
  ) {
    if (userIds.length === 0) return;
    await Promise.allSettled(
      userIds.map((userId) => this.upsertOrderNotification({ ...input, userId })),
    );
  }

  getForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
  }

  markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async countUnread(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  deleteOne(id: string, userId: string) {
    return this.prisma.notification.deleteMany({
      where: { id, userId },
    });
  }

  deleteAll(userId: string) {
    return this.prisma.notification.deleteMany({
      where: { userId },
    });
  }

  async createAndBroadcastToAll(input: BroadcastNotificationInput) {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    if (users.length === 0) return;

    const jsonData =
      input.data !== undefined
        ? (input.data as Prisma.InputJsonValue)
        : Prisma.JsonNull;

    await this.prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        type: input.type,
        title: input.title,
        content: input.content,
        data: jsonData,
      })),
      skipDuplicates: true,
    });

    this.gateway.broadcastToAllUsers('broadcast_notification', {
      type: input.type,
      title: input.title,
      content: input.content,
    });
  }
}
