import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminVoucherController } from './admin-voucher.controller';
import { AdminVoucherService } from './admin-voucher.service';

@Module({
  imports: [PrismaModule, AdminAuthModule],
  controllers: [AdminVoucherController],
  providers: [AdminVoucherService],
  exports: [AdminVoucherService],
})
export class AdminVoucherModule {}
