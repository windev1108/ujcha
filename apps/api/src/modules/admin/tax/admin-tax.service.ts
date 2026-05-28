import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, OrderType, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateVatConfigDto } from './dto/create-vat-config.dto';
import type { UpdateVatConfigDto } from './dto/update-vat-config.dto';
import type {
  TaxOverviewQueryDto,
  TaxReportQueryDto,
  TaxTransactionQueryDto,
} from './dto/tax-query.dto';

const VN_TZ = '+07:00';
function vnStartOfDay(d: string): Date { return new Date(`${d}T00:00:00${VN_TZ}`); }
function vnEndOfDay(d: string): Date { return new Date(`${d}T23:59:59.999${VN_TZ}`); }
function vnTodayStr(): string {
  const vnNow = new Date(Date.now() + 7 * 3600_000);
  const y = vnNow.getUTCFullYear();
  const m = String(vnNow.getUTCMonth() + 1).padStart(2, '0');
  const day = String(vnNow.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Injectable()
export class AdminTaxService {
  constructor(private readonly prisma: PrismaService) {}

  async getVatConfigs() {
    return this.prisma.vatConfig.findMany({
      orderBy: { effectiveFrom: 'desc' },
      include: { _count: { select: { orders: true } } },
    });
  }

  async createVatConfig(dto: CreateVatConfigDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.isActive) {
        await tx.vatConfig.updateMany({ data: { isActive: false } });
      }
      return tx.vatConfig.create({
        data: {
          label: dto.label.trim(),
          vatPercent: new Prisma.Decimal(dto.vatPercent),
          effectiveFrom: new Date(dto.effectiveFrom),
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
          isActive: dto.isActive ?? false,
        },
      });
    });
  }

  async updateVatConfig(id: string, dto: UpdateVatConfigDto) {
    const existing = await this.prisma.vatConfig.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ message: 'Không tìm thấy cấu hình VAT.', code: 'VAT_CONFIG_NOT_FOUND' });
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isActive === true && !existing.isActive) {
        await tx.vatConfig.updateMany({ where: { id: { not: id } }, data: { isActive: false } });
      }
      return tx.vatConfig.update({
        where: { id },
        data: {
          ...(dto.label !== undefined && { label: dto.label.trim() }),
          ...(dto.vatPercent !== undefined && { vatPercent: new Prisma.Decimal(dto.vatPercent) }),
          ...(dto.effectiveFrom !== undefined && { effectiveFrom: new Date(dto.effectiveFrom) }),
          ...('effectiveTo' in dto && {
            effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
          }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });
    });
  }

  async deleteVatConfig(id: string) {
    const existing = await this.prisma.vatConfig.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });
    if (!existing) {
      throw new NotFoundException({ message: 'Không tìm thấy cấu hình VAT.', code: 'VAT_CONFIG_NOT_FOUND' });
    }
    if (existing.isActive) {
      throw new BadRequestException({ message: 'Không thể xoá cấu hình VAT đang dùng. Hãy kích hoạt cấu hình khác trước.', code: 'VAT_CONFIG_ACTIVE' });
    }
    if (existing._count.orders > 0) {
      throw new BadRequestException({ message: 'Cấu hình này đã gắn với đơn hàng, không thể xoá. Hãy tắt kích hoạt thay thế.', code: 'VAT_CONFIG_HAS_ORDERS' });
    }
    await this.prisma.vatConfig.delete({ where: { id } });
  }

  async getOverview(query: TaxOverviewQueryDto) {
    const today = vnTodayStr();
    const start = query.from ? vnStartOfDay(query.from) : vnStartOfDay(today);
    const end = query.to ? vnEndOfDay(query.to) : vnEndOfDay(today);

    const [allAgg, paidAgg, paymentsAgg] = await this.prisma.$transaction([
      this.prisma.order.aggregate({
        where: { createdAt: { gte: start, lte: end } },
        _sum: { finalAmount: true, vatAmount: true },
        _count: true,
      }),
      this.prisma.order.aggregate({
        where: { paymentStatus: PaymentStatus.paid, createdAt: { gte: start, lte: end } },
        _sum: { finalAmount: true, vatAmount: true },
        _count: true,
      }),
      this.prisma.payment.aggregate({
        where: { createdAt: { gte: start, lte: end } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const totalRevenue = Number(paidAgg._sum.finalAmount ?? 0);
    const totalVat = Number(paidAgg._sum.vatAmount ?? 0);
    const paidCount = paidAgg._count;
    const totalCount = allAgg._count;
    const paymentsTotal = Number(paymentsAgg._sum.amount ?? 0);
    const avgVatRate = totalRevenue > 0 ? (totalVat / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalVat,
      totalCount,
      paidCount,
      avgVatRate: Math.round(avgVatRate * 100) / 100,
      paymentsTotal,
      reconciliationDiff: Math.round((paymentsTotal - totalRevenue) * 100) / 100,
      range: { from: start.toISOString(), to: end.toISOString() },
    };
  }

  async getTransactions(query: TaxTransactionQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const today = vnTodayStr();
    const start = query.from ? vnStartOfDay(query.from) : vnStartOfDay(today);
    const end = query.to ? vnEndOfDay(query.to) : vnEndOfDay(today);

    const and: Prisma.OrderWhereInput[] = [{ createdAt: { gte: start, lte: end } }];

    if (query.status) and.push({ status: query.status as OrderStatus });
    if (query.type) and.push({ type: query.type as OrderType });
    if (query.q?.trim()) {
      const qx = query.q.trim();
      and.push({
        OR: [
          { paymentCode: { contains: qx, mode: 'insensitive' } },
          { user: { name: { contains: qx, mode: 'insensitive' } } },
          { user: { phone: { contains: qx, mode: 'insensitive' } } },
        ],
      });
    }

    const where: Prisma.OrderWhereInput = { AND: and };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          paymentCode: true,
          createdAt: true,
          type: true,
          status: true,
          paymentStatus: true,
          totalAmount: true,
          discountAmount: true,
          finalAmount: true,
          vatRate: true,
          vatAmount: true,
          vatConfigId: true,
          user: { select: { id: true, name: true, phone: true } },
        },
      }),
    ]);

    return { items: rows, total, page, pageSize };
  }

  async getReports(query: TaxReportQueryDto) {
    const today = vnTodayStr();
    const start = query.from ? vnStartOfDay(query.from) : vnStartOfDay(today);
    const end = query.to ? vnEndOfDay(query.to) : vnEndOfDay(today);
    const groupBy = query.groupBy ?? 'day';

    type ReportRow = { period: Date; orderCount: bigint; revenue: string; vatAmount: string };

    let rows: ReportRow[];
    if (groupBy === 'month') {
      rows = await this.prisma.$queryRaw<ReportRow[]>`
        SELECT
          DATE_TRUNC('month', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS period,
          COUNT(*)::bigint AS "orderCount",
          COALESCE(SUM(CASE WHEN "paymentStatus" = 'paid' THEN "finalAmount" ELSE 0 END), 0)::text AS revenue,
          COALESCE(SUM(CASE WHEN "paymentStatus" = 'paid' THEN "vatAmount" ELSE 0 END), 0)::text AS "vatAmount"
        FROM "Order"
        WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
        GROUP BY 1
        ORDER BY 1
      `;
    } else {
      rows = await this.prisma.$queryRaw<ReportRow[]>`
        SELECT
          DATE_TRUNC('day', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS period,
          COUNT(*)::bigint AS "orderCount",
          COALESCE(SUM(CASE WHEN "paymentStatus" = 'paid' THEN "finalAmount" ELSE 0 END), 0)::text AS revenue,
          COALESCE(SUM(CASE WHEN "paymentStatus" = 'paid' THEN "vatAmount" ELSE 0 END), 0)::text AS "vatAmount"
        FROM "Order"
        WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
        GROUP BY 1
        ORDER BY 1
      `;
    }

    return rows.map((r) => ({
      period: r.period instanceof Date
        ? r.period.toISOString().split('T')[0]!
        : String(r.period).split('T')[0] ?? String(r.period),
      orderCount: Number(r.orderCount),
      revenue: Number(r.revenue),
      vatAmount: Number(r.vatAmount),
    }));
  }

  async exportCsv(from?: string, to?: string): Promise<string> {
    const today = vnTodayStr();
    const start = from ? vnStartOfDay(from) : vnStartOfDay(today);
    const end = to ? vnEndOfDay(to) : vnEndOfDay(today);

    const rows = await this.prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end } },
      orderBy: { createdAt: 'asc' },
      select: {
        paymentCode: true,
        createdAt: true,
        type: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        discountAmount: true,
        finalAmount: true,
        vatRate: true,
        vatAmount: true,
        user: { select: { name: true, phone: true } },
      },
    });

    const escapeCell = (v: string) =>
      v.includes(',') || v.includes('"') || v.includes('\n')
        ? `"${v.replace(/"/g, '""')}"`
        : v;

    const header = ['Ngày', 'Mã đơn', 'Loại đơn', 'Trạng thái', 'Thanh toán', 'Khách hàng', 'Tổng tiền hàng', 'Giảm giá', 'Doanh thu (VND)', 'Thuế GTGT %', 'Thuế GTGT (VND)'];

    const typeLabel: Record<string, string> = { delivery: 'Giao hàng', table: 'Tại bàn', pickup: 'Mang về' };
    const statusLabel: Record<string, string> = { pending: 'Chờ xử lý', confirmed: 'Đã xác nhận', preparing: 'Đang chuẩn bị', ready: 'Sẵn sàng', delivering: 'Đang giao', completed: 'Hoàn thành', cancelled: 'Đã huỷ' };
    const paymentLabel: Record<string, string> = { paid: 'Đã thanh toán', pending: 'Chưa thanh toán' };

    const lines = rows.map((r) => {
      const vnDate = new Date(r.createdAt.getTime() + 7 * 3600_000);
      const dateStr = `${vnDate.getUTCFullYear()}-${String(vnDate.getUTCMonth() + 1).padStart(2, '0')}-${String(vnDate.getUTCDate()).padStart(2, '0')} ${String(vnDate.getUTCHours()).padStart(2, '0')}:${String(vnDate.getUTCMinutes()).padStart(2, '0')}`;
      const customer = r.user
        ? `${r.user.name}${r.user.phone ? ' (' + r.user.phone + ')' : ''}`
        : 'Khách lẻ';

      return [
        dateStr,
        r.paymentCode,
        typeLabel[r.type] ?? r.type,
        statusLabel[r.status] ?? r.status,
        paymentLabel[r.paymentStatus] ?? r.paymentStatus,
        customer,
        Number(r.totalAmount).toFixed(0),
        Number(r.discountAmount).toFixed(0),
        Number(r.finalAmount).toFixed(0),
        Number(r.vatRate).toFixed(2),
        Number(r.vatAmount).toFixed(0),
      ].map(escapeCell).join(',');
    });

    return [header.join(','), ...lines].join('\r\n');
  }
}
