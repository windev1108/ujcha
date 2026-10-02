// src/modules/admin/stats/admin-finance-stats.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CostLineInput,
  lineCostKey,
  PricingCostService,
} from '../../pricing/pricing-cost.service';

// ── Ngày giờ theo múi giờ VN (UTC+7) ─────────────────────────────────────────
const VN_OFFSET_MS = 7 * 3600_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const vnDay = (d: Date) =>
  new Date(d.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
const vnHour = (d: Date) => new Date(d.getTime() + VN_OFFSET_MS).getUTCHours();
const startOf = (s: string) => new Date(`${s}T00:00:00+07:00`);
const endOf = (s: string) => new Date(`${s}T23:59:59.999+07:00`);
const addDays = (s: string, n: number) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const diffDays = (a: string, b: string) =>
  Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000,
  );

const num = (v: Prisma.Decimal | number | null | undefined) =>
  v == null ? 0 : Number(v.toString());
const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Đơn nhập từ Grab/Shopee có tên khách dạng "[GRAB] ..." → kênh = GRAB; còn lại = DIRECT. */
const channelOf = (name: string | null) => {
  const m = name?.match(/^\[([^\]]+)\]/);
  return m ? m[1].trim().toUpperCase() : 'DIRECT';
};

type Bucket = { orders: number; totalCollected: number };
type DayAgg = {
  date: string;
  orders: number;
  goods: number;
  disc: number;
  pts: number;
  ship: number;
  collected: number;
  cogs: number;
  costedNet: number;
};
type ProdAgg = {
  productId: string;
  name: string;
  imageUrl: string | null;
  categoryName: string;
  quantity: number;
  goods: number;
  cogs: number;
  costedNet: number;
  costedRev: number;
};
type CatAgg = {
  categoryId: string;
  categoryName: string;
  quantity: number;
  goods: number;
  cogs: number;
  costedNet: number;
  costedRev: number;
};

