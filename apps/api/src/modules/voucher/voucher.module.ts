import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UserVoucherService } from './user-voucher.service';
import { VoucherController } from './voucher.controller';

@Module({
  imports: [PrismaModule],
  controllers: [VoucherController],
  providers: [UserVoucherService],
  exports: [UserVoucherService],
})
export class VoucherModule {}
