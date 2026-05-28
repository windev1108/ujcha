import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminPostController } from './admin-post.controller';
import { AdminPostService } from './admin-post.service';

@Module({
  imports: [PrismaModule, AdminAuthModule],
  controllers: [AdminPostController],
  providers: [AdminPostService],
  exports: [AdminPostService],
})
export class AdminPostModule {}
