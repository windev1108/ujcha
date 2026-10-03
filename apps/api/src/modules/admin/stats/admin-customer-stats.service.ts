// src/modules/admin/stats/admin-customer-stats.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  addDays,
  DATE_RE,
  diffDays,
  endOf,
  startOf,
  vnDay,
} from './admin-finance-stats.service';

type Cell = {
  lat0: number;
  lng0: number;
  lat1: number;
  lng1: number;
  customers: Set<string>;
  orders: number;
  revenue: number;
};

@Injectable()
export class AdminCustomerStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(q: { from?: string; to?: string; cell?: number }) {
    const to = q.to ?? vnDay(new Date());
    const from = q.from ?? addDays(to, -29);
    if (
      !DATE_RE.test(from) ||
      !DATE_RE.test(to) ||
      from > to ||
      diffDays(from, to) > 365
    ) {
      throw new BadRequestException({
        message: 'Khoảng thời gian không hợp lệ (tối đa 366 ngày).',
        code: 'STATS_RANGE_INVALID',
      });
    }
    const cell = Math.min(0.05, Math.max(0.002, Number(q.cell) || 0.005));
    const base = {
      paymentStatus: PaymentStatus.paid,
      status: { not: OrderStatus.cancelled },
    };
    const rangeStart = startOf(from);
    const rangeEnd = endOf(to);

    const [orders, byUser, byPhone] = await Promise.all([
      this.prisma.order.findMany({
        where: { ...base, createdAt: { gte: rangeStart, lte: rangeEnd } },
        select: {
          userId: true,
          guestDeliveryPhone: true,
          guestDeliveryLat: true,
          guestDeliveryLng: true,
          finalAmount: true,
          address: { select: { lat: true, lng: true } },
        },
      }),
      // Lịch sử toàn thời gian để biết đơn đầu tiên + tổng số đơn của mỗi khách
      this.prisma.order.groupBy({
        by: ['userId'],
        where: { ...base, userId: { not: null } },
        _min: { createdAt: true },
        _count: { _all: true },
      }),
      this.prisma.order.groupBy({
        by: ['guestDeliveryPhone'],
        where: { ...base, userId: null, guestDeliveryPhone: { not: null } },
        _min: { createdAt: true },
        _count: { _all: true },
      }),
    ]);

    const history = new Map<string, { first: Date; count: number }>();
    for (const r of byUser) {
      if (r.userId && r._min.createdAt)
        history.set(`u:${r.userId}`, {
          first: r._min.createdAt,
          count: r._count._all,
        });
    }
    for (const r of byPhone) {
      const p = r.guestDeliveryPhone?.trim();
      if (p && r._min.createdAt) {
        const k = `p:${p}`;
        const cur = history.get(k);
        history.set(k, {
          first:
            cur && cur.first < r._min.createdAt ? cur.first : r._min.createdAt,
          count: (cur?.count ?? 0) + r._count._all,
        });
      }
    }

    const keyOf = (o: {
      userId: string | null;
      guestDeliveryPhone: string | null;
    }) =>
      o.userId
        ? `u:${o.userId}`
        : o.guestDeliveryPhone?.trim()
          ? `p:${o.guestDeliveryPhone.trim()}`
          : null;

    // ── Tỉ lệ đặt lại ──
    let cohort = 0;
    let repeated = 0;
    for (const h of history.values()) {
      if (h.first >= rangeStart && h.first <= rangeEnd) {
        cohort += 1;
        if (h.count >= 2) repeated += 1;
      }
    }
    const inRange = new Set<string>();
    let anonymousOrders = 0;
    for (const o of orders) {
      const k = keyOf(o);
      if (k) inRange.add(k);
      else anonymousOrders += 1;
    }
    let newCustomers = 0;
    for (const k of inRange) {
      const h = history.get(k);
      if (h && h.first >= rangeStart && h.first <= rangeEnd) newCustomers += 1;
    }

    // ── Gom ô lưới ──
    const cells = new Map<string, Cell>();
    let geocoded = 0;
    orders.forEach((o, idx) => {
      const lat = o.address?.lat ?? o.guestDeliveryLat;
      const lng = o.address?.lng ?? o.guestDeliveryLng;
      if (
        lat == null ||
        lng == null ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      )
        return;
      if (lat === 0 && lng === 0) return;
      geocoded += 1;
      const cy = Math.floor(lat / cell);
      const cx = Math.floor(lng / cell);
      const key = `${cy}|${cx}`;
      const c = cells.get(key) ?? {
        lat0: cy * cell,
        lng0: cx * cell,
        lat1: (cy + 1) * cell,
        lng1: (cx + 1) * cell,
        customers: new Set<string>(),
        orders: 0,
        revenue: 0,
      };
      c.customers.add(keyOf(o) ?? `o:${idx}`);
      c.orders += 1;
      c.revenue += Number(o.finalAmount.toString());
      cells.set(key, c);
    });

    return {
      range: { from, to },
      repeat: {
        cohortCustomers: cohort,
        repeatedCustomers: repeated,
        repeatRatePercent:
          cohort > 0 ? Math.round((repeated / cohort) * 1000) / 10 : null,
        customersInRange: inRange.size,
        newCustomers,
        returningCustomers: inRange.size - newCustomers,
        anonymousOrders,
      },
      geo: {
        cellSize: cell,
        totalOrders: orders.length,
        geocodedOrders: geocoded,
        cells: [...cells.values()]
          .map((c) => ({
            lat0: c.lat0,
            lng0: c.lng0,
            lat1: c.lat1,
            lng1: c.lng1,
            customers: c.customers.size,
            orders: c.orders,
            revenue: Math.round(c.revenue),
          }))
          .sort((a, b) => b.customers - a.customers)
          .slice(0, 500),
      },
    };
  }
}