@Injectable()
export class AdminFinanceStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingCost: PricingCostService,
  ) {}

  /**
   * Tổng quan kinh doanh. `from`/`to` là ngày VN dạng YYYY-MM-DD (gồm cả hai đầu).
   * Mặc định 30 ngày gần nhất. Kèm số liệu kỳ liền trước (cùng độ dài) để so sánh.
   */
  async overview(q: { from?: string; to?: string }) {
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
    const days = diffDays(from, to) + 1;
    const prevTo = addDays(from, -1);
    const prevFrom = addDays(from, -days);

    const [current, previous] = await Promise.all([
      this.compute(from, to),
      this.compute(prevFrom, prevTo),
    ]);

    return {
      range: { from, to, days },
      ...current,
      previous: {
        range: { from: prevFrom, to: prevTo },
        summary: previous.summary,
      },
    };
  }

  private async compute(from: string, to: string) {
    // Đơn đã thanh toán và chưa huỷ.
    const orders = await this.prisma.order.findMany({
      where: {
        paymentStatus: PaymentStatus.paid,
        status: { not: OrderStatus.cancelled },
        createdAt: { gte: startOf(from), lte: endOf(to) },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        createdAt: true,
        type: true,
        paymentType: true,
        totalAmount: true,
        discountAmount: true,
        pointDiscountAmount: true,
        shippingFee: true,
        finalAmount: true,
        vatAmount: true,
        guestDeliveryName: true,
        items: {
          select: {
            productId: true,
            quantity: true,
            price: true,
            optionsJson: true,
            extrasJson: true,
            product: {
              select: {
                id: true,
                name: true,
                imageUrls: true,
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    type Line = (typeof orders)[number]['items'][number];
    const toCostLine = (it: Line): CostLineInput => {
      const o = it.optionsJson;
      const options =
        o && typeof o === 'object' && !Array.isArray(o)
          ? (o as Record<string, string>)
          : {};
      const extras = Array.isArray(it.extrasJson)
        ? (it.extrasJson as Array<{ toppingId?: string }>)
        : [];
      return {
        productId: it.productId,
        options,
        toppingIds: extras
          .map((e) => e?.toppingId)
          .filter((x): x is string => !!x),
      };
    };
    const lineCosts = await this.pricingCost.estimateLineCosts(
      orders.flatMap((o) => o.items.map(toCostLine)),
    );

    // ── Bộ cộng dồn ──
    const s = {
      orders: 0,
      itemsSold: 0,
      goods: 0,
      disc: 0,
      pts: 0,
      ship: 0,
      collected: 0,
      vat: 0,
      cogs: 0,
      costedNet: 0,
      costedRev: 0,
    };
    const days = new Map<string, DayAgg>();
    for (let d = from; d <= to; d = addDays(d, 1)) {
      days.set(d, {
        date: d,
        orders: 0,
        goods: 0,
        disc: 0,
        pts: 0,
        ship: 0,
        collected: 0,
        cogs: 0,
        costedNet: 0,
      });
    }
    const byType = new Map<string, Bucket>();
    const byPay = new Map<string, Bucket>();
    const byChannel = new Map<string, Bucket>();
    const hours = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      orders: 0,
      totalCollected: 0,
    }));
    const prods = new Map<string, ProdAgg>();
    const cats = new Map<string, CatAgg>();
    const uncostedReasons: Record<string, number> = {};
    let uncostedQuantity = 0;
    const missingByIngredient = new Map<
      string,
      { name: string; quantity: number; revenue: number }
    >();
    const bump = (m: Map<string, Bucket>, key: string, amount: number) => {
      const b = m.get(key) ?? { orders: 0, totalCollected: 0 };
      b.orders += 1;
      b.totalCollected += amount;
      m.set(key, b);
    };

    for (const o of orders) {
      const total = num(o.totalAmount);
      const disc = num(o.discountAmount);
      const pts = num(o.pointDiscountAmount);
      const ship = num(o.shippingFee);
      const fin = num(o.finalAmount);
      // Tỉ lệ doanh thu hàng còn lại sau giảm giá cấp đơn + điểm — dùng để phân bổ vào từng dòng.
      const netFactor =
        total > 0 ? Math.max(0, (total - disc - pts) / total) : 0;

      s.orders += 1;
      s.goods += total;
      s.disc += disc;
      s.pts += pts;
      s.ship += ship;
      s.collected += fin;
      s.vat += num(o.vatAmount);

      const day = days.get(vnDay(o.createdAt));
      if (day) {
        day.orders += 1;
        day.goods += total;
        day.disc += disc;
        day.pts += pts;
        day.ship += ship;
        day.collected += fin;
      }
      bump(byType, o.type, fin);
      bump(byPay, o.paymentType, fin);
      bump(byChannel, channelOf(o.guestDeliveryName), fin);
      const h = hours[vnHour(o.createdAt)];
      h.orders += 1;
      h.totalCollected += fin;

      let orderCogs = 0;
      let orderCostedNet = 0;
      for (const it of o.items) {
        const lineRevenue = num(it.price) * it.quantity;
        s.itemsSold += it.quantity;

        const cat = cats.get(it.product.category.id) ?? {
          categoryId: it.product.category.id,
          categoryName: it.product.category.name,
          quantity: 0,
          goods: 0,
          cogs: 0,
          costedNet: 0,
          costedRev: 0,
        };
        const imgs = Array.isArray(it.product.imageUrls)
          ? (it.product.imageUrls as string[])
          : [];
        const prod = prods.get(it.product.id) ?? {
          productId: it.product.id,
          name: it.product.name,
          imageUrl: imgs[0] ?? null,
          categoryName: it.product.category.name,
          quantity: 0,
          goods: 0,
          cogs: 0,
          costedNet: 0,
          costedRev: 0,
        };
        prod.quantity += it.quantity;
        prod.goods += lineRevenue;
        cat.quantity += it.quantity;
        cat.goods += lineRevenue;

        const lc = lineCosts.get(lineCostKey(toCostLine(it)));
        if (lc?.ok) {
          const lineCost = lc.unitCost * it.quantity;
          const lineNet = lineRevenue * netFactor;
          s.cogs += lineCost;
          s.costedNet += lineNet;
          s.costedRev += lineRevenue;
          orderCogs += lineCost;
          orderCostedNet += lineNet;
          for (const t of [prod, cat]) {
            t.cogs += lineCost;
            t.costedNet += lineNet;
            t.costedRev += lineRevenue;
          }
        } else {
          uncostedQuantity += it.quantity;
          const reason = lc && !lc.ok ? lc.reason : 'no_recipe';
          uncostedReasons[reason] =
            (uncostedReasons[reason] ?? 0) + it.quantity;
          // Tên nguyên liệu thiếu giá vốn (nếu PricingCostService đã trả về)
          const missing = (lc as { missing?: string[] } | undefined)?.missing;
          for (const name of missing ?? []) {
            const m = missingByIngredient.get(name) ?? {
              name,
              quantity: 0,
              revenue: 0,
            };
            m.quantity += it.quantity;
            m.revenue += lineRevenue;
            missingByIngredient.set(name, m);
          }
        }
        prods.set(prod.productId, prod);
        cats.set(cat.categoryId, cat);
      }
      if (day) {
        day.cogs += orderCogs;
        day.costedNet += orderCostedNet;
      }
    }

    // ── Kết quả ──
    const grossProfit = s.costedNet - s.cogs;
    const netGoods = s.goods - s.disc - s.pts;
    const summary = {
      orders: s.orders,
      itemsSold: s.itemsSold,
      goodsRevenue: r0(s.goods),
      orderDiscount: r0(s.disc),
      pointDiscount: r0(s.pts),
      netGoodsRevenue: r0(netGoods),
      shippingFee: r0(s.ship),
      totalCollected: r0(s.collected),
      /** Chênh lệch giữa Σ finalAmount và (hàng − giảm giá − điểm + ship); bình thường ≈ 0. */
      reconcileDiff: r0(s.collected - (netGoods + s.ship)),
      vatIncluded: r0(s.vat),
      avgOrderValue: s.orders > 0 ? r0(s.collected / s.orders) : 0,
      discountRatePercent:
        s.goods > 0 ? r1(((s.disc + s.pts) / s.goods) * 100) : 0,
      cogs: r0(s.cogs),
      costedNetRevenue: r0(s.costedNet),
      grossProfit: r0(grossProfit),
      grossMarginPercent:
        s.costedNet > 0 ? r1((grossProfit / s.costedNet) * 100) : null,
      costCoveragePercent: s.goods > 0 ? r1((s.costedRev / s.goods) * 100) : 0,
      uncostedQuantity,
      uncostedReasons,
    };

    const daily = [...days.values()].map((d) => ({
      date: d.date,
      orders: d.orders,
      goodsRevenue: r0(d.goods),
      orderDiscount: r0(d.disc),
      pointDiscount: r0(d.pts),
      shippingFee: r0(d.ship),
      totalCollected: r0(d.collected),
      cogs: r0(d.cogs),
      grossProfit: r0(d.costedNet - d.cogs),
    }));

    const toSplit = (m: Map<string, Bucket>) =>
      [...m.entries()]
        .map(([key, v]) => ({
          key,
          orders: v.orders,
          totalCollected: r0(v.totalCollected),
        }))
        .sort((a, b) => b.totalCollected - a.totalCollected);

    const prodRow = (p: ProdAgg) => {
      const profit = p.costedNet - p.cogs;
      return {
        productId: p.productId,
        name: p.name,
        imageUrl: p.imageUrl,
        categoryName: p.categoryName,
        quantitySold: p.quantity,
        goodsRevenue: r0(p.goods),
        cogs: r0(p.cogs),
        grossProfit: r0(profit),
        marginPercent:
          p.costedNet > 0 ? r1((profit / p.costedNet) * 100) : null,
        costCoveragePercent:
          p.goods > 0 ? r1((p.costedRev / p.goods) * 100) : 0,
      };
    };
    const allProducts = [...prods.values()].map(prodRow);

    return {
      summary,
      daily,
      byOrderType: toSplit(byType),
      byPaymentType: toSplit(byPay),
      byChannel: toSplit(byChannel),
      byHour: hours.map((h) => ({
        ...h,
        totalCollected: r0(h.totalCollected),
      })),
      products: [...allProducts]
        .sort((a, b) => b.goodsRevenue - a.goodsRevenue)
        .slice(0, 50),
      lowPerformers: [...allProducts]
        .sort((a, b) => a.quantitySold - b.quantitySold)
        .slice(0, 10),
      categories: [...cats.values()]
        .map((c) => {
          const profit = c.costedNet - c.cogs;
          return {
            categoryId: c.categoryId,
            categoryName: c.categoryName,
            quantitySold: c.quantity,
            goodsRevenue: r0(c.goods),
            cogs: r0(c.cogs),
            grossProfit: r0(profit),
            marginPercent:
              c.costedNet > 0 ? r1((profit / c.costedNet) * 100) : null,
            costCoveragePercent:
              c.goods > 0 ? r1((c.costedRev / c.goods) * 100) : 0,
          };
        })
        .sort((a, b) => b.goodsRevenue - a.goodsRevenue),
      uncostedIngredients: [...missingByIngredient.values()]
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
        .map((m) => ({ ...m, revenue: r0(m.revenue) })),
    };
  }
}
