import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { OrderStatus, OrderType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateTableDto } from './dto/create-table.dto';
import type { UpdateTableDto } from './dto/update-table.dto';

/** Đơn bàn đang phục vụ (chưa kết thúc). */
const TABLE_ACTIVE_STATUSES: OrderStatus[] = [
  OrderStatus.pending,
  OrderStatus.confirmed,
  OrderStatus.preparing,
  OrderStatus.ready,
];

@Injectable()
export class AdminTableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) { }

  tableQrUrl(tableId: string): string {
    const base =
      this.config.get<string>('APP_PUBLIC_URL') ?? 'http://localhost:3000';
    return `${base.replace(/\/$/, '')}/table/${tableId}`;
  }

  /** Danh sách + cờ đang có đơn mở (để UI hiển thị trạng thái). */
  async list() {
    const tables = await this.prisma.table.findMany({
      orderBy: [{ area: 'asc' }, { name: 'asc' }],
    });

    const inUseRows = await this.prisma.order.groupBy({
      by: ['tableId'],
      where: {
        type: OrderType.table,
        tableId: { not: null },
        status: { in: TABLE_ACTIVE_STATUSES },
      },
      orderBy: { tableId: 'asc' },
      _count: true,
    });

    const inUseIds = new Set(
      inUseRows.map((r) => r.tableId).filter((id): id is string => id != null),
    );

    return tables.map((t) => ({
      ...t,
      inUse: inUseIds.has(t.id),
    }));
  }

  async getStats() {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setUTCDate(now.getUTCDate() - now.getUTCDay());
    startOfWeek.setUTCHours(0, 0, 0, 0);

    const [totalTables, inUseGroup, newTablesThisWeek, tableOrdersCount] =
      await this.prisma.$transaction([
        this.prisma.table.count({ where: { isActive: true } }),
        this.prisma.order.groupBy({
          by: ['tableId'],
          where: {
            type: OrderType.table,
            tableId: { not: null },
            status: { in: TABLE_ACTIVE_STATUSES },
          },
          orderBy: { tableId: 'asc' },
          _count: true,
        }),
        this.prisma.table.count({
          where: { createdAt: { gte: startOfWeek } },
        }),
        this.prisma.order.count({
          where: { type: OrderType.table },
        }),
      ]);

    const inUseCount = inUseGroup.length;
    const capacityPercent =
      totalTables > 0
        ? Math.round((inUseCount / totalTables) * 1000) / 10
        : 0;

    return {
      totalTables,
      inUseCount,
      capacityPercent,
      newTablesThisWeek,
      tableOrdersCount,
    };
  }

  async getById(id: string) {
    const row = await this.prisma.table.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({
        message: 'Không tìm thấy bàn.',
        code: 'TABLE_NOT_FOUND',
      });
    }
    return row;
  }

  async create(dto: CreateTableDto) {
    const id = randomUUID();
    const qrCode = this.tableQrUrl(id);
    const area = (dto.area ?? 'Tầng 1').trim();
    return this.prisma.table.create({
      data: {
        id,
        name: dto.name.trim(),
        area,
        qrCode,
        isActive: true,
      },
    });
  }

  async update(id: string, dto: UpdateTableDto) {
    await this.getById(id);
    return this.prisma.table.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.area !== undefined && { area: dto.area.trim() }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  /** Trả URL để render QR (đã lưu trong `qrCode`). */
  async getQrPayload(id: string) {
    const table = await this.getById(id);
    return {
      tableId: table.id,
      url: table.qrCode,
      path: `/table/${table.id}`,
    };
  }

  /** Đồng bộ lại `qrCode` theo `APP_PUBLIC_URL` hiện tại (id bàn không đổi). */
  async regenerateQr(id: string) {
    await this.getById(id);
    const qrCode = this.tableQrUrl(id);
    return this.prisma.table.update({
      where: { id },
      data: { qrCode },
    });
  }

  async deactivate(id: string) {
    await this.getById(id);
    return this.prisma.table.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /** Xóa hẳn chỉ khi chưa có đơn gắn bàn. */
  async remove(id: string) {
    await this.getById(id);
    const n = await this.prisma.order.count({ where: { tableId: id } });
    if (n > 0) {
      throw new BadRequestException({
        message: 'Bàn đã có đơn hàng, không xóa được. Có thể tắt bàn thay thế.',
        code: 'TABLE_HAS_ORDERS',
      });
    }
    await this.prisma.table.delete({ where: { id } });
  }
}
