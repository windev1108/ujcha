import { Module } from '@nestjs/common';
import { FraudModule } from '../fraud/fraud.module';
import { UserModule } from '../user/user.module';
import { VoucherModule } from '../voucher/voucher.module';
import { GoogleAuthService } from './google-auth.service';

@Module({
  imports: [UserModule, FraudModule, VoucherModule],
  providers: [GoogleAuthService],
  exports: [GoogleAuthService],
})
export class GoogleAuthModule {}
