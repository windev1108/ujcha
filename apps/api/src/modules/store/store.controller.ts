// src/modules/store/store.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { StoreStatusService } from './store-status.service';

@ApiTags('store')
@Controller('store')
export class StoreController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeStatus: StoreStatusService,
  ) {}

  @Get('location')
  @ApiOperation({ summary: 'Cấu hình cửa hàng công khai (vị trí, SĐT)' })
  async getPublicStoreLocation() {
    const loc = await this.prisma.storeLocation.findUnique({
      where: { id: 'default' },
    });
    return loc ?? { lat: 0, lng: 0, radiusMeters: 0, address: '', phone: null };
  }

  @Get('status')
  @ApiOperation({
    summary:
      'Trạng thái vận hành hiện tại của cửa hàng (giờ mở cửa + opening/closed/busy)',
  })
  async getPublicStoreStatus() {
    return this.storeStatus.getStatus();
  }
}
