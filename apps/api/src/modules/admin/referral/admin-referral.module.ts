import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminReferralController } from './admin-referral.controller';
import { AdminReferralService } from './admin-referral.service';

@Module({
  imports: [PrismaModule, AdminAuthModule],
  controllers: [AdminReferralController],
  providers: [AdminReferralService],
})
export class AdminReferralModule {}
