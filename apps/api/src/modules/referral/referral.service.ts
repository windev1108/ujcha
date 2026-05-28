import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import {
  PaymentStatus,
  PointSource,
  PointTransactionType,
  ReferralRewardStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PointService } from '../point/point.service';

export type InvitationStatus =
  | 'rewarded'
  | 'pending_first_order'
  | 'rejected_blocked_ip'
  | 'rejected_blocked_device'
  | 'rejected_phone_not_verified'
  | 'rejected_below_min_amount'
  | 'eligible_processing';

export type ReferralInvitation = {
  id: string;
  name: string;
  emailMasked: string | null;
  phoneMasked: string | null;
  joinedAt: string;
  status: InvitationStatus;
  pointsGranted: number | null;
};

export type ReferralProgramPublicConfig = {
  isActive: boolean;
  referrerCommissionPercent: number;
  maxReferrerRewardsPerDay: number;
  minOrderAmount: string;
  blockSameIpAsReferrer: boolean;
  blockSameDeviceAsReferrer: boolean;
  bronzeThreshold: number;
  bronzePoints: number;
  silverThreshold: number;
  silverPoints: number;
  goldThreshold: number;
  goldPoints: number;
  diamondThreshold: number;
  diamondPoints: number;
};

export type ReferralMyStats = {
  inviteCount: number;
  successfulReferrals: number;
  pointsEarned: number;
  vouchersEarned: number;
  rewardsToday: number;
  recentRewards: Array<{
    id: string;
    referredUserName: string;
    pointsGranted: number;
    status: string;
    createdAt: string;
  }>;
  programConfig: ReferralProgramPublicConfig | null;
};

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(3, local.length));
  return `${visible}***@${domain}`;
}

function maskPhone(phone: string): string {
  if (phone.length <= 3) return '***';
  return `***${phone.slice(-3)}`;
}

export type MilestoneTierId = 'bronze' | 'silver' | 'gold' | 'diamond';

export type LeaderboardEntry = {
  rank: number;
  name: string;
  avatar: string | null;
  referralCode: string;
  successfulReferrals: number;
  tier: MilestoneTierId | null;
};

export const MILESTONE_TIERS: Record<
  MilestoneTierId,
  { threshold: number; points: number }
> = {
  bronze: { threshold: 5, points: 100 },
  silver: { threshold: 10, points: 250 },
  gold: { threshold: 50, points: 1000 },
  diamond: { threshold: 100, points: 3000 },
};

