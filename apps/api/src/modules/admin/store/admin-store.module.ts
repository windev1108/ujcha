import { Module } from '@nestjs/common';
import { AdminStoreController } from './admin-store.controller';
import { AdminStoreService } from './admin-store.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdminStoreController],
  providers: [AdminStoreService],
  exports: [AdminStoreService],
})
export class AdminStoreModule {}
