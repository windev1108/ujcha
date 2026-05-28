import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PointService } from './point.service';

@Injectable()
export class PointExpiryCronService {
  private readonly logger = new Logger(PointExpiryCronService.name);

  constructor(private readonly pointService: PointService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleExpirePoints() {
    try {
      const { expiredLots, totalPoints } = await this.pointService.expirePoints();
      if (expiredLots > 0) {
        this.logger.log(
          `Point expiry: ${expiredLots} lô, tổng ${totalPoints} điểm.`,
        );
      }
    } catch (err) {
      this.logger.error('Point expiry job failed', err);
    }
  }
}
