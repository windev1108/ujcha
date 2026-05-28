import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminVariantGroupController } from './admin-variant-group.controller';
import { AdminVariantGroupService } from './admin-variant-group.service';

@Module({
  imports: [PrismaModule, AdminAuthModule],
  controllers: [AdminVariantGroupController],
  providers: [AdminVariantGroupService],
  exports: [AdminVariantGroupService],
})
export class AdminVariantGroupModule {}
