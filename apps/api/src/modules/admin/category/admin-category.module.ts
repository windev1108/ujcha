import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminCategoryController } from './admin-category.controller';
import { AdminCategoryService } from './admin-category.service';

@Module({
  imports: [PrismaModule, AdminAuthModule],
  controllers: [AdminCategoryController],
  providers: [AdminCategoryService],
})
export class AdminCategoryModule {}
