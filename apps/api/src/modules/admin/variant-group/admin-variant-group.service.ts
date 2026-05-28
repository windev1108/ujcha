import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeOptionGroupValues } from '../../../helper/utils';
import type { CreateVariantGroupDto } from './dto/create-variant-group.dto';
import type { UpdateVariantGroupDto } from './dto/update-variant-group.dto';

@Injectable()
export class AdminVariantGroupService {
  constructor(private readonly prisma: PrismaService) { }

  async list() {
    const rows = await this.prisma.variantGroup.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(r => ({ ...r, values: normalizeOptionGroupValues(r.values) }));
  }

  async getById(id: string) {
    const row = await this.prisma.variantGroup.findUnique({ where: { id } });
    if (!row) throw new NotFoundException({ message: 'Variant group không tồn tại.', code: 'VARIANT_GROUP_NOT_FOUND' });
    return { ...row, values: normalizeOptionGroupValues(row.values) };
  }

  async create(dto: CreateVariantGroupDto) {
    const values = normalizeVariantValues(dto.values ?? []);
    const created = await this.prisma.variantGroup.create({
      data: {
        name: dto.name.trim(),
        values: values as unknown as Prisma.InputJsonValue,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
    return { ...created, values: normalizeOptionGroupValues(created.values) };
  }

  async update(id: string, dto: UpdateVariantGroupDto) {
    await this.getById(id);
    const updated = await this.prisma.variantGroup.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.values !== undefined && { values: normalizeVariantValues(dto.values) as unknown as Prisma.InputJsonValue }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    return { ...updated, values: normalizeOptionGroupValues(updated.values) };
  }

  async remove(id: string) {
    await this.getById(id);
    await this.prisma.variantGroup.delete({ where: { id } });
  }
}

function normalizeVariantValues(
  values: Array<{ label: string; priceDelta?: number; sortOrder?: number }>,
): Array<{ label: string; priceDelta: number; sortOrder: number }> {
  const byLabel = new Map<string, { label: string; priceDelta: number; sortOrder: number }>();
  values.forEach((v, index) => {
    const label = v.label.trim();
    if (!label) return;
    const pd = v.priceDelta ?? 0;
    if (!byLabel.has(label)) {
      byLabel.set(label, {
        label,
        priceDelta: Number.isFinite(pd) && pd >= 0 ? Math.round(pd * 100) / 100 : 0,
        sortOrder: v.sortOrder ?? index,  // dùng index làm fallback
      });
    }
  });
  return [...byLabel.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}