@Injectable()
export class ReferralService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pointService: PointService,
  ) {}

  async getMyStats(userId: string): Promise<ReferralMyStats> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });

    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);

    const [
      inviteCount,
      successfulReferrals,
      rewardsToday,
      pointsAgg,
      vouchersEarned,
      recentRewards,
      cfg,
    ] = await Promise.all([
      this.prisma.user.count({
        where: { referredBy: user?.referralCode ?? '' },
      }),
      this.prisma.referralReward.count({
        where: { beneficiaryId: userId, status: ReferralRewardStatus.credited },
      }),
      this.prisma.referralReward.count({
        where: {
          beneficiaryId: userId,
          status: ReferralRewardStatus.credited,
          createdAt: { gte: todayUtc },
        },
      }),
      this.prisma.pointTransaction.aggregate({
        where: {
          userId,
          type: PointTransactionType.earn,
          source: PointSource.referral,
        },
        _sum: { amount: true },
      }),
      this.prisma.referralReward.count({
        where: {
          beneficiaryId: userId,
          status: ReferralRewardStatus.credited,
          refereeVoucherId: { not: null },
        },
      }),
      this.prisma.referralReward.findMany({
        where: { beneficiaryId: userId, status: ReferralRewardStatus.credited },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          referrerPointsGranted: true,
          status: true,
          createdAt: true,
          referredUser: { select: { name: true } },
        },
      }),
      this.prisma.referralProgramConfig.findFirst({
        where: { isActive: true },
        select: {
          isActive: true,
          referrerCommissionPercent: true,
          maxReferrerRewardsPerDay: true,
          minOrderAmount: true,
          blockSameIpAsReferrer: true,
          blockSameDeviceAsReferrer: true,
          bronzeThreshold: true, bronzePoints: true,
          silverThreshold: true, silverPoints: true,
          goldThreshold: true, goldPoints: true,
          diamondThreshold: true, diamondPoints: true,
        },
      }),
    ]);

    return {
      inviteCount,
      successfulReferrals,
      rewardsToday,
      pointsEarned: Number(pointsAgg._sum.amount ?? 0),
      vouchersEarned,
      recentRewards: recentRewards.map((r) => ({
        id: r.id,
        referredUserName: r.referredUser.name,
        pointsGranted: r.referrerPointsGranted ?? 0,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
      programConfig: cfg
        ? {
            isActive: cfg.isActive,
            referrerCommissionPercent: cfg.referrerCommissionPercent,
            maxReferrerRewardsPerDay: cfg.maxReferrerRewardsPerDay,
            minOrderAmount: cfg.minOrderAmount.toString(),
            blockSameIpAsReferrer: cfg.blockSameIpAsReferrer,
            blockSameDeviceAsReferrer: cfg.blockSameDeviceAsReferrer,
            bronzeThreshold: cfg.bronzeThreshold,
            bronzePoints: cfg.bronzePoints,
            silverThreshold: cfg.silverThreshold,
            silverPoints: cfg.silverPoints,
            goldThreshold: cfg.goldThreshold,
            goldPoints: cfg.goldPoints,
            diamondThreshold: cfg.diamondThreshold,
            diamondPoints: cfg.diamondPoints,
          }
        : null,
    };
  }

  async getMyInvitations(userId: string): Promise<ReferralInvitation[]> {
    const [referrer, cfg] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          referralCode: true,
          registrationIp: true,
          registrationDeviceId: true,
        },
      }),
      this.prisma.referralProgramConfig.findFirst({
        select: {
          blockSameIpAsReferrer: true,
          blockSameDeviceAsReferrer: true,
          minOrderAmount: true,
        },
      }),
    ]);

    if (!referrer) return [];

    const invited = await this.prisma.user.findMany({
      where: { referredBy: referrer.referralCode },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        phoneVerifiedAt: true,
        registrationIp: true,
        registrationDeviceId: true,
        createdAt: true,
        orders: {
          where: { paymentStatus: PaymentStatus.paid },
          take: 1,
          select: { finalAmount: true },
        },
        referralRewardsInvited: {
          where: { beneficiaryId: userId },
          select: { status: true, referrerPointsGranted: true },
          take: 1,
        },
      },
    });

    return invited.map((u) => {
      const reward = u.referralRewardsInvited[0] ?? null;
      const creditedReward =
        reward?.status === ReferralRewardStatus.credited ? reward : null;

      let status: InvitationStatus;

      if (creditedReward) {
        status = 'rewarded';
      } else if (
        cfg?.blockSameIpAsReferrer &&
        referrer.registrationIp &&
        u.registrationIp &&
        referrer.registrationIp === u.registrationIp
      ) {
        status = 'rejected_blocked_ip';
      } else if (
        cfg?.blockSameDeviceAsReferrer &&
        referrer.registrationDeviceId &&
        u.registrationDeviceId &&
        referrer.registrationDeviceId === u.registrationDeviceId
      ) {
        status = 'rejected_blocked_device';
      } else if (!u.phoneVerifiedAt) {
        status = 'rejected_phone_not_verified';
      } else if (u.orders.length > 0) {
        const orderAmount = u.orders[0]?.finalAmount;
        const minAmount = cfg?.minOrderAmount;
        if (orderAmount && minAmount && orderAmount.lessThan(minAmount)) {
          status = 'rejected_below_min_amount';
        } else {
          status = 'eligible_processing';
        }
      } else {
        status = 'pending_first_order';
      }

      return {
        id: u.id,
        name: u.name,
        emailMasked: u.email ? maskEmail(u.email) : null,
        phoneMasked: u.phone ? maskPhone(u.phone) : null,
        joinedAt: u.createdAt.toISOString(),
        status,
        pointsGranted: creditedReward?.referrerPointsGranted ?? null,
      };
    });
  }

  async getPublicConfig(): Promise<ReferralProgramPublicConfig | null> {
    const cfg = await this.prisma.referralProgramConfig.findFirst({
      where: { isActive: true },
      select: {
        isActive: true,
        referrerCommissionPercent: true,
        maxReferrerRewardsPerDay: true,
        minOrderAmount: true,
        blockSameIpAsReferrer: true,
        blockSameDeviceAsReferrer: true,
        bronzeThreshold: true, bronzePoints: true,
        silverThreshold: true, silverPoints: true,
        goldThreshold: true, goldPoints: true,
        diamondThreshold: true, diamondPoints: true,
      },
    });
    if (!cfg) return null;
    return {
      isActive: cfg.isActive,
      referrerCommissionPercent: cfg.referrerCommissionPercent,
      maxReferrerRewardsPerDay: cfg.maxReferrerRewardsPerDay,
      minOrderAmount: cfg.minOrderAmount.toString(),
      blockSameIpAsReferrer: cfg.blockSameIpAsReferrer,
      blockSameDeviceAsReferrer: cfg.blockSameDeviceAsReferrer,
      bronzeThreshold: cfg.bronzeThreshold,
      bronzePoints: cfg.bronzePoints,
      silverThreshold: cfg.silverThreshold,
      silverPoints: cfg.silverPoints,
      goldThreshold: cfg.goldThreshold,
      goldPoints: cfg.goldPoints,
      diamondThreshold: cfg.diamondThreshold,
      diamondPoints: cfg.diamondPoints,
    };
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const cfg = await this.prisma.referralProgramConfig.findFirst({
      select: {
        bronzeThreshold: true,
        silverThreshold: true,
        goldThreshold: true,
        diamondThreshold: true,
      },
    });

    const grouped = await this.prisma.referralReward.groupBy({
      by: ['beneficiaryId'],
      where: { status: ReferralRewardStatus.credited },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    if (grouped.length === 0) return [];

    const userIds = grouped.map((g) => g.beneficiaryId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, avatar: true, referralCode: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return grouped.map((g, i) => {
      const u = userMap.get(g.beneficiaryId);
      const count = g._count.id;
      let tier: MilestoneTierId | null = null;
      if (cfg) {
        if (count >= cfg.diamondThreshold) tier = 'diamond';
        else if (count >= cfg.goldThreshold) tier = 'gold';
        else if (count >= cfg.silverThreshold) tier = 'silver';
        else if (count >= cfg.bronzeThreshold) tier = 'bronze';
      }
      return {
        rank: i + 1,
        name: u?.name ?? 'Ẩn danh',
        avatar: u?.avatar ?? null,
        referralCode: u?.referralCode ?? '',
        successfulReferrals: count,
        tier,
      };
    });
  }

  async getClaimedMilestones(userId: string): Promise<MilestoneTierId[]> {
    const claims = await this.prisma.referralMilestoneClaim.findMany({
      where: { userId },
      select: { tier: true },
    });
    return claims.map((c) => c.tier as MilestoneTierId);
  }

  async claimMilestoneTier(
    userId: string,
    tier: MilestoneTierId,
  ): Promise<{ points: number }> {
    const cfg = await this.prisma.referralProgramConfig.findFirst({
      select: {
        bronzeThreshold: true, bronzePoints: true,
        silverThreshold: true, silverPoints: true,
        goldThreshold: true, goldPoints: true,
        diamondThreshold: true, diamondPoints: true,
      },
    });
    if (!cfg) {
      throw new BadRequestException({ message: 'Chưa có cấu hình chương trình giới thiệu.', code: 'REFERRAL_CONFIG_MISSING' });
    }

    const tierMap: Record<MilestoneTierId, { threshold: number; points: number }> = {
      bronze: { threshold: cfg.bronzeThreshold, points: cfg.bronzePoints },
      silver: { threshold: cfg.silverThreshold, points: cfg.silverPoints },
      gold: { threshold: cfg.goldThreshold, points: cfg.goldPoints },
      diamond: { threshold: cfg.diamondThreshold, points: cfg.diamondPoints },
    };
    const tierConfig = tierMap[tier];

    const successfulReferrals = await this.prisma.referralReward.count({
      where: { beneficiaryId: userId, status: ReferralRewardStatus.credited },
    });

    if (successfulReferrals < tierConfig.threshold) {
      throw new BadRequestException({
        message: `Cần ít nhất ${tierConfig.threshold} lượt giới thiệu thành công để nhận mốc ${tier}.`,
        code: 'INSUFFICIENT_REFERRALS',
      });
    }

    try {
      const claim = await this.prisma.referralMilestoneClaim.create({
        data: { userId, tier, points: tierConfig.points },
      });
      await this.pointService.earnPoints(
        userId,
        tierConfig.points,
        PointSource.referral,
        claim.id,
      );
      return { points: tierConfig.points };
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException({
          message: 'Bạn đã nhận thưởng mốc này rồi.',
          code: 'MILESTONE_ALREADY_CLAIMED',
        });
      }
      throw err;
    }
  }
}
