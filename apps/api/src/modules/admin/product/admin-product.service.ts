import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { skuFromProductName, slugify, uniqueSlugSuffix } from '../slug.util';
import type { CreateProductDto } from './dto/create-product.dto';
import type { ToggleProductAvailabilityDto } from './dto/toggle-product-availability.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import { clampDiscountPercent, expandOptionGroupsWithMap, extractVariantGroupIds, normalizeImageUrls, normalizeOptionGroupsFromDb } from '../../../helper/utils';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class AdminProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) { }

  async list(categoryId?: string, q?: string) {
    const qx = q?.trim();
    const rows = await this.prisma.product.findMany({
      where: {
        AND: [
          categoryId ? { categoryId } : {},
          qx
            ? {
              OR: [
                { name: { contains: qx, mode: 'insensitive' } },
                { sku: { contains: qx, mode: 'insensitive' } },
                { description: { contains: qx, mode: 'insensitive' } },
              ],
            }
            : {},
        ],
      },
      orderBy: [{ name: 'asc' }],
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    return this.expandProducts(rows);
  }

  async getById(id: string) {
    const row = await this.prisma.product.findUnique({
      where: { id },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    if (!row) {
      throw new NotFoundException({
        message: 'Không tìm thấy sản phẩm.',
        code: 'PRODUCT_NOT_FOUND',
      });
    }
    return this.expandProduct(row);
  }

  async create(dto: CreateProductDto) {
    const cat = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!cat) {
      throw new BadRequestException({
        message: 'Danh mục không tồn tại.',
        code: 'PRODUCT_CATEGORY_NOT_FOUND',
      });
    }

    const nameTrim = dto.name.trim();
    const skuNorm = await this.resolveSkuForCreate(dto.sku, nameTrim);

    let base = dto.slug?.trim() ? slugify(dto.slug) : slugify(nameTrim);
    const slug = await this.allocProductSlug(base);

    const imageUrls = normalizeImageUrls(dto.imageUrls);
    const optionGroupsJson = (dto.variantGroupIds ?? []).map(id => ({ variantGroupId: id }));

    const created = await this.prisma.product.create({
      data: {
        categoryId: dto.categoryId,
        sku: skuNorm,
        name: nameTrim,
        slug,
        description: dto.description?.trim() ?? null,
        price: new Prisma.Decimal(dto.price),
        imageUrls,
        optionGroups: optionGroupsJson as unknown as Prisma.InputJsonValue,
        isAvailable: dto.isAvailable ?? true,
        isSoldOut: dto.isSoldOut ?? false,
        discountPercent: clampDiscountPercent(dto.discountPercent, 0),
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    await this.redis.delByPattern('kun:products:list:*');
    return this.expandProduct(created);
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.getById(id);

    if (dto.categoryId) {
      const cat = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!cat) {
        throw new BadRequestException({
          message: 'Danh mục không tồn tại.',
          code: 'PRODUCT_CATEGORY_NOT_FOUND',
        });
      }
    }

    let skuNorm: string | undefined;
    if (dto.sku !== undefined) {
      const trimmed = dto.sku.trim();
      if (trimmed) {
        const skuTaken = await this.prisma.product.findFirst({
          where: { sku: trimmed, NOT: { id } },
          select: { id: true },
        });
        if (skuTaken) {
          throw new BadRequestException({
            message: 'SKU đã tồn tại.',
            code: 'PRODUCT_SKU_DUPLICATE',
          });
        }
        skuNorm = trimmed;
      } else {
        const nameForSku = dto.name?.trim() ?? existing.name;
        skuNorm = await this.allocUniqueSku(skuFromProductName(nameForSku), id);
      }
    }

    let slug: string | undefined;
    if (dto.slug !== undefined) {
      const base = slugify(dto.slug);
      slug = await this.allocProductSlug(base, id);
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(skuNorm !== undefined && { sku: skuNorm }),
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(slug !== undefined && { slug }),
        ...(dto.description !== undefined && {
          description: dto.description?.trim() ?? null,
        }),
        ...(dto.price !== undefined && { price: new Prisma.Decimal(dto.price) }),
        ...(dto.imageUrls !== undefined && {
          imageUrls: normalizeImageUrls(dto.imageUrls),
        }),
        ...(dto.variantGroupIds !== undefined && {
          optionGroups: dto.variantGroupIds.map(vid => ({ variantGroupId: vid })) as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.isAvailable !== undefined && { isAvailable: dto.isAvailable }),
        ...(dto.isSoldOut !== undefined && { isSoldOut: dto.isSoldOut }),
        ...(dto.discountPercent !== undefined && {
          discountPercent: clampDiscountPercent(dto.discountPercent),
        }),
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    await this.redis.delByPattern('kun:products:list:*');
    return this.expandProduct(updated);
  }

  async toggleAvailability(id: string, dto: ToggleProductAvailabilityDto) {
    await this.getById(id);
    const row = await this.prisma.product.update({
      where: { id },
      data: { isAvailable: dto.isAvailable },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    await this.redis.delByPattern('kun:products:list:*');
    return this.expandProduct(row);
  }

  async remove(id: string) {
    await this.getById(id);
    try {
      await this.prisma.product.delete({ where: { id } });
      await this.redis.delByPattern('kun:products:list:*');
    } catch (e: any) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e?.code === 'P2003'
      ) {
        throw new BadRequestException({
          message:
            'Không xóa được sản phẩm đang nằm trong giỏ hoặc đơn hàng.',
          code: 'PRODUCT_REFERENCED',
        });
      }
      throw e;
    }
  }

  private async expandProducts<T extends { optionGroups: unknown }>(
    rows: T[],
  ): Promise<(T & { optionGroups: any[]; variantGroupIds: string[] })[]> {
    // Collect all unique variantGroupIds from all products
    const allIds = new Set<string>();
    for (const row of rows) {
      for (const id of extractVariantGroupIds(row.optionGroups)) allIds.add(id);
    }
    // Fetch in one query
    const vgMap = new Map<string, any>();
    if (allIds.size > 0) {
      const vgs = await this.prisma.variantGroup.findMany({ where: { id: { in: [...allIds] } } });
      for (const vg of vgs) vgMap.set(vg.id, vg);
    }
    return rows.map(row => ({
      ...row,
      optionGroups: expandOptionGroupsWithMap(row.optionGroups, vgMap),
      variantGroupIds: extractVariantGroupIds(row.optionGroups),
    }));
  }

  private async expandProduct<T extends { optionGroups: unknown }>(
    row: T,
  ): Promise<T & { optionGroups: any[]; variantGroupIds: string[] }> {
    const [result] = await this.expandProducts([row]);
    return result!;
  }

  /** SKU có nhập: kiểm tra trùng; không nhập: sinh từ tên + đảm bảo unique. */
  private async resolveSkuForCreate(
    explicit: string | undefined,
    productName: string,
  ): Promise<string> {
    const trimmed = explicit?.trim();
    if (trimmed) {
      const skuTaken = await this.prisma.product.findFirst({
        where: { sku: trimmed },
        select: { id: true },
      });
      if (skuTaken) {
        throw new BadRequestException({
          message: 'SKU đã tồn tại.',
          code: 'PRODUCT_SKU_DUPLICATE',
        });
      }
      return trimmed;
    }
    const base = skuFromProductName(productName);
    return this.allocUniqueSku(base);
  }

  private async allocUniqueSku(
    base: string,
    excludeId?: string,
  ): Promise<string> {
    let candidate = (base || 'item').slice(0, 80);
    for (let i = 0; i < 12; i += 1) {
      const existing = await this.prisma.product.findFirst({
        where: {
          sku: candidate,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
        select: { id: true },
      });
      if (!existing) return candidate;
      const suffix = uniqueSlugSuffix();
      const raw = `${base || 'item'}-${suffix}`;
      candidate = raw.slice(0, 80);
    }
    throw new BadRequestException({
      message: 'Không tạo được mã SKU duy nhất.',
      code: 'PRODUCT_SKU_COLLISION',
    });
  }

  private async allocProductSlug(base: string, excludeId?: string): Promise<string> {
    let candidate = base;
    for (let i = 0; i < 12; i += 1) {
      const existing = await this.prisma.product.findFirst({
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
      message: 'Không tạo được slug duy nhất cho sản phẩm.',
      code: 'PRODUCT_SLUG_COLLISION',
    });
  }
}
