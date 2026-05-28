import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PointSource, Prisma } from '@prisma/client';
import { PointService } from '../../point/point.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { AdminPointTransactionsQueryDto } from './dto/admin-point-transactions-query.dto';
import type { AdminPointsAdjustDto } from './dto/admin-points-adjust.dto';
import type { AdminPointsListQueryDto } from './dto/admin-points-list-query.dto';

@Injectable()
export class AdminPointService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pointService: PointService,
  ) { }

  async listAllTransactions(query: AdminPointTransactionsQueryDto) {
    const take = query.limit ?? 50;
    const skip = query.skip ?? 0;

    const where = query.type !== undefined ? { type: query.type } : {};

    const [rows, total] = await Promise.all([
      this.prisma.pointTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: {
          user: {
            select: { id: true, name: true, phone: true, email: true },
          },
        },
      }),
      this.prisma.pointTransaction.count({ where }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        user: r.user,
        type: r.type,
        amount: r.amount,
        source: r.source,
        referenceId: r.referenceId,
        expiresAt: r.expiresAt?.toISOString() ?? null,
        usableFrom: r.usableFrom?.toISOString() ?? null,
        remainingAmount: r.remainingAmount,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      skip,
      limit: take,
    };
  }

  async listUserTransactions(userId: string, query: AdminPointsListQueryDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException({
        message: 'Không tìm thấy user.',
        code: 'USER_NOT_FOUND',
      });
    }

    const take = query.limit ?? 50;
    const skip = query.skip ?? 0;

    const rows = await this.prisma.pointTransaction.findMany({
      where: {
        userId,
        ...(query.type !== undefined && { type: query.type }),
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      amount: r.amount,
      source: r.source,
      referenceId: r.referenceId,
      expiresAt: r.expiresAt?.toISOString() ?? null,
      usableFrom: r.usableFrom?.toISOString() ?? null,
      remainingAmount: r.remainingAmount,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async adjustPoints(adminId: string, dto: AdminPointsAdjustDto) {
    if (dto.amount === 0) {
      throw new BadRequestException({
        message: 'amount không được bằng 0.',
        code: 'ADMIN_POINT_ADJUST_ZERO',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, pointBalance: true },
    });
    if (!user) {
      throw new NotFoundException({
        message: 'Không tìm thấy user.',
        code: 'USER_NOT_FOUND',
      });
    }
    if (dto.amount < 0 && user.pointBalance + dto.amount < 0) {
      throw new BadRequestException({
        message: 'Không thể trừ quá số dư hiện tại.',
        code: 'ADMIN_POINT_BALANCE_NEGATIVE',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.amount > 0) {
        await this.pointService.earnPointsTx(
          tx,
          dto.userId,
          dto.amount,
          PointSource.admin,
          null,
          { expiresAt: null, usableFrom: null },
        );
      } else {
        await this.pointService.spendPointsTx(tx, dto.userId, -dto.amount, {
          source: PointSource.admin,
          referenceId: null,
        });
      }

      await tx.adminActionLog.create({
        data: {
          adminId,
          action: 'point.adjust',
          targetUserId: dto.userId,
          payload: {
            amount: dto.amount,
            note: dto.note ?? null,
          } as Prisma.InputJsonValue,
        },
      });
    });
  }
}
