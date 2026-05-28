import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminPaymentService } from './admin-payment.service';
import { AdminPaymentListQueryDto } from './dto/admin-payment-list-query.dto';
import { AdminWebhookLogListQueryDto } from './dto/admin-webhook-log-list-query.dto';

@ApiTags('admin-payments')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin, AdminRole.staff)
@Controller('admin/payments')
export class AdminPaymentController {
  constructor(private readonly adminPaymentService: AdminPaymentService) { }

  @Get('webhook-logs/:logId')
  @ApiOperation({ summary: 'Chi tiết webhook log' })
  getWebhookLog(@Param('logId', ParseUUIDPipe) logId: string) {
    return this.adminPaymentService.getWebhookLogById(logId);
  }

  @Get('webhook-logs')
  @ApiOperation({ summary: 'Danh sách webhook logs (đối soát)' })
  listWebhookLogs(@Query() query: AdminWebhookLogListQueryDto) {
    return this.adminPaymentService.listWebhookLogs(query);
  }

  @Get()
  @ApiOperation({
    summary: 'Danh sách giao dịch (transactionId, amount, content, orderId)',
  })
  listPayments(@Query() query: AdminPaymentListQueryDto) {
    return this.adminPaymentService.listPayments(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết giao dịch' })
  getPayment(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminPaymentService.getPaymentById(id);
  }
}
