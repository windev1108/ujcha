import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeTranslation } from '../../../helper/utils';
import { slugify, uniqueSlugSuffix } from '../slug.util';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class AdminCategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
  }

  async getById(id: string) {
    const row = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!row) {
      throw new NotFoundException({
        message: 'Không tìm thấy danh mục.',
        code: 'CATEGORY_NOT_FOUND',
      });
    }
    return row;
  }

  async create(dto: CreateCategoryDto) {
    let base = dto.slug?.trim() ? slugify(dto.slug) : slugify(dto.name);
    const slug = await this.allocCategorySlug(base);

    return this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        slug,
        sortOrder: dto.sortOrder ?? 0,
        thumbnail: dto.thumbnail ?? null,
        nameTranslation: normalizeTranslation(dto.nameTranslation) as unknown as Prisma.InputJsonValue,
      },
      include: { _count: { select: { products: true } } },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.getById(id);

    let slug: string | undefined;
    if (dto.slug !== undefined) {
      const base = slugify(dto.slug);
      slug = await this.allocCategorySlug(base, id);
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(slug !== undefined && { slug }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.thumbnail !== undefined && { thumbnail: dto.thumbnail || null }),
        ...(dto.nameTranslation !== undefined && {
          nameTranslation: normalizeTranslation(dto.nameTranslation) as unknown as Prisma.InputJsonValue,
        }),
      },
      include: { _count: { select: { products: true } } },
    });
  }

  async remove(id: string) {
    const cat = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!cat) {
      throw new NotFoundException({
        message: 'Không tìm thấy danh mục.',
        code: 'CATEGORY_NOT_FOUND',
      });
    }
    if (cat._count.products > 0) {
      throw new BadRequestException({
        message: 'Không xóa được danh mục đang có sản phẩm.',
        code: 'CATEGORY_HAS_PRODUCTS',
      });
    }

    await this.prisma.category.delete({ where: { id } });
  }

  private async allocCategorySlug(base: string, excludeId?: string): Promise<string> {
    let candidate = base;
    for (let i = 0; i < 12; i += 1) {
      const existing = await this.prisma.category.findFirst({
        where: {
          slug: candidate,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
        select: { id: true },
      });
      if (!existing) return candidate;
      candidate = `${base}-${uniqueSlugSuffix()}`;
    }
    throw new BadRequestException({
      message: 'Không tạo được slug duy nhất cho danh mục.',
      code: 'CATEGORY_SLUG_COLLISION',
    });
  }
}
