import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PosReleaseController } from './pos-release.controller';
import { PosReleaseService } from './pos-release.service';

@Module({
  imports: [PrismaModule],
  controllers: [PosReleaseController],
  providers: [PosReleaseService],
})
export class PosReleaseModule {}
