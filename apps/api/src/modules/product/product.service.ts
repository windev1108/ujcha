import { Injectable, NotFoundException } from '@nestjs/common';
import { normalizeInlineOptionGroups, normalizeInlineToppings } from '../../helper/utils';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const PRODUCT_LIST_TTL = 300;
const PRODUCT_LIST_KEY = (categoryId?: string, categorySlug?: string, q?: string) =>
    `kun:products:list:${categoryId ?? ''}:${categorySlug ?? ''}:${q ?? ''}`;

@Injectable()
export class ProductService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
    ) { }

    async list(categoryId?: string, categorySlug?: string, q?: string, locale?: string) {
        const qx = q?.trim();
        const cacheKey = PRODUCT_LIST_KEY(categoryId, categorySlug, qx);
        const cached = await this.redis.get(cacheKey);
        if (cached) return cached;

        const categoryFilter = categoryId
            ? { categoryId }
            : categorySlug
            ? { category: { slug: categorySlug } }
            : {};
        const rows = await this.prisma.product.findMany({
            where: {
                AND: [
                    categoryFilter,
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
            include: { category: { select: { id: true, name: true, nameTranslation: true, slug: true, thumbnail: true } } },
        });
        const result = rows.map(normalizeProductRow);
        await this.redis.set(cacheKey, result, PRODUCT_LIST_TTL);
        return result.map(p => applyLocale(p, locale));
    }

    async invalidateListCache() {
        await this.redis.delByPattern('kun:products:list:*');
    }

    async getById(id: string, locale?: string) {
        const row = await this.prisma.product.findUnique({
            where: { id },
            include: { category: { select: { id: true, name: true, nameTranslation: true, slug: true, thumbnail: true } } },
        });
        if (!row) {
            throw new NotFoundException({
                message: 'Không tìm thấy sản phẩm.',
                code: 'PRODUCT_NOT_FOUND',
            });
        }
        return applyLocale(normalizeProductRow(row), locale);
    }

    async getBySlug(slug: string, locale?: string) {
        const row = await this.prisma.product.findUnique({
            where: { slug },
            include: { category: { select: { id: true, name: true, nameTranslation: true, slug: true, thumbnail: true } } },
        });
        if (!row) {
            throw new NotFoundException({
                message: 'Không tìm thấy sản phẩm.',
                code: 'PRODUCT_NOT_FOUND',
            });
        }
        return applyLocale(normalizeProductRow(row), locale);
    }
}

/** Override `name` with the translation for the given locale (non-vi only). */
function applyLocale<T extends { name: string; nameTranslation: Record<string, string> }>(
    product: T,
    locale: string | undefined,
): T {
    if (!locale || locale === 'vi') return product;
    const translated = product.nameTranslation?.[locale]?.trim();
    if (!translated) return product;
    return { ...product, name: translated };
}

function normalizeProductRow<T extends { optionGroups: unknown; toppings: unknown; nameTranslation: unknown; descriptionTranslation: unknown }>(row: T) {
    return {
        ...row,
        optionGroups: normalizeInlineOptionGroups(row.optionGroups as any),
        toppings: normalizeInlineToppings(row.toppings as any),
        nameTranslation: (row.nameTranslation && typeof row.nameTranslation === 'object' ? row.nameTranslation : {}) as Record<string, string>,
        descriptionTranslation: (row.descriptionTranslation && typeof row.descriptionTranslation === 'object' ? row.descriptionTranslation : {}) as Record<string, string>,
    };
}
