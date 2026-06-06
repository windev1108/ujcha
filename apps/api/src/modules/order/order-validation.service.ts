import { BadRequestException, Injectable } from '@nestjs/common';
import { OrderType } from '@prisma/client';
import { MAX_PICKUP_DAYS_AHEAD, MIN_PICKUP_LEAD_MINUTES } from './order.constants';
import type { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrderValidationService {
  assertCreateOrderTypeRules(dto: CreateOrderDto): void {
    const { type, addressId, tableId, pickupTime } = dto;
    const guestAddr = dto.guestDeliveryAddress?.trim();

    // Address is delivery-only; name/phone are allowed for delivery and pickup
    if (type !== OrderType.delivery && Boolean(guestAddr)) {
      throw new BadRequestException({
        message:
          'Địa chỉ giao khách lẻ chỉ dùng cho đơn giao hàng (delivery).',
        code: 'ORDER_GUEST_DELIVERY_FORBIDDEN',
      });
    }

    if (type === OrderType.delivery) {
      const hasSaved = Boolean(addressId?.trim());
      const hasInline = Boolean(dto.inlineAddress);
      const hasGuest = Boolean(guestAddr);
      if (!hasSaved && !hasInline && !hasGuest) {
        throw new BadRequestException({
          message:
            'Giao hàng cần địa chỉ: addressId (đã lưu) hoặc inlineAddress (bản đồ) hoặc guestDeliveryAddress (khách không tài khoản).',
          code: 'ORDER_DELIVERY_ADDRESS_REQUIRED',
        });
      }
      if ((hasSaved || hasInline) && hasGuest) {
        throw new BadRequestException({
          message:
            'Chỉ dùng một: addressId/inlineAddress hoặc địa chỉ giao khách lẻ (guestDeliveryAddress).',
          code: 'ORDER_DELIVERY_ADDRESS_CONFLICT',
        });
      }
      if (tableId != null) {
        throw new BadRequestException({
          message: 'Đơn delivery không được kèm tableId.',
          code: 'ORDER_DELIVERY_FORBIDS_TABLE',
        });
      }
      if (pickupTime != null) {
        throw new BadRequestException({
          message: 'Đơn delivery không được kèm pickupTime.',
          code: 'ORDER_DELIVERY_FORBIDS_PICKUP_TIME',
        });
      }
      return;
    }

    if (type === OrderType.table) {
      if (!tableId) {
        throw new BadRequestException({
          message: 'Đơn tại bàn bắt buộc có tableId.',
          code: 'ORDER_TABLE_ID_REQUIRED',
        });
      }
      if (addressId != null) {
        throw new BadRequestException({
          message: 'Đơn tại bàn không dùng addressId.',
          code: 'ORDER_TABLE_FORBIDS_ADDRESS',
        });
      }
      if (pickupTime != null) {
        throw new BadRequestException({
          message: 'Đơn tại bàn không dùng pickupTime.',
          code: 'ORDER_TABLE_FORBIDS_PICKUP_TIME',
        });
      }
      return;
    }

    if (type === OrderType.pickup) {
      if (!pickupTime) {
        throw new BadRequestException({
          message: 'Đơn pickup bắt buộc có pickupTime.',
          code: 'ORDER_PICKUP_TIME_REQUIRED',
        });
      }
      if (addressId != null) {
        throw new BadRequestException({
          message: 'Đơn pickup không dùng addressId.',
          code: 'ORDER_PICKUP_FORBIDS_ADDRESS',
        });
      }
      if (tableId != null) {
        throw new BadRequestException({
          message: 'Đơn pickup không dùng tableId.',
          code: 'ORDER_PICKUP_FORBIDS_TABLE',
        });
      }
    }
  }

  /**
   * Pickup phải sau `now + buffer` (mặc định 15 phút), trừ khi `skipMinLead` (POS admin — “lấy ngay”).
   * Giới hạn tối đa `MAX_PICKUP_DAYS_AHEAD`.
   * @param opts.skipMinLead — không bắt buffer N phút; vẫn chặn quá khứ > ~2 phút (lệch giờ).
   */
  assertPickupWindow(
    pickupTime: Date,
    now: Date = new Date(),
    opts?: { skipMinLead?: boolean },
  ): void {
    const maxAt = new Date(
      now.getTime() + MAX_PICKUP_DAYS_AHEAD * 24 * 60 * 60 * 1000,
    );

    if (!opts?.skipMinLead) {
      const minAt = new Date(
        now.getTime() + MIN_PICKUP_LEAD_MINUTES * 60 * 1000,
      );
      if (pickupTime.getTime() < minAt.getTime()) {
        throw new BadRequestException({
          message: `pickupTime phải sau ít nhất ${MIN_PICKUP_LEAD_MINUTES} phút so với hiện tại.`,
          code: 'ORDER_PICKUP_TOO_SOON',
        });
      }
    } else {
      const skewMs = 120_000;
      if (pickupTime.getTime() < now.getTime() - skewMs) {
        throw new BadRequestException({
          message: 'pickupTime không được quá xa trong quá khứ (so với giờ server).',
          code: 'ORDER_PICKUP_IN_PAST',
        });
      }
    }

    if (pickupTime.getTime() > maxAt.getTime()) {
      throw new BadRequestException({
        message: `pickupTime không được quá ${MAX_PICKUP_DAYS_AHEAD} ngày sau hiện tại.`,
        code: 'ORDER_PICKUP_TOO_FAR',
      });
    }
  }
}
