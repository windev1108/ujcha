import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminShopSettingsController } from './admin-shop-settings.controller';
import { AdminShopSettingsService } from './admin-shop-settings.service';

@Module({
  imports: [PrismaModule, AdminAuthModule],
  controllers: [AdminShopSettingsController],
  providers: [AdminShopSettingsService],
  exports: [AdminShopSettingsService],
})
export class AdminShopSettingsModule {}
