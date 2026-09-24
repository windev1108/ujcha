import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreatePlatformDto } from './dto/create-platform.dto';
import type { UpdatePlatformDto } from './dto/update-platform.dto';
import { UpdateStoreStatusDto } from '../../store/dto/update-store-status.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Injectable()
export class AdminStoreService {
  constructor(private readonly prisma: PrismaService) { }

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

  async getAnnouncement() {
    const existing = await this.prisma.globalAnnouncement.findUnique({
      where: { id: 'default' },
    });
    if (existing) return existing;
    return this.prisma.globalAnnouncement.create({ data: { id: 'default' } });
  }

  async updateAnnouncement(dto: UpdateAnnouncementDto) {
    const current = await this.getAnnouncement();

    const next = {
      isActive: dto.isActive ?? current.isActive,
      type: dto.type ?? current.type,
      frequency: dto.frequency ?? current.frequency,
      title: dto.title !== undefined ? dto.title.trim() : current.title,
      content: dto.content !== undefined ? dto.content.trim() : current.content,
      ctaLabel:
        dto.ctaLabel !== undefined
          ? dto.ctaLabel?.trim() || null
          : current.ctaLabel,
      ctaUrl:
        dto.ctaUrl !== undefined ? dto.ctaUrl?.trim() || null : current.ctaUrl,
      imageUrl:
        dto.imageUrl !== undefined
          ? dto.imageUrl?.trim() || null
          : current.imageUrl,
      startsAt:
        dto.startsAt !== undefined
          ? dto.startsAt
            ? new Date(dto.startsAt)
            : null
          : current.startsAt,
      endsAt:
        dto.endsAt !== undefined
          ? dto.endsAt
            ? new Date(dto.endsAt)
            : null
          : current.endsAt,
    };

    if (next.isActive && !next.title && !next.content) {
      throw new BadRequestException(
        'Cần nhập tiêu đề hoặc nội dung thông báo.',
      );
    }
    if (!!next.ctaLabel !== !!next.ctaUrl) {
      throw new BadRequestException(
        'Nút hành động cần có cả nhãn và đường dẫn.',
      );
    }
    if (next.startsAt && next.endsAt && next.endsAt <= next.startsAt) {
      throw new BadRequestException(
        'Thời gian kết thúc phải sau thời gian bắt đầu.',
      );
    }

    const contentChanged =
      next.type !== current.type ||
      next.title !== current.title ||
      next.content !== current.content ||
      next.ctaLabel !== current.ctaLabel ||
      next.ctaUrl !== current.ctaUrl ||
      next.imageUrl !== current.imageUrl;

    return this.prisma.globalAnnouncement.update({
      where: { id: 'default' },
      data: { ...next, ...(contentChanged && { version: { increment: 1 } }) },
    });
  }
}
