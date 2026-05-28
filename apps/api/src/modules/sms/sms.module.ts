import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { SmsService } from './sms.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
