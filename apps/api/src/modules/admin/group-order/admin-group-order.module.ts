import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { GroupOrderModule } from '../../group-order/group-order.module';
import { AdminGroupOrderController } from './admin-group-order.controller';

@Module({
  imports: [AdminAuthModule, GroupOrderModule],
  controllers: [AdminGroupOrderController],
})
export class AdminGroupOrderModule {}
