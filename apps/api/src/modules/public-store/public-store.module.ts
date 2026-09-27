import { Module } from '@nestjs/common';
import { AdminStoreModule } from '../admin/store/admin-store.module';
import { PublicStoreController } from './public-store.controller';
import { AdminChatWidgetService } from '../admin/chat-widget/admin-chat-widget.service';
import { UploadService } from '../upload/upload.service';

@Module({
  imports: [AdminStoreModule],
  providers: [AdminChatWidgetService, UploadService],
  controllers: [PublicStoreController],
})
export class PublicStoreModule { }
