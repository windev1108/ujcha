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
  constructor(private readonly prisma: PrismaService) {}

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
  async assertOpenForOrders(now: Date = new Date()) {
    const status = await this.getStatus(now);
    if (status.isOpenForOrders) return;

    // status.status !== 'opening' nghĩa là admin chủ động đóng (kể cả busy-ngoài-giờ)
    if (status.status !== 'opening') {
      throw new BadRequestException({
        message:
          status.statusReason?.trim() ||
          'Cửa hàng đang tạm ngừng nhận đơn. Vui lòng quay lại sau.',
        code: 'STORE_CLOSED_MANUAL',
      });
    }

    throw new BadRequestException({
      message: `Cửa hàng hiện đang đóng cửa. Giờ mở cửa: ${minutesToHHmm(status.openMinutes)} - ${minutesToHHmm(status.closeMinutes)}.`,
      code: 'STORE_CLOSED_HOURS',
    });
  }
}
