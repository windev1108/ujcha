import { Module } from '@nestjs/common';
import { UserModule } from '../../user/user.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminUserController } from './admin-user.controller';

/** Route admin JWT: tìm khách (`User`) & địa chỉ — logic nằm ở `UserService`. */
@Module({
  imports: [UserModule, AdminAuthModule],
  controllers: [AdminUserController],
})
export class AdminUserModule {}
