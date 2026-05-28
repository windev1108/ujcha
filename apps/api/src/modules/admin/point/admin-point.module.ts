import { Module } from '@nestjs/common';
import { PointModule } from '../../point/point.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminPointController } from './admin-point.controller';
import { AdminPointService } from './admin-point.service';

@Module({
  imports: [PrismaModule, AdminAuthModule, PointModule],
  controllers: [AdminPointController],
  providers: [AdminPointService],
})
export class AdminPointModule {}
