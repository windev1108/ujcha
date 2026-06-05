import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { NotificationModule } from '../../notification/notification.module';
import { AdminPostController } from './admin-post.controller';
import { AdminPostService } from './admin-post.service';

@Module({
  imports: [PrismaModule, AdminAuthModule, NotificationModule],
  controllers: [AdminPostController],
  providers: [AdminPostService],
  exports: [AdminPostService],
})
export class AdminPostModule {}
