import { Module } from '@nestjs/common';
import { FraudModule } from '../fraud/fraud.module';
import { OtpService } from './otp.service';

@Module({
  imports: [FraudModule],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
