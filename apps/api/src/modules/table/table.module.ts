import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { OrderModule } from '../order/order.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TableController } from './table.controller';

@Module({
  imports: [PrismaModule, OrderModule, EventsModule],
  controllers: [TableController],
})
export class TableModule {}
