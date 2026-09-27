import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminStoreService } from '../admin/store/admin-store.service';
import { AdminChatWidgetService } from '../admin/chat-widget/admin-chat-widget.service';

@ApiTags('public-store')
@Controller('store')
export class PublicStoreController {
  constructor(
    private readonly storeService: AdminStoreService,
    private readonly chatWidgetService: AdminChatWidgetService,
  ) { }

  @Get('platforms')
  @ApiOperation({ summary: 'Danh sách nền tảng giao đồ ăn (công khai)' })
  listActivePlatforms() {
    return this.storeService.listActivePlatforms();
  }

  @Get('stickers')
  @ApiOperation({ summary: 'Danh sách stickers chat widget (công khai)' })
  listForUser() {
    return this.chatWidgetService.listActiveForUser();
  }
}
