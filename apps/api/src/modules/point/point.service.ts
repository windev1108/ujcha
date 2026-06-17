import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PointSource,
  PointTransactionType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type EarnPointsOptions = {
  /** Nếu có: đến thời điểm này phần điểm còn trong lô sẽ bị expire (cron). */
  expiresAt?: Date | null;
  /** Đến thời điểm này mới được spend; null = dùng ngay. */
  usableFrom?: Date | null;
};

export type SpendPointsOptions = {
  /** Mặc định `order` (đổi khi tích hợp checkout / đổi quà). */
  source?: PointSource;
  referenceId?: string | null;
};

@Injectable()
export class PointService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Cộng điểm: ghi nhận earn + tăng `pointBalance` trong một transaction.
   */
  async earnPoints(
    userId: string,
    amount: number,
    source: PointSource,
    referenceId?: string | null,
    options?: EarnPointsOptions,
  ) {
    this.assertPositiveAmount(amount);
    return this.prisma.$transaction(async (tx) => {
      await this.earnPointsTx(tx, userId, amount, source, referenceId, options);
    });
  }

  /** Cộng điểm trong transaction hiện có (referral, job, v.v.). */
  async earnPointsTx(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
    source: PointSource,
    referenceId?: string | null,
    options?: EarnPointsOptions,
  ): Promise<void> {
    this.assertPositiveAmount(amount);
    await this.lockUserRow(tx, userId);

    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({
        message: 'Không tìm thấy user.',
        code: 'POINT_USER_NOT_FOUND',
      });
    }

    const expiresAt = options?.expiresAt ?? null;
    const usableFrom = options?.usableFrom ?? null;

    await tx.pointTransaction.create({
      data: {
        userId,
        type: PointTransactionType.earn,
        amount,
        source,
        referenceId: referenceId ?? null,
        expiresAt,
        usableFrom,
        remainingAmount: amount,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: { pointBalance: { increment: amount } },
    });
  }

  /**
   * Trừ điểm (FIFO theo các lô earn); từ chối nếu không đủ.
   */
  async spendPoints(
    userId: string,
    amount: number,
    spendOptions?: SpendPointsOptions,
  ) {
    this.assertPositiveAmount(amount);
    return this.prisma.$transaction(async (tx) => {
      await this.spendPointsTx(tx, userId, amount, spendOptions);
    });
  }

  /**
   * Trừ điểm trong transaction hiện có (vd. cùng lúc cập nhật đơn paid).
   * Idempotent: đã có giao dịch spend `order` + `referenceId` thì bỏ qua.
   */
  async spendPointsTx(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
    spendOptions?: SpendPointsOptions,
  ): Promise<void> {
    this.assertPositiveAmount(amount);
    const source = spendOptions?.source ?? PointSource.order;
    const referenceId = spendOptions?.referenceId ?? null;

    if (referenceId && source === PointSource.order) {
      const dup = await tx.pointTransaction.findFirst({
        where: {
          userId,
          type: PointTransactionType.spend,
          source: PointSource.order,
          referenceId,
        },
        select: { id: true },
      });
      if (dup) {
        return;
      }
    }

    const now = new Date();

    await this.lockUserRow(tx, userId);

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { pointBalance: true },
    });
    if (!user) {
      throw new NotFoundException({
        message: 'Không tìm thấy user.',
        code: 'POINT_USER_NOT_FOUND',
      });
    }

    const spendableWhere = {
      userId,
      type: PointTransactionType.earn,
      remainingAmount: { gt: 0 },
      OR: [{ usableFrom: null }, { usableFrom: { lte: now } }],
    };

    const spendableLots = await tx.pointTransaction.findMany({
      where: spendableWhere,
      orderBy: { createdAt: 'asc' },
    });

    const spendableSum = spendableLots.reduce(
      (s, l) => s + (l.remainingAmount ?? 0),
      0,
    );
    if (spendableSum < amount) {
      throw new BadRequestException({
        message: 'Không đủ điểm (hoặc điểm chưa đến thời điểm dùng).',
        code: 'POINT_INSUFFICIENT',
      });
    }

    let need = amount;
    for (const lot of spendableLots) {
      if (need <= 0) break;
      const rem = lot.remainingAmount ?? 0;
      if (rem <= 0) continue;
      const take = Math.min(rem, need);
      await tx.pointTransaction.update({
        where: { id: lot.id },
        data: { remainingAmount: rem - take },
      });
      need -= take;
    }

    if (need > 0) {
      throw new BadRequestException({
        message: 'Dữ liệu điểm không khớp (FIFO).',
        code: 'POINT_FIFO_INCONSISTENT',
      });
    }

    await tx.user.update({
      where: { id: userId },
      data: { pointBalance: { decrement: amount } },
    });

    await tx.pointTransaction.create({
      data: {
        userId,
        type: PointTransactionType.spend,
        amount,
        source,
        referenceId,
        expiresAt: null,
        usableFrom: null,
        remainingAmount: null,
      },
    });
  }

  /**
   * Xử lý các lô earn đã quá hạn (theo `expiresAt`); gọi từ cron hoặc job.
   */
  async expirePoints(): Promise<{ expiredLots: number; totalPoints: number }> {
    const now = new Date();
    const BATCH = 200;

    let expiredLots = 0;
    let totalPoints = 0;
    let lastId: string | undefined;

    while (true) {
      const candidates = await this.prisma.pointTransaction.findMany({
        where: {
          type: PointTransactionType.earn,
          remainingAmount: { gt: 0 },
          expiresAt: { not: null, lte: now },
          ...(lastId ? { id: { gt: lastId } } : {}),
        },
        select: { id: true, userId: true },
        orderBy: { id: 'asc' },
        take: BATCH,
      });

      if (candidates.length === 0) break;
      lastId = candidates[candidates.length - 1].id;

      for (const row of candidates) {
        const n = await this.expireOneEarnLot(row.userId, row.id, now);
        if (n > 0) {
          expiredLots += 1;
          totalPoints += n;
        }
      }

      if (candidates.length < BATCH) break;
    }

    return { expiredLots, totalPoints };
  }

  private async expireOneEarnLot(
    userId: string,
    earnTransactionId: string,
    now: Date,
  ): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockUserRow(tx, userId);

      const lot = await tx.pointTransaction.findFirst({
        where: {
          id: earnTransactionId,
          userId,
          type: PointTransactionType.earn,
          remainingAmount: { gt: 0 },
          expiresAt: { not: null, lte: now },
        },
      });

      if (!lot || !lot.remainingAmount || lot.remainingAmount <= 0) {
        return 0;
      }

      const toExpire = lot.remainingAmount;

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { pointBalance: true },
      });
      if (!user) {
        return 0;
      }

      const actualExpire = Math.min(toExpire, user.pointBalance);
      if (actualExpire <= 0) {
        return 0;
      }

      await tx.pointTransaction.update({
        where: { id: lot.id },
        data: { remainingAmount: toExpire - actualExpire },
      });

      await tx.user.update({
        where: { id: userId },
        data: { pointBalance: { decrement: actualExpire } },
      });

      await tx.pointTransaction.create({
        data: {
          userId,
          type: PointTransactionType.expire,
          amount: actualExpire,
          source: PointSource.admin,
          referenceId: earnTransactionId,
          expiresAt: null,
          usableFrom: null,
          remainingAmount: null,
        },
      });

      return actualExpire;
    });
  }

  private assertPositiveAmount(amount: number) {
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
      throw new BadRequestException({
        message: 'amount phải là số nguyên dương.',
        code: 'POINT_INVALID_AMOUNT',
      });
    }
  }

  private async lockUserRow(tx: Prisma.TransactionClient, userId: string) {
    await tx.$executeRaw(
      Prisma.sql`SELECT 1 FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`,
    );
  }
}
