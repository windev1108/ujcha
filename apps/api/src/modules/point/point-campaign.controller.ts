import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('campaigns')
@Controller('campaigns')
export class PointCampaignController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('active')
  @ApiOperation({ summary: 'Campaign tích điểm đang chạy + config nền (public)' })
  async getActiveCampaign() {
    const now = new Date();

    const [config, campaign] = await Promise.all([
      this.prisma.pointConfig.findFirst({ where: { isActive: true } }),
      this.prisma.pointCampaign.findFirst({
        where: { isActive: true, startAt: { lte: now }, endAt: { gte: now } },
        orderBy: [{ earnPercent: 'desc' }, { createdAt: 'desc' }],
        select: { id: true, name: true, earnPercent: true, startAt: true, endAt: true },
      }),
    ]);

    if (!campaign) return null;

    return {
      id: campaign.id,
      name: campaign.name,
      earnPercent: campaign.earnPercent.toString(),
      baseEarnPercent: config ? config.earnPercent.toString() : '0',
      pointRate: config ? config.pointRate : 100,
      startAt: campaign.startAt.toISOString(),
      endAt: campaign.endAt.toISOString(),
    };
  }
}
