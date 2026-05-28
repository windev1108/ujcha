import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePointCampaignDto } from './dto/create-point-campaign.dto';
import { UpdatePointCampaignDto } from './dto/update-point-campaign.dto';
import { UpdatePointConfigDto } from './dto/update-point-config.dto';

function dec(n: number | Prisma.Decimal) {
  return new Prisma.Decimal(n);
}

@Injectable()
export class AdminPointConfigService {
  constructor(private readonly prisma: PrismaService) { }

  async getCurrentConfig() {
    const now = new Date();

    const config = await this.prisma.pointConfig.findFirst({
      where: { isActive: true },
    });
    if (!config) {
      throw new NotFoundException({
        message: 'Chưa có cấu hình điểm đang active.',
        code: 'POINT_CONFIG_NO_ACTIVE',
      });
    }

    const activeCampaigns = await this.prisma.pointCampaign.findMany({
      where: {
        isActive: true,
        startAt: { lte: now },
        endAt: { gte: now },
      },
      orderBy: [{ earnPercent: 'desc' }, { createdAt: 'desc' }],
    });

    const activeCampaign = activeCampaigns[0] ?? null;
    const effectiveEarnPercent = activeCampaign
      ? activeCampaign.earnPercent
      : config.earnPercent;

    return {
      config: this.serializeConfig(config),
      activeCampaign: activeCampaign
        ? this.serializeCampaign(activeCampaign)
        : null,
      earnPercentSource: activeCampaign ? ('campaign' as const) : ('config' as const),
      effectiveEarnPercent: effectiveEarnPercent.toString(),
    };
  }

  async updateConfig(id: string, dto: UpdatePointConfigDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.pointConfig.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException({
          message: 'Không tìm thấy PointConfig.',
          code: 'POINT_CONFIG_NOT_FOUND',
        });
      }

      if (dto.isActive === false) {
        const otherActive = await tx.pointConfig.count({
          where: { isActive: true, id: { not: id } },
        });
        if (otherActive === 0) {
          throw new BadRequestException({
            message: 'Phải giữ ít nhất một cấu hình đang active.',
            code: 'POINT_CONFIG_MUST_KEEP_ONE_ACTIVE',
          });
        }
      }

      if (dto.isActive === true) {
        await tx.pointConfig.updateMany({ data: { isActive: false } });
      }

      const data: Prisma.PointConfigUpdateInput = {};
      if (dto.pointRate !== undefined) data.pointRate = dto.pointRate;
      if (dto.earnPercent !== undefined) data.earnPercent = dec(dto.earnPercent);
      if (dto.maxUsagePercent !== undefined) {
        data.maxUsagePercent = dec(dto.maxUsagePercent);
      }
      if (dto.minOrderAmount !== undefined) {
        data.minOrderAmount = dec(dto.minOrderAmount);
      }
      if (dto.delayHours !== undefined) data.delayHours = dto.delayHours;
      if (dto.expireDays !== undefined) data.expireDays = dto.expireDays;
      if (dto.isActive !== undefined) data.isActive = dto.isActive;

      const updated = await tx.pointConfig.update({
        where: { id },
        data,
      });

      return this.serializeConfig(updated);
    });
  }

  async getStats() {
    const [sumBalance, usersWithPoints, membersVerified] = await Promise.all([
      this.prisma.user.aggregate({
        _sum: { pointBalance: true },
      }),
      this.prisma.user.count({
        where: { pointBalance: { gt: 0 } },
      }),
      this.prisma.user.count({
        where: { phoneVerifiedAt: { not: null } },
      }),
    ]);

    return {
      totalPointsInCirculation: sumBalance._sum.pointBalance ?? 0,
      usersWithPoints,
      membersVerified,
    };
  }

  async getAllCampaigns() {
    const rows = await this.prisma.pointCampaign.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((c) => this.serializeCampaign(c));
  }

  async createCampaign(dto: CreatePointCampaignDto) {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    this.assertCampaignWindow(startAt, endAt);

    const created = await this.prisma.pointCampaign.create({
      data: {
        name: dto.name,
        earnPercent: dec(dto.earnPercent),
        startAt,
        endAt,
        isActive: dto.isActive ?? true,
      },
    });
    return this.serializeCampaign(created);
  }

  async updateCampaign(id: string, dto: UpdatePointCampaignDto) {
    const existing = await this.prisma.pointCampaign.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException({
        message: 'Không tìm thấy campaign.',
        code: 'POINT_CAMPAIGN_NOT_FOUND',
      });
    }

    const startAt = dto.startAt !== undefined ? new Date(dto.startAt) : existing.startAt;
    const endAt = dto.endAt !== undefined ? new Date(dto.endAt) : existing.endAt;
    if (dto.startAt !== undefined || dto.endAt !== undefined) {
      this.assertCampaignWindow(startAt, endAt);
    }

    const data: Prisma.PointCampaignUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.earnPercent !== undefined) data.earnPercent = dec(dto.earnPercent);
    if (dto.startAt !== undefined) data.startAt = startAt;
    if (dto.endAt !== undefined) data.endAt = endAt;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.pointCampaign.update({
      where: { id },
      data,
    });
    return this.serializeCampaign(updated);
  }

  async toggleCampaign(id: string) {
    const existing = await this.prisma.pointCampaign.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException({
        message: 'Không tìm thấy campaign.',
        code: 'POINT_CAMPAIGN_NOT_FOUND',
      });
    }

    const updated = await this.prisma.pointCampaign.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });
    return this.serializeCampaign(updated);
  }

  private assertCampaignWindow(startAt: Date, endAt: Date) {
    if (startAt >= endAt) {
      throw new BadRequestException({
        message: 'endAt phải sau startAt.',
        code: 'POINT_CAMPAIGN_INVALID_WINDOW',
      });
    }
  }

  private serializeConfig(row: {
    id: string;
    pointRate: number;
    earnPercent: Prisma.Decimal;
    maxUsagePercent: Prisma.Decimal;
    minOrderAmount: Prisma.Decimal;
    delayHours: number;
    expireDays: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      pointRate: row.pointRate,
      earnPercent: row.earnPercent.toString(),
      maxUsagePercent: row.maxUsagePercent.toString(),
      minOrderAmount: row.minOrderAmount.toString(),
      delayHours: row.delayHours,
      expireDays: row.expireDays,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private serializeCampaign(row: {
    id: string;
    name: string;
    earnPercent: Prisma.Decimal;
    startAt: Date;
    endAt: Date;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      name: row.name,
      earnPercent: row.earnPercent.toString(),
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString(),
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
