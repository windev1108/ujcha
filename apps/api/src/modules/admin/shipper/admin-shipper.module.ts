import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminShipperController } from './admin-shipper.controller';
import { AdminShipperService } from './admin-shipper.service';

@Module({
  imports: [PrismaModule, AdminAuthModule],
  controllers: [AdminShipperController],
  providers: [AdminShipperService],
})
export class AdminShipperModule {}
