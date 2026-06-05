import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, VoucherDiscountType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../notification/notification.service';
import { assertVoucherRules } from './voucher-rule.validation';
import type { CreateVoucherDto } from './dto/create-voucher.dto';
import type { UpdateVoucherDto } from './dto/update-voucher.dto';

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function fmt(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n);
}

@Injectable()
export class AdminVoucherService {
  private readonly logger = new Logger(AdminVoucherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) { }

  validateRulePayload(dto: CreateVoucherDto) {
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (dto.startsAt && Number.isNaN(startsAt?.getTime())) {
      throw new BadRequestException({
        message: 'startsAt không hợp lệ.',
        code: 'VOUCHER_STARTS_INVALID',
      });
    }
    if (dto.endsAt && Number.isNaN(endsAt?.getTime())) {
      throw new BadRequestException({
        message: 'endsAt không hợp lệ.',
        code: 'VOUCHER_ENDS_INVALID',
      });
    }

    assertVoucherRules({
      discountType: dto.discountType,
      discountValue: dto.discountValue,
      minOrderAmount: dto.minOrderAmount ?? 0,
      maxDiscountAmount: dto.maxDiscountAmount ?? null,
      startsAt,
      endsAt,
      usageLimit: dto.usageLimit ?? null,
      perUserLimit: dto.perUserLimit ?? 1,
    });

    return { ok: true as const };
  }

