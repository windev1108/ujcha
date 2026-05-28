import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('promotions')
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Khuyến mãi đang chạy — campaign + point config (public)' })
  async getAll() {
    const now = new Date();

    const [config, campaign] = await Promise.all([
      this.prisma.pointConfig.findFirst({ where: { isActive: true } }),

      this.prisma.pointCampaign.findFirst({
        where: { isActive: true, startAt: { lte: now }, endAt: { gte: now } },
        orderBy: [{ earnPercent: 'desc' }, { createdAt: 'desc' }],
        select: { id: true, name: true, earnPercent: true, startAt: true, endAt: true },
      }),
    ]);

    return {
      campaign: campaign
        ? {
            id: campaign.id,
            name: campaign.name,
            earnPercent: campaign.earnPercent.toString(),
            baseEarnPercent: config ? config.earnPercent.toString() : '0',
            pointRate: config ? config.pointRate : 100,
            startAt: campaign.startAt.toISOString(),
            endAt: campaign.endAt.toISOString(),
          }
        : null,

      pointConfig: config
        ? { earnPercent: config.earnPercent.toString(), pointRate: config.pointRate }
        : null,
    };
  }
}
