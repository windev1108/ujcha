import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, OrderType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateShipperDto } from './dto/create-shipper.dto';
import type { FromStaffShipperDto } from './dto/from-staff-shipper.dto';
import type { ToggleShipperAvailabilityDto } from './dto/toggle-shipper-availability.dto';
import type { UpdateShipperDto } from './dto/update-shipper.dto';

/** Đơn delivery đang chiếm shipper (chưa hoàn tất / hủy). */
const SHIPPER_BUSY_STATUSES: OrderStatus[] = [
  OrderStatus.pending,
  OrderStatus.confirmed,
  OrderStatus.preparing,
  OrderStatus.ready,
  OrderStatus.delivering,
];

@Injectable()
export class AdminShipperService {
  constructor(private readonly prisma: PrismaService) { }

  async list(activeOnly?: boolean) {
    const shippers = await this.prisma.shipper.findMany({
      where: activeOnly === true ? { isActive: true } : undefined,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: {
        admin: {
          select: {
            faceProfile: { select: { imageUrl: true } },
          },
        },
      },
    });

    const deliveryCounts = await this.prisma.order.groupBy({
      by: ['shipperId'],
      where: {
        type: OrderType.delivery,
        status: OrderStatus.completed,
        shipperId: { not: null },
      },
      orderBy: { shipperId: 'asc' },
      _count: true,
    });

    const countMap = new Map(
      deliveryCounts
        .filter((r): r is typeof r & { shipperId: string } => r.shipperId != null)
        .map((r) => {
          const c = r._count;
          const n = typeof c === 'number' ? c : (c as { _all: number })._all;
          return [r.shipperId, n] as const;
        }),
    );

    return shippers.map(({ admin, ...s }) => ({
      ...s,
      imageUrl: admin?.faceProfile?.imageUrl ?? null,
      completedDeliveryCount: countMap.get(s.id) ?? 0,
    }));
  }

  async getStats() {
    const [
      totalRegistered,
      totalActive,
      busyGroups,
      completedSample,
    ] = await this.prisma.$transaction([
      this.prisma.shipper.count(),
      this.prisma.shipper.count({ where: { isActive: true } }),
      this.prisma.order.groupBy({
        by: ['shipperId'],
        where: {
          type: OrderType.delivery,
          shipperId: { not: null },
          status: { in: SHIPPER_BUSY_STATUSES },
        },
        orderBy: { shipperId: 'asc' },
        _count: true,
      }),
      this.prisma.order.findMany({
        where: {
          type: OrderType.delivery,
          status: OrderStatus.completed,
          shipperId: { not: null },
        },
        select: { createdAt: true, updatedAt: true },
        take: 3000,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const busyIds = new Set(
      busyGroups
        .map((g) => g.shipperId)
        .filter((id): id is string => id != null),
    );

    const activeShipperIds = (
      await this.prisma.shipper.findMany({
        where: { isActive: true },
        select: { id: true },
      })
    ).map((s) => s.id);

    const availableNow = activeShipperIds.filter((id) => !busyIds.has(id))
      .length;

    let avgDeliveryMinutes: number | null = null;
    let sumMin = 0;
    let n = 0;
    for (const o of completedSample) {
      const ms = o.updatedAt.getTime() - o.createdAt.getTime();
      if (ms > 0) {
        sumMin += ms / 60_000;
        n += 1;
      }
    }
    if (n > 0) {
      avgDeliveryMinutes = Math.round(sumMin / n);
    }

    return {
      totalRegistered,
      totalActive,
      availableNow,
      avgDeliveryMinutes,
    };
  }

  async getById(id: string) {
    const row = await this.prisma.shipper.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({
        message: 'Không tìm thấy shipper.',
        code: 'SHIPPER_NOT_FOUND',
      });
    }
    return row;
  }

  async create(dto: CreateShipperDto) {
    return this.prisma.shipper.create({
      data: {
        name: dto.name.trim(),
        phone: dto.phone?.trim() ?? null,
      },
    });
  }

  async fromStaff(dto: FromStaffShipperDto) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: dto.adminId },
      include: { faceProfile: { select: { imageUrl: true } } },
    });
    if (!admin) {
      throw new NotFoundException({
        message: 'Không tìm thấy nhân viên.',
        code: 'ADMIN_NOT_FOUND',
      });
    }

    const existing = await this.prisma.shipper.findUnique({
      where: { adminId: dto.adminId },
    });
    if (existing) {
      throw new ConflictException({
        message: 'Nhân viên này đã được thêm làm shipper.',
        code: 'SHIPPER_ALREADY_EXISTS',
      });
    }

    const shipper = await this.prisma.shipper.create({
      data: {
        adminId: dto.adminId,
        name: admin.name?.trim() || admin.email.split('@')[0],
        phone: admin.phone?.trim() ?? null,
      },
    });

    return {
      ...shipper,
      imageUrl: admin.faceProfile?.imageUrl ?? null,
    };
  }

  async update(id: string, dto: UpdateShipperDto) {
    await this.getById(id);
    return this.prisma.shipper.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.phone !== undefined && { phone: dto.phone?.trim() ?? null }),
      },
    });
  }

  async toggleAvailability(id: string, dto: ToggleShipperAvailabilityDto) {
    await this.getById(id);
    return this.prisma.shipper.update({
      where: { id },
      data: { isActive: dto.isActive },
    });
  }
}
