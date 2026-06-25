import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { UpdateOrderStatusDto } from '../../order/dto/update-order-status.dto';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminOrderService } from './admin-order.service';
import { AdminCreateOrderDto } from './dto/admin-create-order.dto';
import { AdminOrderListQueryDto } from './dto/admin-order-list-query.dto';
import { AdminOrderMetricsQueryDto } from './dto/admin-order-metrics-query.dto';
import { AssignShipperDto } from './dto/assign-shipper.dto';
import { BulkUpdateOrderStatusDto } from './dto/bulk-update-order-status.dto';
import { ReturningCheckDto } from './dto/returning-check.dto';

@ApiTags('admin-orders')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin, AdminRole.staff)
@Controller('admin/orders')
export class AdminOrderController {
  constructor(private readonly adminOrderService: AdminOrderService) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Thống kê KPI đơn (doanh thu đã thanh toán, đơn đang xử lý, TB giá trị, tỉ lệ hoàn thành)',
  })
  stats(@Query() query: AdminOrderMetricsQueryDto) {
    return this.adminOrderService.getStats(query);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Tạo đơn thay khách (POS)' })
  create(@Body() dto: AdminCreateOrderDto) {
    return this.adminOrderService.createAsAdmin(dto);
  }

  @Get()
  @ApiOperation({
    summary:
      'Danh sách đơn (phân trang, lọc type/status/ngày/tìm kiếm); typeDisplay: delivery/table/pickup',
  })
  list(@Query() query: AdminOrderListQueryDto) {
    return this.adminOrderService.findAll(query);
  }

  @Post('returning-check')
  @HttpCode(200)
  @ApiOperation({ summary: 'Kiểm tra khách quen — trả về phones/userIds đã có ít nhất 1 đơn completed' })
  returningCheck(@Body() dto: ReturningCheckDto) {
    return this.adminOrderService.checkReturning(dto.phones ?? [], dto.userIds ?? []);
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Chi tiết đơn' })
  getById(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.adminOrderService.findById(orderId);
  }

  @Delete(':orderId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Xóa đơn (chỉ khi chưa có bản ghi thanh toán)',
  })
  async remove(@Param('orderId', ParseUUIDPipe) orderId: string) {
    await this.adminOrderService.remove(orderId);
  }

  @Patch(':orderId/status')
  @ApiOperation({ summary: 'Cập nhật trạng thái đơn / thanh toán' })
  updateStatus(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.adminOrderService.updateStatus(orderId, dto);
  }

  @Patch('bulk-status')
  @ApiOperation({ summary: 'Cập nhật trạng thái nhiều đơn cùng lúc' })
  bulkUpdateStatus(@Body() dto: BulkUpdateOrderStatusDto) {
    return this.adminOrderService.bulkUpdateStatus(dto);
  }

  @Patch(':orderId/assign-shipper')
  @ApiOperation({ summary: 'Gán shipper cho đơn delivery' })
  assignShipper(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: AssignShipperDto,
  ) {
    return this.adminOrderService.assignShipper(orderId, dto);
  }

  @Patch(':orderId/group-participants/:participantId/payment')
  @ApiOperation({ summary: 'Admin xác nhận thủ công thanh toán của 1 thành viên nhóm' })
  markParticipantPaid(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
  ) {
    return this.adminOrderService.markParticipantPaid(orderId, participantId);
  }
}
