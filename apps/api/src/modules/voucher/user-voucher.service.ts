import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserVoucherService {
  private readonly logger = new Logger(UserVoucherService.name);

  constructor(private readonly prisma: PrismaService) {}

  async grantWelcomeVoucher(userId: string): Promise<void> {
    const cfg = await this.prisma.referralProgramConfig.findFirst({
      where: { isActive: true },
      select: { welcomeVoucherId: true },
    });

    const template = cfg?.welcomeVoucherId
      ? await this.prisma.voucher.findUnique({
          where: { id: cfg.welcomeVoucherId, isActive: true },
          select: { id: true, code: true },
        })
      : await this.prisma.voucher.findFirst({
          where: { isWelcome: true, isActive: true },
          select: { id: true, code: true },
        });

    if (!template) return;

    const existing = await this.prisma.userVoucher.findUnique({
      where: { userId_voucherId: { userId, voucherId: template.id } },
    });
    if (existing) return;

    await this.prisma.userVoucher.create({
      data: { userId, voucherId: template.id, source: 'welcome' },
    });

    this.logger.log(`Welcome voucher ${template.code} granted to user ${userId}`);
  }

  async getMyVouchers(userId: string) {
    const now = new Date();
    const rows = await this.prisma.userVoucher.findMany({
      where: { userId },
      include: {
        voucher: {
          select: {
            id: true,
            code: true,
            name: true,
            discountType: true,
            discountValue: true,
            minOrderAmount: true,
            maxDiscountAmount: true,
            startsAt: true,
            endsAt: true,
            isActive: true,
          },
        },
      },
      orderBy: [{ usedAt: 'asc' }, { createdAt: 'desc' }],
    });

    return rows.map((r) => ({
      id: r.id,
      source: r.source,
      usedAt: r.usedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      voucher: {
        id: r.voucher.id,
        code: r.voucher.code,
        name: r.voucher.name,
        discountType: r.voucher.discountType as 'percent' | 'fixed_amount',
        discountValue: r.voucher.discountValue.toString(),
        minOrderAmount: r.voucher.minOrderAmount.toString(),
        maxDiscountAmount: r.voucher.maxDiscountAmount?.toString() ?? null,
        startsAt: r.voucher.startsAt?.toISOString() ?? null,
        endsAt: r.voucher.endsAt?.toISOString() ?? null,
        isActive: r.voucher.isActive,
        isExpired: r.voucher.endsAt ? r.voucher.endsAt < now : false,
      },
    }));
  }
}
