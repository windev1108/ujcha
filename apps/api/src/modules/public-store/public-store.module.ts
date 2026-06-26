import { Module } from '@nestjs/common';
import { AdminStoreModule } from '../admin/store/admin-store.module';
import { PublicStoreController } from './public-store.controller';

@Module({
  imports: [AdminStoreModule],
  controllers: [PublicStoreController],
})
export class PublicStoreModule {}
