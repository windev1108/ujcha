import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminStoreService } from '../admin/store/admin-store.service';

@ApiTags('public-store')
@Controller('store')
export class PublicStoreController {
  constructor(private readonly storeService: AdminStoreService) {}

  @Get('platforms')
  @ApiOperation({ summary: 'Danh sách nền tảng giao đồ ăn (công khai)' })
  listActivePlatforms() {
    return this.storeService.listActivePlatforms();
  }
}
