// src/modules/store/store-status.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  isWithinStoreHours,
  minutesToHHmm,
  vnMinutesOfDay,
} from '../../helper/utils';
import { StoreOperationStatus } from '@prisma/client';

@Injectable()
export class StoreStatusService {
  constructor(private readonly prisma: PrismaService) { }

  async getConfig() {
    const existing = await this.prisma.storeHoursConfig.findUnique({
      where: { id: 'default' },
    });
    if (existing) return existing;
    return this.prisma.storeHoursConfig.create({ data: { id: 'default' } });
  }

  /**
   * effectiveStatus là trạng thái THỰC TẾ sau khi đối chiếu với giờ mở cửa —
   * FE và logic chặn đơn đều dựa vào field này, không dùng `status` thô.
   */
  async getStatus(now: Date = new Date()) {
    const cfg = await this.getConfig();
    const nowMinutes = vnMinutesOfDay(now);
    const withinHours = isWithinStoreHours(
      cfg.openMinutes,
      cfg.closeMinutes,
      nowMinutes,
    );

    let effectiveStatus: StoreOperationStatus;
    if (cfg.status === 'closed') {
      effectiveStatus = 'closed';
    } else if (cfg.status === 'busy') {
      // Đông khách chỉ có ý nghĩa khi quán đang trong giờ mở cửa
      effectiveStatus = withinHours ? 'busy' : 'closed';
    } else {
      effectiveStatus = withinHours ? 'opening' : 'closed';
    }

    return {
      ...cfg,
      withinHours,
      effectiveStatus,
      isOpenForOrders: effectiveStatus !== 'closed',
    };
  }

  /** Validate DUY NHẤT ở đây. FE không tự tính giờ để chặn nữa. */
  async assertOpenForOrders(
    now: Date = new Date(),
    opts?: { scheduledAt?: Date | null },
  ) {
    const status = await this.getStatus(now);
    if (status.isOpenForOrders) return;

    // Admin chủ động đóng → chặn cả đơn hẹn giờ
    if (status.status === 'closed') {
      throw new BadRequestException({
        message:
          status.statusReason?.trim() ||
          'Cửa hàng đang tạm ngừng nhận đơn. Vui lòng quay lại sau.',
        code: 'STORE_CLOSED_MANUAL',
      });
    }

    // Ngoài giờ mở cửa: cho phép nếu là đơn hẹn giờ và giờ hẹn nằm trong giờ mở cửa
    if (opts?.scheduledAt) {
      const scheduledWithinHours = isWithinStoreHours(
        status.openMinutes,
        status.closeMinutes,
        vnMinutesOfDay(opts.scheduledAt),
      );
      if (scheduledWithinHours) return;

      throw new BadRequestException({
        message: `Giờ hẹn giao phải nằm trong giờ mở cửa: ${minutesToHHmm(status.openMinutes)} - ${minutesToHHmm(status.closeMinutes)}.`,
        code: 'STORE_SCHEDULE_OUTSIDE_HOURS',
      });
    }

    throw new BadRequestException({
      message: `Cửa hàng hiện đang đóng cửa. Giờ mở cửa: ${minutesToHHmm(status.openMinutes)} - ${minutesToHHmm(status.closeMinutes)}. Bạn có thể chọn hẹn giờ giao trong giờ mở cửa.`,
      code: 'STORE_CLOSED_HOURS',
    });
  }
}
