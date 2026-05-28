import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PointSource, UserVoucherSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PointService } from './point.service';

@Injectable()
export class PointRewardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pointService: PointService,
  ) {}

  async listCatalog() {
    const rows = await this.prisma.pointRewardCatalog.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
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
            endsAt: true,
          },
        },
      },
    });

    return rows.map((r) => this.serialize(r));
  }

  async redeemReward(userId: string, catalogId: string) {
    const catalog = await this.prisma.pointRewardCatalog.findFirst({
      where: { id: catalogId, isActive: true },
      include: { voucher: { select: { id: true, isActive: true, endsAt: true } } },
    });

    if (!catalog) {
      throw new NotFoundException({
        message: 'Phần thưởng không tồn tại hoặc đã ngừng.',
        code: 'REWARD_NOT_FOUND',
      });
    }

    if (!catalog.voucher.isActive) {
      throw new BadRequestException({
        message: 'Voucher của phần thưởng đã bị vô hiệu.',
        code: 'REWARD_VOUCHER_INACTIVE',
      });
    }

    if (catalog.voucher.endsAt && catalog.voucher.endsAt < new Date()) {
      throw new BadRequestException({
        message: 'Voucher của phần thưởng đã hết hạn.',
        code: 'REWARD_VOUCHER_EXPIRED',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { pointBalance: true },
    });

    if (!user) {
      throw new NotFoundException({ message: 'User không tồn tại.', code: 'USER_NOT_FOUND' });
    }

    if (user.pointBalance < catalog.pointCost) {
      throw new BadRequestException({
        message: `Không đủ điểm. Cần ${catalog.pointCost} điểm, bạn có ${user.pointBalance} điểm.`,
        code: 'POINT_INSUFFICIENT',
      });
    }

    // Check if user already has this voucher (unused)
    const existing = await this.prisma.userVoucher.findFirst({
      where: { userId, voucherId: catalog.voucherId, usedAt: null },
    });
    if (existing) {
      throw new BadRequestException({
        message: 'Bạn đã có voucher này chưa sử dụng.',
        code: 'REWARD_VOUCHER_ALREADY_OWNED',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await this.pointService.spendPointsTx(tx, userId, catalog.pointCost, {
        source: PointSource.voucher_redeem,
        referenceId: catalog.id,
      });

      // upsert: first-time → create; re-redeem after use → reset usedAt to null
      await tx.userVoucher.upsert({
        where: { userId_voucherId: { userId, voucherId: catalog.voucherId } },
        create: {
          userId,
          voucherId: catalog.voucherId,
          source: UserVoucherSource.point_redeem,
        },
        update: {
          usedAt: null,
          source: UserVoucherSource.point_redeem,
        },
      });
    });

    return { success: true, message: 'Đổi điểm thành công. Voucher đã được thêm vào túi của bạn.' };
  }

  // ── Admin CRUD ─────────────────────────────────────────────────────────────

  async adminList() {
    const rows = await this.prisma.pointRewardCatalog.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
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
            endsAt: true,
            isActive: true,
          },
        },
      },
    });
    return rows.map((r) => this.serialize(r));
  }

  async adminCreate(dto: {
    name: string;
    description?: string | null;
    pointCost: number;
    voucherId: string;
    imageUrl?: string | null;
    isActive?: boolean;
    sortOrder?: number;
  }) {
    const voucher = await this.prisma.voucher.findUnique({ where: { id: dto.voucherId } });
    if (!voucher) {
      throw new NotFoundException({ message: 'Voucher không tồn tại.', code: 'VOUCHER_NOT_FOUND' });
    }

    const row = await this.prisma.pointRewardCatalog.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        pointCost: dto.pointCost,
        voucherId: dto.voucherId,
        imageUrl: dto.imageUrl ?? null,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: {
        voucher: {
          select: {
            id: true, code: true, name: true, discountType: true, discountValue: true,
            minOrderAmount: true, maxDiscountAmount: true, endsAt: true, isActive: true,
          },
        },
      },
    });
    return this.serialize(row);
  }

  async adminUpdate(
    id: string,
    dto: Partial<{
      name: string;
      description: string | null;
      pointCost: number;
      voucherId: string;
      imageUrl: string | null;
      isActive: boolean;
      sortOrder: number;
    }>,
  ) {
    const existing = await this.prisma.pointRewardCatalog.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ message: 'Phần thưởng không tồn tại.', code: 'REWARD_NOT_FOUND' });
    }

    if (dto.voucherId && dto.voucherId !== existing.voucherId) {
      const voucher = await this.prisma.voucher.findUnique({ where: { id: dto.voucherId } });
      if (!voucher) {
        throw new NotFoundException({ message: 'Voucher không tồn tại.', code: 'VOUCHER_NOT_FOUND' });
      }
    }

    const row = await this.prisma.pointRewardCatalog.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.pointCost !== undefined && { pointCost: dto.pointCost }),
        ...(dto.voucherId !== undefined && { voucherId: dto.voucherId }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
      include: {
        voucher: {
          select: {
            id: true, code: true, name: true, discountType: true, discountValue: true,
            minOrderAmount: true, maxDiscountAmount: true, endsAt: true, isActive: true,
          },
        },
      },
    });
    return this.serialize(row);
  }

  async adminDelete(id: string) {
    const existing = await this.prisma.pointRewardCatalog.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ message: 'Phần thưởng không tồn tại.', code: 'REWARD_NOT_FOUND' });
    }
    await this.prisma.pointRewardCatalog.delete({ where: { id } });
  }

  private serialize(row: {
    id: string;
    name: string;
    description: string | null;
    pointCost: number;
    imageUrl: string | null;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
    voucher: {
      id: string;
      code: string;
      name: string;
      discountType: string;
      discountValue: { toString(): string };
      minOrderAmount: { toString(): string };
      maxDiscountAmount: { toString(): string } | null;
      endsAt: Date | null;
      isActive?: boolean;
    };
  }) {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      pointCost: row.pointCost,
      imageUrl: row.imageUrl,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      voucher: {
        id: row.voucher.id,
        code: row.voucher.code,
        name: row.voucher.name,
        discountType: row.voucher.discountType,
        discountValue: row.voucher.discountValue.toString(),
        minOrderAmount: row.voucher.minOrderAmount.toString(),
        maxDiscountAmount: row.voucher.maxDiscountAmount?.toString() ?? null,
        endsAt: row.voucher.endsAt?.toISOString() ?? null,
        ...(row.voucher.isActive !== undefined && { isActive: row.voucher.isActive }),
      },
    };
  }
}
