// src/modules/store/store.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StoreStatusService } from './store-status.service';
import { StoreController } from './store.controller';

@Module({
  imports: [PrismaModule],
  controllers: [StoreController],
  providers: [StoreStatusService],
  exports: [StoreStatusService],
})
export class StoreModule {}
