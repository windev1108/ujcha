import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis/redis.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminShopSettingsController } from './admin-shop-settings.controller';
import { AdminShopSettingsService } from './admin-shop-settings.service';

@Module({
  imports: [PrismaModule, RedisModule, AdminAuthModule],
  controllers: [AdminShopSettingsController],
  providers: [AdminShopSettingsService],
  exports: [AdminShopSettingsService],
})
export class AdminShopSettingsModule {}
