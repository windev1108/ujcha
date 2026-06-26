import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreatePlatformDto } from './dto/create-platform.dto';
import type { UpdatePlatformDto } from './dto/update-platform.dto';

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
      select: { id: true, name: true, link: true, thumbnailUrl: true, displayMode: true, logoWidth: true, logoHeight: true },
    });
  }

  private async findOrThrow(id: string) {
    const row = await this.prisma.deliveryPlatform.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Không tìm thấy nền tảng.');
    return row;
  }
}
