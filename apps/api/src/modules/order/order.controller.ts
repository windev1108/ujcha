import {
  Body,
  Controller,
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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OrdersGateway } from '../events/orders.gateway';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { VoucherPreviewDto } from './dto/voucher-preview.dto';
import { OrderService } from './order.service';

@ApiTags('orders')
@Controller('orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly ordersGateway: OrdersGateway,
  ) {}

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Danh sách đơn của user hiện tại (phân trang)' })
  getMyOrders(
    @CurrentUserId() userId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.orderService.getMyOrders(
      userId,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 10,
    );
  }

  @Post('voucher-preview')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xác thực mã voucher và tính tiền giảm (không lưu DB)' })
  previewVoucher(
    @Body() dto: VoucherPreviewDto,
  ) {
    return this.orderService.previewVoucher(dto.code, dto.orderAmount);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Tạo đơn (delivery / table / pickup)' })
  @ApiResponse({ status: 201 })
  async createOrder(
    @CurrentUserId() userId: string,
    @Body() dto: CreateOrderDto,
  ) {
    const order = await this.orderService.createOrder(userId, dto);
    this.ordersGateway.emitOrderCreated({ orderId: order.id, type: order.type });
    return order;
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('by-code/:paymentCode')
  @ApiOperation({ summary: 'Chi tiết đơn (tra theo paymentCode)' })
  getOrderDetail(
    @CurrentUserId() userId: string,
    @Param('paymentCode') paymentCode: string,
  ) {
    return this.orderService.getOrderDetail(userId, paymentCode);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get(':orderId/payment-status')
  @ApiOperation({ summary: 'Lấy trạng thái thanh toán của đơn' })
  getPaymentStatus(
    @CurrentUserId() userId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.orderService.getPaymentStatus(userId, orderId);
  }

  @Patch(':orderId/status')
  @ApiOperation({
    summary: 'Cập nhật trạng thái đơn / thanh toán (delivery: gán shipper mock khi paid)',
  })
  updateStatus(
    @CurrentUserId() userId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateStatus(userId, orderId, dto);
  }
}
