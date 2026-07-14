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
import { OptionalCurrentUserId } from '../auth/decorators/optional-current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import { OrdersGateway } from '../events/orders.gateway';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { VoucherPreviewDto } from './dto/voucher-preview.dto';
import { OrderService } from './order.service';
import { MailService } from '../mail/mail.service';

@ApiTags('orders')
@Controller('orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly ordersGateway: OrdersGateway,
    private readonly mailService: MailService,
  ) { }

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

  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Tạo đơn (delivery / table / pickup) — hỗ trợ guest không đăng nhập' })
  @ApiResponse({ status: 201 })
  async createOrder(
    @OptionalCurrentUserId() userId: string | null,
    @Body() dto: CreateOrderDto,
  ) {
    const order = await this.orderService.createOrder(userId, dto);
    this.ordersGateway.emitOrderCreated({ orderId: order.id, type: order.type });
    this.mailService
      .sendNewOrderNotification({
        orderId: order.id,
        paymentCode: order.paymentCode,
        type: order.type,
        customerName: order.user?.name ?? order.guestDeliveryName,
        customerPhone: order.user?.phone ?? order.guestDeliveryPhone,
        address: order?.address?.fullAddress ?? order.guestDeliveryAddress,
        coordinate:
          order?.address?.lng && order?.address?.lat
            ? { lng: order?.address?.lng, lat: order?.address?.lat }
            : null,
        totalAmount: order.finalAmount,
        items: order.items.map((x) => ({
          name: x.product?.name,
          quantity: x.quantity,
          price: x.price,
        })),
      })
      .catch(() => { });
    return order;
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('by-code/:paymentCode')
  @ApiOperation({ summary: 'Chi tiết đơn theo paymentCode — public vì mã không đoán được' })
  getOrderDetail(
    @OptionalCurrentUserId() userId: string | null,
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
