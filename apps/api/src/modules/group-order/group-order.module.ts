import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { GroupOrderController } from './group-order.controller';
import { GroupOrderGateway } from './group-order.gateway';
import { GroupOrderService } from './group-order.service';
import { MailService } from '../mail/mail.service';

@Module({
  imports: [PrismaModule, AuthModule, EventsModule, NotificationModule],
  controllers: [GroupOrderController],
  providers: [GroupOrderService, GroupOrderGateway, MailService],
  exports: [GroupOrderService, GroupOrderGateway, MailService],
})
export class GroupOrderModule { }
