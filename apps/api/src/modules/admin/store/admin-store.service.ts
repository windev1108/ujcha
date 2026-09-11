import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreatePlatformDto } from './dto/create-platform.dto';
import type { UpdatePlatformDto } from './dto/update-platform.dto';
import { UpdateStoreStatusDto } from '../../store/dto/update-store-status.dto';

@Injectable()
export class AdminStoreService {
  constructor(private readonly prisma: PrismaService) {}

  async listPlatforms() {
    return this.prisma.deliveryPlatform.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createPlatform(dto: CreatePlatformDto) {
    return this.prisma.deliveryPlatform.create({
      data: {
        name: dto.name,
        link: dto.link,
        thumbnailUrl: dto.thumbnailUrl,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        displayMode: dto.displayMode ?? 'logo_and_text',
        logoWidth: dto.logoWidth ?? 28,
        logoHeight: dto.logoHeight ?? 28,
      },
    });
  }

  async updatePlatform(id: string, dto: UpdatePlatformDto) {
    await this.findOrThrow(id);
    return this.prisma.deliveryPlatform.update({ where: { id }, data: dto });
  }

  async deletePlatform(id: string) {
    await this.findOrThrow(id);
    await this.prisma.deliveryPlatform.delete({ where: { id } });
  }

  async listActivePlatforms() {
    return this.prisma.deliveryPlatform.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        link: true,
        thumbnailUrl: true,
        displayMode: true,
        logoWidth: true,
        logoHeight: true,
      },
    });
  }

  private async findOrThrow(id: string) {
    const row = await this.prisma.deliveryPlatform.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Không tìm thấy nền tảng.');
    return row;
  }

  async getStoreStatus() {
    const existing = await this.prisma.storeHoursConfig.findUnique({
      where: { id: 'default' },
    });
    if (existing) return existing;
    return this.prisma.storeHoursConfig.create({ data: { id: 'default' } });
  }

  async updateStoreStatus(dto: UpdateStoreStatusDto) {
    const current = await this.getStoreStatus();
    return this.prisma.storeHoursConfig.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        openMinutes: dto.openMinutes ?? current.openMinutes,
        closeMinutes: dto.closeMinutes ?? current.closeMinutes,
        status: dto.status ?? 'opening',
        statusReason: dto.statusReason?.trim() || null,
      },
      update: {
        ...(dto.openMinutes !== undefined && { openMinutes: dto.openMinutes }),
        ...(dto.closeMinutes !== undefined && {
          closeMinutes: dto.closeMinutes,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.statusReason !== undefined && {
          statusReason: dto.statusReason.trim() || null,
        }),
      },
    });
  }
}
