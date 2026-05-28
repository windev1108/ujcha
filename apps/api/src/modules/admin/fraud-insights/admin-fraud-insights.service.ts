import { Injectable } from '@nestjs/common';
import { FRAUD_LIMITS } from '../../fraud/config/fraud.config';
import { PrismaService } from '../../prisma/prisma.service';
import type { AdminFraudInsightsQueryDto } from './dto/admin-fraud-insights-query.dto';

@Injectable()
export class AdminFraudInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(query: AdminFraudInsightsQueryDto) {
    const minCluster = query.minCluster ?? 2;
    const limit = query.limit ?? 50;

    const suspiciousUsers = await this.prisma.user.findMany({
      where: { suspiciousAt: { not: null } },
      orderBy: { suspiciousAt: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        registrationIp: true,
        registrationDeviceId: true,
        suspiciousAt: true,
        suspiciousReason: true,
        createdAt: true,
      },
    });

    const sameIpClusters = await this.prisma.$queryRaw<
      Array<{ registrationIp: string; userCount: number }>
    >`
      SELECT "registrationIp", COUNT(*)::int as "userCount"
      FROM "User"
      WHERE "registrationIp" IS NOT NULL
      GROUP BY "registrationIp"
      HAVING COUNT(*) >= ${minCluster}
      ORDER BY COUNT(*) DESC
      LIMIT ${limit}
    `;

    const sameDeviceClusters = await this.prisma.$queryRaw<
      Array<{ registrationDeviceId: string; userCount: number }>
    >`
      SELECT "registrationDeviceId", COUNT(*)::int as "userCount"
      FROM "User"
      WHERE "registrationDeviceId" IS NOT NULL AND TRIM("registrationDeviceId") != ''
      GROUP BY "registrationDeviceId"
      HAVING COUNT(*) >= ${minCluster}
      ORDER BY COUNT(*) DESC
      LIMIT ${limit}
    `;

    return {
      fraudLimits: FRAUD_LIMITS,
      suspiciousUsers,
      sameIpClusters,
      sameDeviceClusters,
      notes: {
        suspiciousUsers:
          'Tài khoản bị đánh dấu bởi FraudService.evaluateUserAfterSignup (cùng IP đăng ký bất thường).',
        clusters:
          'Cụm cùng registrationIp hoặc registrationDeviceId — nghi farm/spam khi userCount cao.',
      },
    };
  }
}
