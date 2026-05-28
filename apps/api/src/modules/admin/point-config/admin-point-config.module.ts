import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminPointConfigController } from './admin-point-config.controller';
import { AdminPointConfigService } from './admin-point-config.service';

@Module({
  imports: [PrismaModule, AdminAuthModule],
  controllers: [AdminPointConfigController],
  providers: [AdminPointConfigService],
})
export class AdminPointConfigModule {}
