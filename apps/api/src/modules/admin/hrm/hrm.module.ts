import { Module } from '@nestjs/common';
import { HrmController } from './hrm.controller';
import { HrmService } from './hrm.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { SmsModule } from '../../sms/sms.module';

@Module({
  imports: [PrismaModule, SmsModule],
  controllers: [HrmController],
  providers: [HrmService],
})
export class HrmModule {}
