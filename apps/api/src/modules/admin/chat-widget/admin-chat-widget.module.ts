// sticker/sticker.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { UploadModule } from '../../upload/upload.module';
import { AdminChatWidgetController } from './admin-chat-widget.controller';
import { AdminChatWidgetService } from './admin-chat-widget.service';

@Module({
  imports: [PrismaModule, UploadModule],
  controllers: [AdminChatWidgetController],
  providers: [AdminChatWidgetService],
})
export class AdminChatWidgetModule {}
