import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Logger,
  Post,
  Query,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiExcludeController } from '@nestjs/swagger'
import { IsInt, IsOptional, IsString, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { PrismaService } from '../../prisma/prisma.service'
import { AdminOrderService } from '../order/admin-order.service'
import { OrdersGateway } from '../../events/orders.gateway'
import { parsePlatformMessage } from './platform-parser'
import type { PlatformItem } from './platform-parser'
import { OrderType, PaymentStatus, PaymentType } from '@prisma/client'

class GrabRevenueSyncDto {
  @IsString()
  platform!: string

  @IsString()
  date!: string

  @IsInt() @Min(0) @Type(() => Number)
  totalEarnings!: number

  @IsInt() @Min(0) @Type(() => Number)
  revenue!: number

  @IsInt() @Min(0) @Type(() => Number)
  completedOrders!: number

  @IsInt() @Min(0) @Type(() => Number)
  cancelledOrders!: number

  @IsOptional()
  rawJson?: unknown
}

class PlatformIngestDto {
  @IsString()
  raw!: string

  @IsOptional()
  @IsString()
  source?: string

  /** ShopeeFood order code (07056-XXXXX) — from MQTT notification */
  @IsOptional()
  @IsString()
  orderCode?: string

  /** ShopeeFood restaurant ID — from MQTT topic /restaurant/{id} */
  @IsOptional()
  @IsString()
  restaurantId?: string
}

interface ProductRow {
  id: string
  name: string
  price: unknown
  isAvailable: boolean
  isSoldOut: boolean
}

@ApiExcludeController()
@Controller('admin/external')
export class PlatformIngestController {
  private readonly logger = new Logger(PlatformIngestController.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminOrderService: AdminOrderService,
    private readonly ordersGateway: OrdersGateway,
    private readonly config: ConfigService,
  ) { }

  // ─── Guard: API key đơn giản để bảo vệ endpoint nội bộ ───────────────────
  private assertKey(key: string | undefined) {
    const expected = this.config.get<string>('INTERNAL_ANALY_KEY')
    // Nếu chưa cấu hình env thì chỉ warn, không block (dev-friendly)
    if (!expected) {
      this.logger.warn('INTERNAL_ANALY_KEY chưa được cấu hình — endpoint không bảo mật')
      return
    }
    if (key !== expected) throw new ForbiddenException('Invalid internal key')
  }

  // ─── Map tên sản phẩm → productId từ DB ──────────────────────────────────
  private async resolveItems(items: PlatformItem[]): Promise<{
    resolved: { productId: string; quantity: number; price: number; note?: string }[]
    mismatches: { name: string; searched: string }[]
    availableProducts: { id: string; name: string; price: unknown }[]
  }> {
    const products = (await this.prisma.product.findMany({
      where: { isAvailable: true, isSoldOut: false },
      select: { id: true, name: true, price: true, isAvailable: true, isSoldOut: true },
    })) as unknown as ProductRow[]

    const resolved: { productId: string; quantity: number; price: number; note?: string }[] = []
    const mismatches: { name: string; searched: string }[] = []

    for (const item of items) {
      const search = item.name.trim().toLowerCase()

      // 1. Khớp chính xác (case-insensitive)
      let match = products.find((p) => p.name.toLowerCase() === search)

      // 2. Khớp một phần — tên DB bắt đầu bằng search hoặc ngược lại
      if (!match) {
        match = products.find(
          (p) =>
            p.name.toLowerCase().includes(search) ||
            search.includes(p.name.toLowerCase()),
        )
      }

      if (match) {
        const price = item.unitPrice > 0 ? item.unitPrice : Number(match.price)
        // Gộp options vào note tạm (cho đến khi có thể map variant)
        const optNote = item.options?.length ? item.options.join(', ') : undefined
        const fullNote = [item.note, optNote].filter(Boolean).join(' | ') || undefined

        resolved.push({
          productId: match.id,
          quantity: item.quantity,
          price,
          note: fullNote,
        })
      } else {
        mismatches.push({ name: item.name, searched: search })
      }
    }

    const availableProducts = products.map((p) => ({ id: p.id, name: p.name, price: p.price }))
    return { resolved, mismatches, availableProducts }
  }

  @Post('ingest')
  @HttpCode(200)
  async ingest(
    @Body() dto: PlatformIngestDto,
    @Headers('x-internal-key') key: string | undefined,
  ) {
    this.assertKey(key)

    // Khi POS gửi kèm orderCode + restaurantId (MQTT notification format),
    // log ra để operator biết cần cấu hình VITE_SPF_RESTAURANT_IDS
    if (dto.orderCode) {
      this.logger.log(
        `[Ingest] Notification: source=${dto.source ?? '-'} restaurantId=${dto.restaurantId ?? '-'} orderCode=${dto.orderCode}`,
      )
      // Trả về pending — cần fetch full order từ ShopeeFood/GrabFood API
      // (chưa có API credentials → log để debug)
      return {
        status: 'notification_received',
        orderCode: dto.orderCode,
        restaurantId: dto.restaurantId,
        source: dto.source,
        hint: 'Nhận được MQTT notification. Cần cấu hình ShopeeFood API credentials để fetch full order tự động.',
      }
    }

    const result = parsePlatformMessage(dto.raw)
    this.logger.log(`[Ingest] raw=${dto.raw.slice(0, 200)}`)

    // Nếu parse thất bại hoàn toàn → trả debug info, không tạo đơn
    if (!result.order || result.parseError) {
      return {
        status: 'parse_error',
        parseError: result.parseError,
        raw: dto.raw,
        json: result.json,
      }
    }

    const order = result.order

    // Nếu không có items → không tạo đơn
    if (!order.items.length) {
      return {
        status: 'no_items',
        order,
        unmapped: result.unmapped,
        raw: dto.raw,
      }
    }

    // Resolve sản phẩm theo tên
    const { resolved, mismatches, availableProducts } = await this.resolveItems(order.items)

    if (mismatches.length > 0) {
      return {
        status: 'product_mismatch',
        mismatches,
        availableProducts,
        parsedOrder: order,
        hint: 'Tên sản phẩm không khớp với menu. Kiểm tra và map thủ công.',
        raw: dto.raw,
      }
    }

    // Tạo đơn delivery (Grab/Shopee luôn là delivery)
    const platform = order.platform ? `[${order.platform.toUpperCase()}]` : '[EXTERNAL]'
    const customerName = order.customerName
      ? `${platform} ${order.customerName}`
      : platform

    try {
      const created = await this.adminOrderService.createAsAdmin({
        type: OrderType.delivery,
        paymentType: PaymentType.bank_transfer,
        paymentStatus: PaymentStatus.paid, // Grab/Shopee đã thu tiền
        guestDeliveryName: customerName.slice(0, 120),
        guestDeliveryPhone: order.customerPhone?.slice(0, 30),
        guestDeliveryAddress: (order.deliveryAddress ?? 'Địa chỉ giao hàng chưa có').slice(0, 2000),
        items: resolved.map((r) => ({
          productId: r.productId,
          quantity: r.quantity,
          price: r.price,
          note: r.note,
          extras: [],
          options: {},
        })),
        discountAmount: order.discount ?? 0,
      }, { skipOptionValidation: true })

      this.logger.log(`[Ingest] Tạo đơn thành công orderId=${created.id} externalId=${order.externalOrderId ?? '-'} platform=${order.platform ?? '-'}`)
      this.ordersGateway.emitExternalOrderCreated({ orderId: created.id, platform: order.platform ?? 'external' })

      return {
        status: 'created',
        orderId: created.id,
        externalOrderId: order.externalOrderId,
        platform: order.platform,
        parsedOrder: order,
        unmapped: result.unmapped,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.logger.error(`[Ingest] Tạo đơn thất bại: ${message}`, err instanceof Error ? err.stack : undefined)
      return {
        status: 'create_error',
        error: message,
        parsedOrder: order,
        resolved,
        raw: dto.raw,
      }
    }
  }

  // ─── Grab revenue summary ─────────────────────────────────────────────────

  @Post('grab-revenue')
  @HttpCode(200)
  async upsertGrabRevenue(
    @Body() dto: GrabRevenueSyncDto,
    @Headers('x-internal-key') key: string | undefined,
  ) {
    this.assertKey(key)
    const record = await this.prisma.platformRevenueSummary.upsert({
      where: { platform_date: { platform: dto.platform, date: dto.date } },
      create: {
        platform: dto.platform,
        date: dto.date,
        totalEarnings: dto.totalEarnings,
        revenue: dto.revenue,
        completedOrders: dto.completedOrders,
        cancelledOrders: dto.cancelledOrders,
        rawJson: dto.rawJson ?? undefined,
        syncedAt: new Date(),
      },
      update: {
        totalEarnings: dto.totalEarnings,
        revenue: dto.revenue,
        completedOrders: dto.completedOrders,
        cancelledOrders: dto.cancelledOrders,
        rawJson: dto.rawJson ?? undefined,
        syncedAt: new Date(),
      },
    })
    this.logger.log(`[Revenue] Upserted ${dto.platform} ${dto.date}: ${dto.completedOrders} orders, revenue=${dto.revenue}`)
    return { ok: true, id: record.id }
  }

  @Get('grab-revenue')
  async getRevenueSummaries(
    @Headers('x-internal-key') key: string | undefined,
    @Query('platform') platform?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    this.assertKey(key)
    const rows = await this.prisma.platformRevenueSummary.findMany({
      where: {
        ...(platform ? { platform } : {}),
        ...(from || to ? {
          date: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        } : {}),
      },
      orderBy: [{ platform: 'asc' }, { date: 'desc' }],
    })
    return { ok: true, rows }
  }
}
