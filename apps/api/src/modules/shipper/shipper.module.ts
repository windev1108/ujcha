import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { ShipperAuthModule } from '../shipper-auth/shipper-auth.module';
import { ShipperController } from './shipper.controller';
import { ShipperService } from './shipper.service';

@Module({
  imports: [PrismaModule, EventsModule, ShipperAuthModule],
  controllers: [ShipperController],
  providers: [ShipperService],
})
export class ShipperModule {}
