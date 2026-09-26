import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { OptionalCurrentUserId } from '../auth/decorators/optional-current-user-id.decorator';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import { AdminJwtGuard } from '../admin/auth/admin-jwt.guard';
import { Roles } from '../admin/auth/decorators/roles.decorator';
import { RolesGuard } from '../admin/auth/guards/roles.guard';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly gateway: ChatGateway,
  ) {}

  // ── Order-scoped chat (guest qua paymentCode, hoặc chủ đơn đã đăng nhập) ──

  @UseGuards(OptionalJwtAuthGuard)
  @Get('orders/:paymentCode/messages')
  async getOrderMessages(
    @OptionalCurrentUserId() userId: string | null,
    @Param('paymentCode') paymentCode: string,
    @Query('limit') limit?: string,
    @Query('beforeId') beforeId?: string,
  ) {
    const viewer = await this.chatService.resolveOrderViewer(
      paymentCode,
      userId,
    );
    const orderId =
      viewer.kind === 'order-owner' || viewer.kind === 'order-guest'
        ? viewer.orderId
        : '';
    const { messages, hasMore } = await this.chatService.listMessages(
      'order',
      orderId,
      {
        limit: limit ? parseInt(limit, 10) : undefined,
        beforeId,
      },
    );
    return { kind: 'order' as const, id: orderId, messages, hasMore };
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('orders/:paymentCode/messages')
  @HttpCode(201)
  async sendOrderMessage(
    @OptionalCurrentUserId() userId: string | null,
    @Param('paymentCode') paymentCode: string,
    @Body() dto: SendMessageDto,
  ) {
    const viewer = await this.chatService.resolveOrderViewer(
      paymentCode,
      userId,
    );
    const { kind, id, message } = await this.chatService.sendAsViewer(
      viewer,
      dto.content,
      dto.type,
    );
    this.gateway.broadcastToRoom(kind, id, message);
    this.gateway.notifyStaffNewMessage(kind, id);
    return message;
  }

  // ── Group-order-scoped chat (sessionToken bắt buộc — giống các endpoint group khác) ──

  @Get('group-orders/:token/messages')
  async getGroupMessages(
    @Param('token') token: string,
    @Query('sessionToken') sessionToken: string,
    @Query('limit') limit?: string,
    @Query('beforeId') beforeId?: string,
  ) {
    const viewer = await this.chatService.resolveGroupViewer(
      token,
      sessionToken,
    );
    const groupOrderId =
      viewer.kind === 'group-participant' ? viewer.groupOrderId : '';
    const { messages, hasMore } = await this.chatService.listMessages(
      'group',
      groupOrderId,
      {
        limit: limit ? parseInt(limit, 10) : undefined,
        beforeId,
      },
    );
    return { kind: 'group' as const, id: groupOrderId, messages, hasMore };
  }

  @Post('group-orders/:token/messages')
  @HttpCode(201)
  async sendGroupMessage(
    @Param('token') token: string,
    @Body() dto: SendMessageDto,
  ) {
    const viewer = await this.chatService.resolveGroupViewer(
      token,
      dto.sessionToken,
    );
    const { kind, id, message } = await this.chatService.sendAsViewer(
      viewer,
      dto.content,
      dto.type,
    );
    this.gateway.broadcastToRoom(kind, id, message);
    return message;
  }

  // ── Staff (POS) ──────────────────────────────────────────────────────

  @UseGuards(AdminJwtGuard, RolesGuard)
  @Roles(AdminRole.super_admin, AdminRole.staff)
  @Get('admin/rooms/:kind/:id/messages')
  getRoomMessages(
    @Param('kind') kind: 'order' | 'group',
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('beforeId') beforeId?: string,
  ) {
    return this.chatService.listMessages(kind, id, {
      limit: limit ? parseInt(limit, 10) : undefined,
      beforeId,
    });
  }

  @UseGuards(AdminJwtGuard, RolesGuard)
  @Roles(AdminRole.super_admin, AdminRole.staff)
  @Post('admin/rooms/:kind/:id/messages')
  @HttpCode(201)
  async sendStaffMessage(
    @Param('kind') kind: 'order' | 'group',
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    const message = await this.chatService.sendAsStaff(
      kind,
      id,
      dto.content,
      dto.type,
    );
    this.gateway.broadcastToRoom(kind, id, message);
    return message;
  }
}
