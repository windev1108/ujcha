import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { AdminOrderModule } from '../order/admin-order.module'
import { EventsModule } from '../../events/events.module'
import { PlatformIngestController } from './platform-ingest.controller'

@Module({
  imports: [PrismaModule, AdminOrderModule, EventsModule],
  controllers: [PlatformIngestController],
})
export class ExternalOrderModule {}
