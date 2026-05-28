import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentStatus,
  PointSource,
  PointTransactionType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AdminReferralInvitationsQueryDto } from './dto/admin-referral-invitations-query.dto';
import type { AdminReferralRewardsQueryDto } from './dto/admin-referral-rewards-query.dto';
import type { AdminReferralUsersQueryDto } from './dto/admin-referral-users-query.dto';
import type { UpdateReferralProgramDto } from './dto/update-referral-program.dto';

const inviteeSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  referredBy: true,
  referralCode: true,
  registrationIp: true,
  registrationDeviceId: true,
  createdAt: true,
} as const;

const referrerSelect = {
  id: true,
  name: true,
  phone: true,
  referralCode: true,
} as const;

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function addUtcDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function endOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}

function startOfUtcWeekMonday(d: Date): Date {
  const day = d.getUTCDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() - daysFromMonday);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function pctChange(cur: number, prev: number): number | null {
  if (prev <= 0) return cur > 0 ? 100 : null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

@Injectable()
export class AdminReferralService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ai mời ai: mỗi dòng = 1 user có referredBy, kèm thông tin referrer. */
  async listInvitations(query: AdminReferralInvitationsQueryDto) {
    const take = query.limit ?? 50;
    const skip = query.skip ?? 0;

    return this.prisma.user.findMany({
      where: {
        referredBy: query.referrerCode
          ? query.referrerCode
          : { not: null },
      },
      select: {
        ...inviteeSelect,
        referrer: { select: referrerSelect },
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });
  }

  /** Số lượng người được mời theo mã referrer (referredBy). */
  async inviteCountsByReferrer() {
    const rows = await this.prisma.user.groupBy({
      by: ['referredBy'],
      where: { referredBy: { not: null } },
      _count: { _all: true },
    });
    return rows.map((r) => ({
      referrerReferralCode: r.referredBy,
      inviteCount: r._count._all,
    }));
  }

  async listRewards(query: AdminReferralRewardsQueryDto) {
    const take = query.limit ?? 50;
    const skip = query.skip ?? 0;
    const where = {
      ...(query.beneficiaryId && { beneficiaryId: query.beneficiaryId }),
      ...(query.referredUserId && { referredUserId: query.referredUserId }),
      ...(query.status && { status: query.status }),
    };

    const [items, total] = await Promise.all([
      this.prisma.referralReward.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: {
          beneficiary: {
            select: { id: true, name: true, referralCode: true, phone: true },
          },
          referredUser: {
            select: { id: true, name: true, phone: true },
          },
          order: {
            select: {
              id: true,
              paymentCode: true,
              finalAmount: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.referralReward.count({ where }),
    ]);

    return { items, total };
  }

  async getRewardById(id: string) {
    const row = await this.prisma.referralReward.findUnique({
      where: { id },
      include: {
        beneficiary: {
          select: { id: true, name: true, referralCode: true, phone: true },
        },
        referredUser: { select: { id: true, name: true, phone: true } },
        order: true,
      },
    });
    if (!row) {
      throw new NotFoundException({
        message: 'Không tìm thấy reward.',
        code: 'REFERRAL_REWARD_NOT_FOUND',
      });
    }
    return row;
  }

  /** Dashboard: thống kê, top referrer, biểu đồ 30 ngày. */
  async getDashboard() {
    const now = new Date();
    const todayStart = startOfUtcDay(now);
    const weekStart = startOfUtcWeekMonday(now);

    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const dayOfMonth = now.getUTCDate();
    const thisMonthStart = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
    const prevMonthPeriodStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
    const prevMonthPeriodEnd = new Date(
      Date.UTC(y, m - 1, dayOfMonth, 23, 59, 59, 999),
    );

    const referredBase = { referredBy: { not: null } } as const;

    const growthDayPromises = Array.from({ length: 30 }, (_, i) => {
      const dayStart = addUtcDays(todayStart, -29 + i);
      const dayEnd = endOfUtcDay(dayStart);
      return this.prisma.user
        .count({
          where: {
            ...referredBase,
            createdAt: { gte: dayStart, lte: dayEnd },
          },
        })
        .then((count) => ({
          date: dayStart.toISOString().slice(0, 10),
          count,
        }));
    });

    const [
      totalReferralsAllTime,
      referralsThisMonthToDate,
      referralsPrevMonthSamePeriod,
      paidOrdersFromReferred,
      referredUsersTotal,
      referredUsersWithPaidOrder,
      pointsAgg,
      newReferralsThisWeek,
      topUsers,
      growthByDay,
      bronzeClaimCount,
      silverClaimCount,
      goldClaimCount,
      diamondClaimCount,
      programCfg,
    ] = await Promise.all([
      this.prisma.user.count({ where: referredBase }),
      this.prisma.user.count({
        where: { ...referredBase, createdAt: { gte: thisMonthStart, lte: now } },
      }),
      this.prisma.user.count({
        where: {
          ...referredBase,
          createdAt: { gte: prevMonthPeriodStart, lte: prevMonthPeriodEnd },
        },
      }),
      this.prisma.order.count({
        where: {
          paymentStatus: PaymentStatus.paid,
          user: { referredBy: { not: null } },
        },
      }),
      this.prisma.user.count({ where: referredBase }),
      this.prisma.user.count({
        where: {
          ...referredBase,
          orders: { some: { paymentStatus: PaymentStatus.paid } },
        },
      }),
      this.prisma.pointTransaction.aggregate({
        where: {
          type: PointTransactionType.earn,
          source: PointSource.referral,
        },
        _sum: { amount: true },
      }),
      this.prisma.user.count({
        where: {
          ...referredBase,
          createdAt: { gte: weekStart, lte: now },
        },
      }),
      this.prisma.user.findMany({
        where: { referrals: { some: {} } },
        orderBy: { referrals: { _count: 'desc' } },
        take: 5,
        select: {
          id: true,
          name: true,
          referralCode: true,
          addresses: {
            take: 1,
            orderBy: { isDefault: 'desc' },
            select: { fullAddress: true },
          },
          _count: { select: { referrals: true } },
        },
      }),
      Promise.all(growthDayPromises),
      this.prisma.referralMilestoneClaim.count({ where: { tier: 'bronze' } }),
      this.prisma.referralMilestoneClaim.count({ where: { tier: 'silver' } }),
      this.prisma.referralMilestoneClaim.count({ where: { tier: 'gold' } }),
      this.prisma.referralMilestoneClaim.count({ where: { tier: 'diamond' } }),
      this.prisma.referralProgramConfig.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: {
          bronzeThreshold: true, bronzePoints: true,
          silverThreshold: true, silverPoints: true,
          goldThreshold: true, goldPoints: true,
          diamondThreshold: true, diamondPoints: true,
        },
      }),
    ]);

    const referralPointsSum = pointsAgg._sum.amount ?? 0;

    const conversionPercent =
      referredUsersTotal > 0
        ? Math.round((referredUsersWithPaidOrder / referredUsersTotal) * 1000) /
          10
        : null;

    const momReferralSignupsPct = pctChange(
      referralsThisMonthToDate,
      referralsPrevMonthSamePeriod,
    );

    const pointSums = await Promise.all(
      topUsers.map((u) =>
        this.prisma.pointTransaction.aggregate({
          where: {
            userId: u.id,
            source: PointSource.referral,
            type: PointTransactionType.earn,
          },
          _sum: { amount: true },
        }),
      ),
    );

    const topReferrers = topUsers.map((u, i) => ({
      rank: i + 1,
      userId: u.id,
      name: u.name,
      location: u.addresses[0]?.fullAddress ?? '—',
      inviteCount: u._count.referrals,
      pointsFromReferral: pointSums[i]?._sum.amount ?? 0,
    }));

    return {
      stats: {
        totalReferralsAllTime,
        referralSignupsMomPercent: momReferralSignupsPct,
        successfulPaidOrders: paidOrdersFromReferred,
        conversionPercent,
        totalPointsRewarded: referralPointsSum,
        newReferralSignupsThisWeek: newReferralsThisWeek,
      },
      topReferrers,
      referralSignupsByDay: growthByDay,
      milestoneClaims: {
        bronze: bronzeClaimCount,
        silver: silverClaimCount,
        gold: goldClaimCount,
        diamond: diamondClaimCount,
      },
      milestoneConfig: programCfg ?? undefined,
    };
  }

  async listReferralUsers(query: AdminReferralUsersQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const skip = (page - 1) * pageSize;
    const q = query.q?.trim();

    const where: Prisma.UserWhereInput = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
            { referralCode: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          avatar: true,
          referralCode: true,
          phoneVerifiedAt: true,
          pointBalance: true,
          createdAt: true,
          _count: { select: { referrals: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async getProgramConfig() {
    const row = await this.prisma.referralProgramConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
    });
    if (!row) return null;
    return {
      id: row.id,
      isActive: row.isActive,
      minOrderAmount: row.minOrderAmount.toString(),
      referrerCommissionPercent: row.referrerCommissionPercent,
      welcomeVoucherId: row.welcomeVoucherId ?? null,
      maxReferrerRewardsPerDay: row.maxReferrerRewardsPerDay,
      blockSameIpAsReferrer: row.blockSameIpAsReferrer,
      blockSameDeviceAsReferrer: row.blockSameDeviceAsReferrer,
      bronzeThreshold: row.bronzeThreshold,
      bronzePoints: row.bronzePoints,
      silverThreshold: row.silverThreshold,
      silverPoints: row.silverPoints,
      goldThreshold: row.goldThreshold,
      goldPoints: row.goldPoints,
      diamondThreshold: row.diamondThreshold,
      diamondPoints: row.diamondPoints,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateProgramConfig(dto: UpdateReferralProgramDto) {
    const existing = await this.prisma.referralProgramConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
    });
    if (!existing) {
      throw new BadRequestException({
        message: 'Chưa có cấu hình chương trình giới thiệu trên hệ thống.',
        code: 'REFERRAL_PROGRAM_CONFIG_MISSING',
      });
    }

    const data: Prisma.ReferralProgramConfigUpdateInput = {};
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.minOrderAmount !== undefined) {
      data.minOrderAmount = new Prisma.Decimal(dto.minOrderAmount);
    }
    if (dto.referrerCommissionPercent !== undefined) {
      data.referrerCommissionPercent = dto.referrerCommissionPercent;
    }
    if (dto.welcomeVoucherId !== undefined) {
      data.welcomeVoucher = dto.welcomeVoucherId
        ? { connect: { id: dto.welcomeVoucherId } }
        : { disconnect: true };
    }
    if (dto.maxReferrerRewardsPerDay !== undefined) {
      data.maxReferrerRewardsPerDay = dto.maxReferrerRewardsPerDay;
    }
    if (dto.blockSameIpAsReferrer !== undefined) {
      data.blockSameIpAsReferrer = dto.blockSameIpAsReferrer;
    }
    if (dto.blockSameDeviceAsReferrer !== undefined) {
      data.blockSameDeviceAsReferrer = dto.blockSameDeviceAsReferrer;
    }
    if (dto.bronzeThreshold !== undefined) data.bronzeThreshold = dto.bronzeThreshold;
    if (dto.bronzePoints !== undefined) data.bronzePoints = dto.bronzePoints;
    if (dto.silverThreshold !== undefined) data.silverThreshold = dto.silverThreshold;
    if (dto.silverPoints !== undefined) data.silverPoints = dto.silverPoints;
    if (dto.goldThreshold !== undefined) data.goldThreshold = dto.goldThreshold;
    if (dto.goldPoints !== undefined) data.goldPoints = dto.goldPoints;
    if (dto.diamondThreshold !== undefined) data.diamondThreshold = dto.diamondThreshold;
    if (dto.diamondPoints !== undefined) data.diamondPoints = dto.diamondPoints;

    await this.prisma.referralProgramConfig.update({
      where: { id: existing.id },
      data,
    });

    return this.getProgramConfig();
  }
}
