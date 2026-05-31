import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis/redis.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminProductController } from './admin-product.controller';
import { AdminProductService } from './admin-product.service';

@Module({
  imports: [PrismaModule, RedisModule, AdminAuthModule],
  controllers: [AdminProductController],
  providers: [AdminProductService],
})
export class AdminProductModule {}
