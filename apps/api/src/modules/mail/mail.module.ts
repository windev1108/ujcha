import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAuthModule } from '../admin/auth/admin-auth.module';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';

@Module({
  imports: [PrismaModule, AdminAuthModule],
  controllers: [MailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
