import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { NotificationService } from './notification.service';

@ApiTags('notifications')
@Controller('notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy 20 thông báo gần nhất' })
  getMyNotifications(@CurrentUserId() userId: string) {
    return this.notificationService.getForUser(userId);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Số thông báo chưa đọc' })
  getUnreadCount(@CurrentUserId() userId: string) {
    return this.notificationService.countUnread(userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Đánh dấu đã đọc một thông báo' })
  markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string,
  ) {
    return this.notificationService.markRead(id, userId);
  }

  @Post('read-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đánh dấu tất cả đã đọc' })
  markAllRead(@CurrentUserId() userId: string) {
    return this.notificationService.markAllRead(userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa một thông báo' })
  deleteOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string,
  ) {
    return this.notificationService.deleteOne(id, userId);
  }

  @Delete()
  @HttpCode(200)
  @ApiOperation({ summary: 'Xóa tất cả thông báo' })
  deleteAll(@CurrentUserId() userId: string) {
    return this.notificationService.deleteAll(userId);
  }
}
