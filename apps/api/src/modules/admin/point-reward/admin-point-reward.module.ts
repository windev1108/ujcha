import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PointModule } from '../../point/point.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminPointRewardController } from './admin-point-reward.controller';

@Module({
  imports: [PrismaModule, AdminAuthModule, PointModule],
  controllers: [AdminPointRewardController],
})
export class AdminPointRewardModule {}
