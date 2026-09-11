import { Injectable } from '@nestjs/common';
import { OrderType, PaymentStatus, PointTransactionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function endOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}

function addUtcDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function pctChange(cur: number, prev: number): number | null {
  if (prev <= 0) return cur > 0 ? 100 : null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

@Injectable()
export class AdminOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const now = new Date();
    const todayStart = startOfUtcDay(now);
    const last7Start = addUtcDays(todayStart, -6);
    const last7End = endOfUtcDay(todayStart);
    const prev7Start = addUtcDays(todayStart, -13);
    const prev7End = endOfUtcDay(addUtcDays(todayStart, -7));
    const typeRangeStart = addUtcDays(todayStart, -29);
    const typeRangeEnd = endOfUtcDay(todayStart);
    const last7StartStr = last7Start.toISOString().slice(0, 10);
    const last7EndStr = last7End.toISOString().slice(0, 10);

    const [
      revenueByDay,
      curRevenue,
      prevRevenue,
      curOrders,
      prevOrders,
      curUsers,
      prevUsers,
      curReferrals,
      prevReferrals,
      curPointsEarned,
      orderTypeRows,
      recentOrders,
      totalOrdersCount,
      platformRevenue,
      topProducts,
      inventoryStatus,
      discountsApplied,
    ] = await Promise.all([
      this.buildRevenueByDay7(last7Start),
      this.sumPaidRevenue(last7Start, last7End),
      this.sumPaidRevenue(prev7Start, prev7End),
      this.countOrders(last7Start, last7End),
      this.countOrders(prev7Start, prev7End),
      this.countNewUsers(last7Start, last7End),
      this.countNewUsers(prev7Start, prev7End),
      this.countReferralSignups(last7Start, last7End),
      this.countReferralSignups(prev7Start, prev7End),
      this.sumPointsEarned(last7Start, last7End),
      this.prisma.order.groupBy({
        by: ['type'],
        where: { createdAt: { gte: typeRangeStart, lte: typeRangeEnd } },
        _count: { _all: true },
      }),
      this.prisma.order.findMany({
        where: {},
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          paymentCode: true,
          status: true,
          finalAmount: true,
          createdAt: true,
          type: true,
          user: { select: { name: true, phone: true, avatar: true } },
          guestDeliveryName: true,
          guestDeliveryPhone: true,
          items: {
            take: 1,
            orderBy: { id: 'asc' },
            select: { product: { select: { name: true } } },
          },
        },
      }),
      this.prisma.order.count(),
      this.prisma.platformRevenueSummary.findMany({
        where: { date: { gte: last7StartStr, lte: last7EndStr } },
        orderBy: [{ platform: 'asc' }, { date: 'desc' }],
      }),
      this.getTopProducts(last7Start, last7End, 5),
      this.getInventoryStatus(),
      this.getDiscountsApplied(last7Start, last7End),
    ]);

    const typeMap = new Map<OrderType, number>();
    for (const r of orderTypeRows) typeMap.set(r.type, r._count._all);
    const delivery = typeMap.get(OrderType.delivery) ?? 0;
    const pickup = typeMap.get(OrderType.pickup) ?? 0;
    const table = typeMap.get(OrderType.table) ?? 0;
    const typeTotal = delivery + pickup + table || 1;

    const platformByDate = new Map<string, number>();
    const platformBreakdown: Record<string, number> = {};
    for (const r of platformRevenue) {
      platformByDate.set(
        r.date,
        (platformByDate.get(r.date) ?? 0) + r.totalEarnings,
      );
      platformBreakdown[r.platform] =
        (platformBreakdown[r.platform] ?? 0) + r.totalEarnings;
    }
    const platformTotal = Object.values(platformBreakdown).reduce(
      (s, v) => s + v,
      0,
    );
    const revenueByDayCombined = revenueByDay.map((d) => ({
      date: d.date,
      revenue: d.revenue + (platformByDate.get(d.date) ?? 0),
      systemRevenue: d.revenue,
      platformRevenue: platformByDate.get(d.date) ?? 0,
    }));

    return {
      range: {
        last7: { from: last7Start.toISOString(), to: last7End.toISOString() },
        previous7: {
          from: prev7Start.toISOString(),
          to: prev7End.toISOString(),
        },
      },
      summary: {
        revenue: {
          current: curRevenue + platformTotal,
          previous: prevRevenue,
          changePercent: pctChange(curRevenue + platformTotal, prevRevenue),
          systemRevenue: curRevenue,
          platformBreakdown,
        },
        orders: {
          current: curOrders,
          previous: prevOrders,
          changePercent: pctChange(curOrders, prevOrders),
        },
        newUsers: {
          current: curUsers,
          previous: prevUsers,
          changePercent: pctChange(curUsers, prevUsers),
        },
        referrals: {
          current: curReferrals,
          previous: prevReferrals,
          changePercent: pctChange(curReferrals, prevReferrals),
        },
        pointsIssued: curPointsEarned,
      },
      revenueByDay: revenueByDayCombined,
      orderTypeShare: {
        totalInRange: delivery + pickup + table,
        delivery: {
          count: delivery,
          percent: Math.round((delivery / typeTotal) * 1000) / 10,
        },
        pickup: {
          count: pickup,
          percent: Math.round((pickup / typeTotal) * 1000) / 10,
        },
        table: {
          count: table,
          percent: Math.round((table / typeTotal) * 1000) / 10,
        },
      },
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        paymentCode: o.paymentCode,
        status: o.status,
        type: o.type,
        finalAmount: o.finalAmount.toString(),
        createdAt: o.createdAt.toISOString(),
        customerName:
          o.user?.name ??
          o.guestDeliveryName ??
          (o.guestDeliveryPhone
            ? `Khách ${o.guestDeliveryPhone}`
            : 'Anonymous'),
        firstItemName: o.items[0]?.product?.name ?? '—',
        customerAvatar: o.user?.avatar ?? null,
      })),
      totalOrdersAllTime: totalOrdersCount,
      platformRevenueSynced: platformRevenue.map((r) => ({
        id: r.id,
        platform: r.platform,
        date: r.date,
        totalEarnings: r.totalEarnings,
        revenue: r.revenue,
        completedOrders: r.completedOrders,
        cancelledOrders: r.cancelledOrders,
        syncedAt: r.syncedAt.toISOString(),
      })),
      topProducts,
      inventoryStatus,
      discountsApplied,
    };
  }

  private async sumPaidRevenue(from: Date, to: Date): Promise<number> {
    const r = await this.prisma.order.aggregate({
      where: {
        paymentStatus: PaymentStatus.paid,
        createdAt: { gte: from, lte: to },
      },
      _sum: { finalAmount: true },
    });
    return Number(r._sum.finalAmount ?? 0);
  }

  private async buildRevenueByDay7(
    from: Date,
  ): Promise<Array<{ date: string; revenue: number }>> {
    const to = endOfUtcDay(addUtcDays(from, 6));
    const rows = await this.prisma.$queryRaw<
      Array<{ day: Date; revenue: unknown }>
    >`
      SELECT date_trunc('day', "createdAt") AS day,
             COALESCE(SUM("finalAmount"), 0) AS revenue
      FROM "Order"
      WHERE "paymentStatus" = CAST(${PaymentStatus.paid} AS "PaymentStatus")
        AND "createdAt" >= ${from}
        AND "createdAt" <= ${to}
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    const byDate = new Map(
      rows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.revenue)]),
    );
    return Array.from({ length: 7 }, (_, i) => {
      const day = addUtcDays(from, i);
      const date = day.toISOString().slice(0, 10);
      return { date, revenue: byDate.get(date) ?? 0 };
    });
  }

  private countOrders(from: Date, to: Date) {
    return this.prisma.order.count({
      where: { createdAt: { gte: from, lte: to } },
    });
  }

  private countNewUsers(from: Date, to: Date) {
    return this.prisma.user.count({
      where: { createdAt: { gte: from, lte: to } },
    });
  }

  private countReferralSignups(from: Date, to: Date) {
    return this.prisma.user.count({
      where: { referredBy: { not: null }, createdAt: { gte: from, lte: to } },
    });
  }

  private async sumPointsEarned(from: Date, to: Date): Promise<number> {
    const r = await this.prisma.pointTransaction.aggregate({
      where: {
        type: PointTransactionType.earn,
        createdAt: { gte: from, lte: to },
      },
      _sum: { amount: true },
    });
    return r._sum.amount ?? 0;
  }

  /** Món bán chạy 7 ngày gần nhất (đơn đã thanh toán) */
  private async getTopProducts(from: Date, to: Date, limit: number) {
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: {
          paymentStatus: PaymentStatus.paid,
          createdAt: { gte: from, lte: to },
        },
      },
      select: {
        quantity: true,
        price: true,
        product: { select: { id: true, name: true, imageUrls: true } },
      },
    });

    const map = new Map<
      string,
      {
        productId: string;
        name: string;
        imageUrl: string | null;
        quantitySold: number;
        revenue: number;
      }
    >();
    for (const it of items) {
      if (!it.product) continue;
      const imgs = Array.isArray(it.product.imageUrls)
        ? (it.product.imageUrls as string[])
        : [];
      const rev = Number(it.price.toString()) * it.quantity;
      const cur = map.get(it.product.id);
      if (cur) {
        cur.quantitySold += it.quantity;
        cur.revenue += rev;
      } else {
        map.set(it.product.id, {
          productId: it.product.id,
          name: it.product.name,
          imageUrl: imgs[0] ?? null,
          quantitySold: it.quantity,
          revenue: rev,
        });
      }
    }
    return [...map.values()]
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, limit);
  }

  /** Tình trạng tồn kho nguyên liệu (đang dùng) */
  private async getInventoryStatus() {
    const ingredients = await this.prisma.ingredient.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        unit: true,
        stockQty: true,
        lowStockThreshold: true,
      },
    });

    let outOfStockCount = 0;
    let lowStockCount = 0;
    const items: Array<{
      id: string;
      name: string;
      unit: string;
      stockQty: number;
      lowStockThreshold: number | null;
    }> = [];

    for (const ing of ingredients) {
      const stock = Number(ing.stockQty.toString());
      const threshold =
        ing.lowStockThreshold != null
          ? Number(ing.lowStockThreshold.toString())
          : null;
      const isOut = stock <= 0;
      const isLow = !isOut && threshold != null && stock <= threshold;
      if (isOut) outOfStockCount += 1;
      if (isLow) lowStockCount += 1;
      if (isOut || isLow) {
        items.push({
          id: ing.id,
          name: ing.name,
          unit: ing.unit,
          stockQty: stock,
          lowStockThreshold: threshold,
        });
      }
    }

    return {
      totalActive: ingredients.length,
      outOfStockCount,
      lowStockCount,
      items: items.sort((a, b) => a.stockQty - b.stockQty).slice(0, 8),
    };
  }

  /** Điểm UjCha & voucher đã dùng để giảm giá trên đơn đã thanh toán, 7 ngày gần nhất */
  private async getDiscountsApplied(from: Date, to: Date) {
    const [agg, ordersWithPointDiscount] = await Promise.all([
      this.prisma.order.aggregate({
        where: {
          paymentStatus: PaymentStatus.paid,
          createdAt: { gte: from, lte: to },
        },
        _sum: { pointDiscountAmount: true, discountAmount: true },
        _count: { _all: true },
      }),
      this.prisma.order.count({
        where: {
          paymentStatus: PaymentStatus.paid,
          createdAt: { gte: from, lte: to },
          pointsConsumed: { gt: 0 },
        },
      }),
    ]);

    return {
      pointDiscountTotal: Number(agg._sum.pointDiscountAmount ?? 0),
      voucherDiscountTotal: Number(agg._sum.discountAmount ?? 0),
      ordersWithPointDiscount,
      paidOrdersInRange: agg._count._all,
    };
  }
}
