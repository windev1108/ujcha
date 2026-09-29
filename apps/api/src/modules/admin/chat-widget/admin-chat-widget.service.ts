// chat-widget/chat-widget.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../../upload/upload.service';
import { BatchUpdateStickersDto } from './dto/chat-widget.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminChatWidgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  listAllForAdmin() {
    return this.prisma.sticker.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { album: { select: { id: true, name: true } } },
    });
  }

  listActiveForUser() {
    return this.prisma.sticker.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        url: true,
        alt: true,
        albumId: true,
        album: { select: { id: true, name: true, sortOrder: true } },
      },
    });
  }

  async createByUrl(url: string, alt?: string, albumId?: string) {
    const agg = await this.prisma.sticker.aggregate({
      _max: { sortOrder: true },
    });
    return this.prisma.sticker.create({
      data: {
        url,
        alt: alt ?? '',
        albumId,
        sortOrder: (agg._max.sortOrder ?? -1) + 1,
      },
    });
  }

  async createByFile(
    buffer: Buffer,
    filename: string,
    alt?: string,
    albumId?: string,
  ) {
    const url = await this.uploadService.uploadStickerImage(buffer, filename);
    return this.createByUrl(url, alt, albumId);
  }

  async update(
    id: string,
    data: { alt?: string; isActive?: boolean; albumId?: string | null },
  ) {
    const sticker = await this.prisma.sticker.findUnique({ where: { id } });
    if (!sticker) throw new NotFoundException('Không tìm thấy sticker.');
    return this.prisma.sticker.update({ where: { id }, data });
  }
  async delete(id: string) {
    const sticker = await this.prisma.sticker.findUnique({ where: { id } });
    if (!sticker) throw new NotFoundException('Không tìm thấy sticker.');
    await this.prisma.sticker.delete({ where: { id } });
    await this.uploadService.deleteByUrls([sticker.url]);
    return { success: true };
  }

  async reorder(ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.sticker.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    return this.listAllForAdmin();
  }

  listAlbumsForAdmin() {
    return this.prisma.stickerAlbum.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createAlbum(name: string) {
    const agg = await this.prisma.stickerAlbum.aggregate({
      _max: { sortOrder: true },
    });
    return this.prisma.stickerAlbum.create({
      data: { name, sortOrder: (agg._max.sortOrder ?? -1) + 1 },
    });
  }

  async updateAlbum(id: string, data: { name?: string; isActive?: boolean }) {
    const album = await this.prisma.stickerAlbum.findUnique({ where: { id } });
    if (!album) throw new NotFoundException('Không tìm thấy album.');
    return this.prisma.stickerAlbum.update({ where: { id }, data });
  }

  async deleteAlbum(id: string) {
    // Sticker.albumId có onDelete: SetNull → sticker trong album không bị xoá,
    // chỉ mất gắn kết album (rơi về nhóm "Misc" phía FE).
    await this.prisma.stickerAlbum.delete({ where: { id } });
    return { success: true };
  }

  async reorderAlbums(ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.stickerAlbum.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    return this.listAlbumsForAdmin();
  }

  async batchUpdate(dto: BatchUpdateStickersDto) {
    const ops: Prisma.PrismaPromise<unknown>[] = [];

    for (const c of dto.changes ?? []) {
      ops.push(
        this.prisma.sticker.update({
          where: { id: c.id },
          // undefined = giữ nguyên, null = gỡ khỏi album
          data: { isActive: c.isActive, albumId: c.albumId },
        }),
      );
    }

    (dto.order ?? []).forEach((id, index) => {
      ops.push(
        this.prisma.sticker.update({
          where: { id },
          data: { sortOrder: index },
        }),
      );
    });

    if (ops.length > 0) await this.prisma.$transaction(ops);
    return this.listAllForAdmin();
  }
}
