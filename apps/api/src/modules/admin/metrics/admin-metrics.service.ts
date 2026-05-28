import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdminMetricsQueryDto,
  MetricsGroupBy,
} from './dto/admin-metrics-query.dto';

const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

type Trunc = 'day' | 'week' | 'month';

function toTrunc(g: MetricsGroupBy): Trunc | null {
  if (g === MetricsGroupBy.none) return null;
  return g as Trunc;
}

function periodKey(d: Date): string {
  return d.toISOString();
}

@Injectable()
export class AdminMetricsService {
  constructor(private readonly prisma: PrismaService) { }

  async getMetrics(query: AdminMetricsQueryDto) {
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException({
        message: 'from / to không hợp lệ.',
        code: 'METRICS_INVALID_RANGE',
      });
    }
    if (from > to) {
      throw new BadRequestException({
        message: 'from phải trước hoặc bằng to.',
        code: 'METRICS_RANGE_ORDER',
      });
    }
    if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
      throw new BadRequestException({
        message: 'Khoảng thời gian tối đa 366 ngày.',
        code: 'METRICS_RANGE_TOO_LONG',
      });
    }

    const groupBy = query.groupBy ?? MetricsGroupBy.none;
    const trunc = toTrunc(groupBy);

    if (!trunc) {
      return this.totalsOnly(from, to);
    }

    return this.bucketed(from, to, trunc);
  }

  private async totalsOnly(from: Date, to: Date) {
    const [revenueAgg, ordersCount, usersCount, referralsCount] =
      await Promise.all([
        this.prisma.order.aggregate({
          where: {
            paymentStatus: PaymentStatus.paid,
            createdAt: { gte: from, lte: to },
          },
          _sum: { finalAmount: true },
        }),
        this.prisma.order.count({
          where: { createdAt: { gte: from, lte: to } },
        }),
        this.prisma.user.count({
          where: { createdAt: { gte: from, lte: to } },
        }),
        this.prisma.user.count({
          where: {
            referredBy: { not: null },
            createdAt: { gte: from, lte: to },
          },
        }),
      ]);

    const revenue = revenueAgg._sum.finalAmount?.toString() ?? '0';

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      groupBy: MetricsGroupBy.none,
      summary: {
        revenue,
        orders: ordersCount,
        users: usersCount,
        referrals: referralsCount,
      },
    };
  }

  private async bucketed(from: Date, to: Date, trunc: Trunc) {
    const [revenueRows, orderRows, userRows, referralRows, totals] =
      await Promise.all([
        this.revenueByPeriod(trunc, from, to),
        this.ordersByPeriod(trunc, from, to),
        this.usersByPeriod(trunc, from, to),
        this.referralsByPeriod(trunc, from, to),
        this.totalsOnly(from, to),
      ]);

    const merged = new Map<
      string,
      {
        period: string;
        revenue: string;
        orders: number;
        users: number;
        referrals: number;
      }
    >();

    const ensure = (p: Date) => {
      const k = periodKey(p);
      if (!merged.has(k)) {
        merged.set(k, {
          period: p.toISOString(),
          revenue: '0',
          orders: 0,
          users: 0,
          referrals: 0,
        });
      }
      return merged.get(k)!;
    };

    for (const r of revenueRows) {
      const row = ensure(r.period);
      row.revenue = String(r.revenue);
    }
    for (const r of orderRows) {
      const row = ensure(r.period);
      row.orders = Number(r.orders);
    }
    for (const r of userRows) {
      const row = ensure(r.period);
      row.users = Number(r.users);
    }
    for (const r of referralRows) {
      const row = ensure(r.period);
      row.referrals = Number(r.referrals);
    }

    const buckets = [...merged.values()].sort((a, b) =>
      a.period.localeCompare(b.period),
    );

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      groupBy: trunc,
      buckets,
      summary: totals.summary,
    };
  }

  private revenueByPeriod(trunc: Trunc, from: Date, to: Date) {
    return this.prisma.$queryRawUnsafe<
      Array<{ period: Date; revenue: unknown }>
    >(
      `
      SELECT date_trunc($1::text, o."createdAt") AS period,
             COALESCE(SUM(o."finalAmount"), 0) AS revenue
      FROM "Order" o
      WHERE o."paymentStatus" = $2
        AND o."createdAt" >= $3
        AND o."createdAt" <= $4
      GROUP BY 1
      ORDER BY 1 ASC
      `,
      trunc,
      PaymentStatus.paid,
      from,
      to,
    );
  }

  private ordersByPeriod(trunc: Trunc, from: Date, to: Date) {
    return this.prisma.$queryRawUnsafe<Array<{ period: Date; orders: bigint }>>(
      `
      SELECT date_trunc($1::text, o."createdAt") AS period,
             COUNT(*)::bigint AS orders
      FROM "Order" o
      WHERE o."createdAt" >= $2
        AND o."createdAt" <= $3
      GROUP BY 1
      ORDER BY 1 ASC
      `,
      trunc,
      from,
      to,
    );
  }

  private usersByPeriod(trunc: Trunc, from: Date, to: Date) {
    return this.prisma.$queryRawUnsafe<Array<{ period: Date; users: bigint }>>(
      `
      SELECT date_trunc($1::text, u."createdAt") AS period,
             COUNT(*)::bigint AS users
      FROM "User" u
      WHERE u."createdAt" >= $2
        AND u."createdAt" <= $3
      GROUP BY 1
      ORDER BY 1 ASC
      `,
      trunc,
      from,
      to,
    );
  }

  private referralsByPeriod(trunc: Trunc, from: Date, to: Date) {
    return this.prisma.$queryRawUnsafe<
      Array<{ period: Date; referrals: bigint }>
    >(
      `
      SELECT date_trunc($1::text, u."createdAt") AS period,
             COUNT(*)::bigint AS referrals
      FROM "User" u
      WHERE u."referredBy" IS NOT NULL
        AND u."createdAt" >= $2
        AND u."createdAt" <= $3
      GROUP BY 1
      ORDER BY 1 ASC
      `,
      trunc,
      from,
      to,
    );
  }
}
