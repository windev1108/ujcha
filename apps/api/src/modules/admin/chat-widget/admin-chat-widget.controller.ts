// admin/chat-widget/chat-widget.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminChatWidgetService } from './admin-chat-widget.service';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CreateStickerAlbumDto,
  CreateStickerByUrlDto,
  ReorderAlbumsDto,
  ReorderStickersDto,
  UpdateStickerAlbumDto,
  UpdateStickerDto,
} from './dto/chat-widget.dto';

interface MulterFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@ApiTags('admin-chat-widget')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin, AdminRole.staff)
@Controller('admin/chat-widget')
export class AdminChatWidgetController {
  constructor(private readonly chatWidgetService: AdminChatWidgetService) { }

  @Get('stickers')
  listForAdmin() {
    return this.chatWidgetService.listAllForAdmin();
  }

  @Post('stickers')
  createByUrl(@Body() dto: CreateStickerByUrlDto) {
    return this.chatWidgetService.createByUrl(dto.url, dto.alt, dto.albumId);
  }

  @Post('stickers/upload')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  createByFile(
    @UploadedFile() file: MulterFile,
    @Body('alt') alt?: string,
    @Body('albumId') albumId?: string,
  ) {
    return this.chatWidgetService.createByFile(file.buffer, file.originalname, alt, albumId);
  }

  @Patch('stickers/:id')
  update(@Param('id') id: string, @Body() dto: UpdateStickerDto) {
    return this.chatWidgetService.update(id, dto);
  }

  @Delete('stickers/:id')
  remove(@Param('id') id: string) {
    return this.chatWidgetService.delete(id);
  }

  @Post('stickers/reorder')
  reorder(@Body() dto: ReorderStickersDto) {
    return this.chatWidgetService.reorder(dto.ids);
  }

  @Get('stickers/albums')
  listAlbums() {
    return this.chatWidgetService.listAlbumsForAdmin();
  }

  @Post('stickers/albums')
  createAlbum(@Body() dto: CreateStickerAlbumDto) {
    return this.chatWidgetService.createAlbum(dto.name);
  }

  @Patch('stickers/albums/:id')
  updateAlbum(@Param('id') id: string, @Body() dto: UpdateStickerAlbumDto) {
    return this.chatWidgetService.updateAlbum(id, dto);
  }

  @Delete('sticker/albums/:id')
  deleteAlbum(@Param('id') id: string) {
    return this.chatWidgetService.deleteAlbum(id);
  }

  @Post('sticker/albums/reorder')
  reorderAlbums(@Body() dto: ReorderAlbumsDto) {
    return this.chatWidgetService.reorderAlbums(dto.ids);
  }
}
