import { Module } from '@nestjs/common';
import { SmsModule } from '../../sms/sms.module';
import { AdminSmsController } from './admin-sms.controller';
import { AdminSmsService } from './admin-sms.service';

@Module({
  imports: [SmsModule],
  controllers: [AdminSmsController],
  providers: [AdminSmsService],
})
export class AdminSmsModule {}