  async list() {
    const rows = await this.prisma.voucher.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      include: {
        _count: { select: { referralRewards: true } },
      },
    });
    return rows.map(({ _count, ...v }) => ({
      ...v,
      issuedCount: _count.referralRewards,
    }));
  }

  /** Thống kê dashboard — không có bảng redemption đơn hàng; “đã gán” = ReferralReward gắn mã. */
  async getDashboardStats() {
    const now = new Date();
    const vouchers = await this.prisma.voucher.findMany({
      include: {
        _count: { select: { referralRewards: true } },
      },
    });

    const inEffect = (v: (typeof vouchers)[0]) => {
      if (!v.isActive) return false;
      if (v.startsAt && v.startsAt > now) return false;
      if (v.endsAt && v.endsAt < now) return false;
      return true;
    };

    const activeEffective = vouchers.filter(inEffect);
    const referralIssuedTotal = await this.prisma.referralReward.count({
      where: { refereeVoucherId: { not: null } },
    });

    let estimatedMaxDiscountVnd = 0;
    for (const v of activeEffective) {
      const dv = Number(v.discountValue);
      if (v.discountType === 'fixed_amount') {
        estimatedMaxDiscountVnd += dv;
      } else if (v.maxDiscountAmount != null) {
        estimatedMaxDiscountVnd += Number(v.maxDiscountAmount);
      }
    }

    let sumUsageLimit = 0;
    for (const v of vouchers) {
      if (v.usageLimit != null) {
        sumUsageLimit += v.usageLimit;
      }
    }
    const referralRatePercent =
      sumUsageLimit > 0
        ? Math.min(100, Math.round((referralIssuedTotal / sumUsageLimit) * 1000) / 10)
        : null;

    const withFutureEnd = vouchers
      .filter((v) => v.endsAt != null && v.endsAt > now && v.isActive)
      .sort((a, b) => a.endsAt!.getTime() - b.endsAt!.getTime());
    const next = withFutureEnd[0];
    const hoursLeft = next
      ? Math.max(0, (next.endsAt!.getTime() - now.getTime()) / 3600000)
      : null;

    return {
      totalVouchers: vouchers.length,
      activeEffectiveCount: activeEffective.length,
      referralIssuedTotal,
      referralRatePercent,
      estimatedMaxDiscountVnd,
      nextExpiring:
        next && hoursLeft != null
          ? {
            code: next.code,
            name: next.name,
            endsAt: next.endsAt!.toISOString(),
            hoursLeft: Math.round(hoursLeft * 10) / 10,
          }
          : null,
    };
  }

  async getById(id: string) {
    const row = await this.prisma.voucher.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({
        message: 'Không tìm thấy voucher.',
        code: 'VOUCHER_NOT_FOUND',
      });
    }
    return row;
  }

  async create(dto: CreateVoucherDto) {
    this.validateRulePayload(dto);

    const code = normalizeCode(dto.code);
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;

    const clash = await this.prisma.voucher.findUnique({ where: { code } });
    if (clash) {
      throw new BadRequestException({
        message: 'Mã voucher đã tồn tại.',
        code: 'VOUCHER_CODE_DUPLICATE',
      });
    }

    const voucher = await this.prisma.voucher.create({
      data: {
        code,
        name: dto.name.trim(),
        discountType: dto.discountType,
        discountValue: new Prisma.Decimal(dto.discountValue),
        minOrderAmount: new Prisma.Decimal(dto.minOrderAmount ?? 0),
        maxDiscountAmount:
          dto.maxDiscountAmount != null
            ? new Prisma.Decimal(dto.maxDiscountAmount)
            : null,
        startsAt,
        endsAt,
        usageLimit: dto.usageLimit ?? null,
        perUserLimit: dto.perUserLimit ?? 1,
        isActive: dto.isActive ?? true,
        isWelcome: dto.isWelcome ?? false,
      },
    });

    if (voucher.isActive) {
      void this.notifyVoucher(voucher).catch((err) => this.logger.error(err));
    }

    return voucher;
  }

  private async notifyVoucher(voucher: {
    code: string;
    name: string;
    discountType: VoucherDiscountType;
    discountValue: Prisma.Decimal;
    minOrderAmount: Prisma.Decimal;
    maxDiscountAmount: Prisma.Decimal | null;
  }) {
    const val = Number(voucher.discountValue);
    const min = Number(voucher.minOrderAmount);
    const max = voucher.maxDiscountAmount ? Number(voucher.maxDiscountAmount) : null;

    const discountStr =
      voucher.discountType === VoucherDiscountType.percent
        ? `Giảm ${val}%${max ? ` (tối đa ${fmt(max)}đ)` : ''}`
        : `Giảm ${fmt(val)}đ`;

    const minStr = min > 0 ? ` khi đặt từ ${fmt(min)}đ` : '';

    await this.notificationService.createAndBroadcastToAll({
      type: 'promotion',
      title: `Ưu đãi mới: ${voucher.name}`,
      content: `${discountStr}${minStr}. Dùng mã ${voucher.code}!`,
      data: { code: voucher.code },
    });
  }

  async update(id: string, dto: UpdateVoucherDto) {
    const existing = await this.getById(id);

    const nextCode = dto.code !== undefined ? normalizeCode(dto.code) : existing.code;
    if (dto.code !== undefined && nextCode !== existing.code) {
      const clash = await this.prisma.voucher.findUnique({
        where: { code: nextCode },
      });
      if (clash) {
        throw new BadRequestException({
          message: 'Mã voucher đã tồn tại.',
          code: 'VOUCHER_CODE_DUPLICATE',
        });
      }
    }

    const merged = {
      discountType: dto.discountType ?? existing.discountType,
      discountValue: dto.discountValue ?? existing.discountValue,
      minOrderAmount: dto.minOrderAmount ?? existing.minOrderAmount,
      maxDiscountAmount:
        dto.maxDiscountAmount !== undefined
          ? dto.maxDiscountAmount
          : existing.maxDiscountAmount,
      startsAt:
        dto.startsAt !== undefined
          ? dto.startsAt
            ? new Date(dto.startsAt)
            : null
          : existing.startsAt,
      endsAt:
        dto.endsAt !== undefined
          ? dto.endsAt
            ? new Date(dto.endsAt)
            : null
          : existing.endsAt,
      usageLimit:
        dto.usageLimit !== undefined ? dto.usageLimit : existing.usageLimit,
      perUserLimit: dto.perUserLimit ?? existing.perUserLimit,
    };

    assertVoucherRules({
      discountType: merged.discountType,
      discountValue: merged.discountValue,
      minOrderAmount: merged.minOrderAmount,
      maxDiscountAmount: merged.maxDiscountAmount,
      startsAt: merged.startsAt,
      endsAt: merged.endsAt,
      usageLimit: merged.usageLimit,
      perUserLimit: merged.perUserLimit,
    });

    return this.prisma.voucher.update({
      where: { id },
      data: {
        ...(dto.code !== undefined && { code: nextCode }),
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.discountType !== undefined && { discountType: dto.discountType }),
        ...(dto.discountValue !== undefined && {
          discountValue: new Prisma.Decimal(dto.discountValue),
        }),
        ...(dto.minOrderAmount !== undefined && {
          minOrderAmount: new Prisma.Decimal(dto.minOrderAmount),
        }),
        ...(dto.maxDiscountAmount !== undefined && {
          maxDiscountAmount:
            dto.maxDiscountAmount != null
              ? new Prisma.Decimal(dto.maxDiscountAmount)
              : null,
        }),
        ...(dto.startsAt !== undefined && {
          startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        }),
        ...(dto.endsAt !== undefined && {
          endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        }),
        ...(dto.usageLimit !== undefined && { usageLimit: dto.usageLimit }),
        ...(dto.perUserLimit !== undefined && {
          perUserLimit: dto.perUserLimit,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.isWelcome !== undefined && { isWelcome: dto.isWelcome }),
      },
    });
  }

  async remove(id: string) {
    await this.getById(id);
    await this.prisma.voucher.delete({ where: { id } });
  }
}
