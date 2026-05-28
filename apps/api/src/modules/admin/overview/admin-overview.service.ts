import { Injectable } from '@nestjs/common';
import {
    OrderType,
    PaymentStatus,
    PointTransactionType,
} from '@prisma/client';
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
    constructor(private readonly prisma: PrismaService) { }

    async getDashboard() {
        const now = new Date();
        const todayStart = startOfUtcDay(now);

        /** 7 ngày gần nhất (UTC), phần tử [0] = cũ nhất */
        const last7Start = addUtcDays(todayStart, -6);
        const last7End = endOfUtcDay(todayStart);

        /** 7 ngày trước đó */
        const prev7Start = addUtcDays(todayStart, -13);
        const prev7End = endOfUtcDay(addUtcDays(todayStart, -7));

        /** 30 ngày cho phân bổ loại đơn */
        const typeRangeStart = addUtcDays(todayStart, -29);
        const typeRangeEnd = endOfUtcDay(todayStart);

        const revenueDayPromises = Array.from({ length: 7 }, (_, i) => {
            const dayStart = addUtcDays(last7Start, i);
            const dayEnd = endOfUtcDay(dayStart);
            return this.prisma.order
                .aggregate({
                    where: {
                        paymentStatus: PaymentStatus.paid,
                        createdAt: { gte: dayStart, lte: dayEnd },
                    },
                    _sum: { finalAmount: true },
                })
                .then((agg) => ({
                    date: dayStart.toISOString().slice(0, 10),
                    revenue: Number(agg._sum.finalAmount ?? 0),
                }));
        });

        const last7StartStr = last7Start.toISOString().slice(0, 10)
    const last7EndStr = last7End.toISOString().slice(0, 10)

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
        ] = await Promise.all([
            Promise.all(revenueDayPromises),
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
                    user: { select: { name: true, phone: true } },
                    guestDeliveryName: true,
                    guestDeliveryPhone: true,
                    items: {
                        take: 1,
                        orderBy: { id: 'asc' },
                        select: {
                            product: { select: { name: true } },
                        },
                    },
                },
            }),
            this.prisma.order.count(),
            this.prisma.platformRevenueSummary.findMany({
                where: { date: { gte: last7StartStr, lte: last7EndStr } },
                orderBy: [{ platform: 'asc' }, { date: 'desc' }],
            }),
        ]);

        const typeMap = new Map<OrderType, number>();
        for (const r of orderTypeRows) {
            typeMap.set(r.type, r._count._all);
        }
        const delivery = typeMap.get(OrderType.delivery) ?? 0;
        const pickup = typeMap.get(OrderType.pickup) ?? 0;
        const table = typeMap.get(OrderType.table) ?? 0;
        const typeTotal = delivery + pickup + table || 1;

        // ── Merge platform earnings into revenue ──────────────────────────
        const platformByDate = new Map<string, number>();
        const platformBreakdown: Record<string, number> = {};
        for (const r of platformRevenue) {
            platformByDate.set(r.date, (platformByDate.get(r.date) ?? 0) + r.totalEarnings);
            platformBreakdown[r.platform] = (platformBreakdown[r.platform] ?? 0) + r.totalEarnings;
        }
        const platformTotal = Object.values(platformBreakdown).reduce((s, v) => s + v, 0);
        const revenueByDayCombined = revenueByDay.map(d => ({
            date: d.date,
            revenue: d.revenue + (platformByDate.get(d.date) ?? 0),
            systemRevenue: d.revenue,
            platformRevenue: platformByDate.get(d.date) ?? 0,
        }));

        return {
            range: {
                last7: {
                    from: last7Start.toISOString(),
                    to: last7End.toISOString(),
                },
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
                    (o.guestDeliveryPhone ? `Khách ${o.guestDeliveryPhone}` : "Anonymous"),
                firstItemName: o.items[0]?.product?.name ?? "—",
            })),
            totalOrdersAllTime: totalOrdersCount,
            platformRevenueSynced: platformRevenue.map(r => ({
                id: r.id,
                platform: r.platform,
                date: r.date,
                totalEarnings: r.totalEarnings,
                revenue: r.revenue,
                completedOrders: r.completedOrders,
                cancelledOrders: r.cancelledOrders,
                syncedAt: r.syncedAt.toISOString(),
            })),
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

    /** User có mã giới thiệu người giới thiệu, đăng ký trong khoảng */
    private countReferralSignups(from: Date, to: Date) {
        return this.prisma.user.count({
            where: {
                referredBy: { not: null },
                createdAt: { gte: from, lte: to },
            },
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
}
