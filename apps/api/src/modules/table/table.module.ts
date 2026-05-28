import { Module } from '@nestjs/common';
import { OrderModule } from '../order/order.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TableController } from './table.controller';

@Module({
  imports: [PrismaModule, OrderModule],
  controllers: [TableController],
})
export class TableModule {}
