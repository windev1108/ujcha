import { Injectable, NotFoundException } from '@nestjs/common';
import {
    normalizeInlineOptionGroups,
    normalizeInlineToppings,
} from '../../helper/utils';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const PRODUCT_LIST_TTL = 300;
const PRODUCT_LIST_KEY = (categoryId?: string, categorySlug?: string, q?: string) =>
    `kun:products:list:${categoryId ?? ''}:${categorySlug ?? ''}:${q ?? ''}`;
const GLOBAL_DISCOUNT_KEY = 'kun:shop:globalDiscount';
const GLOBAL_DISCOUNT_TTL = 60;

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
        const globalDiscount = await this.getGlobalDiscount();
        if (cached) return (cached as any[]).map((p: any) => applyLocale(applyGlobalDiscount(p, globalDiscount), locale));

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
            take: 200,
            include: { category: { select: { id: true, name: true, nameTranslation: true, slug: true, thumbnail: true } } },
        });
        const result = rows.map(normalizeProductRow);
        await this.redis.set(cacheKey, result, PRODUCT_LIST_TTL);
        return result.map(p => applyLocale(applyGlobalDiscount(p, globalDiscount), locale));
    }

    async invalidateListCache() {
        await this.redis.delByPattern('kun:products:list:*');
    }

    async getById(id: string, locale?: string) {
        const [row, globalDiscount] = await Promise.all([
            this.prisma.product.findUnique({
                where: { id },
                include: { category: { select: { id: true, name: true, nameTranslation: true, slug: true, thumbnail: true } } },
            }),
            this.getGlobalDiscount(),
        ]);
        if (!row) {
            throw new NotFoundException({
                message: 'Không tìm thấy sản phẩm.',
                code: 'PRODUCT_NOT_FOUND',
            });
        }
        return applyLocale(applyGlobalDiscount(normalizeProductRow(row), globalDiscount), locale);
    }

    async getBySlug(slug: string, locale?: string) {
        const [row, globalDiscount] = await Promise.all([
            this.prisma.product.findUnique({
                where: { slug },
                include: { category: { select: { id: true, name: true, nameTranslation: true, slug: true, thumbnail: true } } },
            }),
            this.getGlobalDiscount(),
        ]);
        if (!row) {
            throw new NotFoundException({
                message: 'Không tìm thấy sản phẩm.',
                code: 'PRODUCT_NOT_FOUND',
            });
        }
        return applyLocale(applyGlobalDiscount(normalizeProductRow(row), globalDiscount), locale);
    }

    private async getGlobalDiscount(): Promise<number> {
        const cached = await this.redis.get<number>(GLOBAL_DISCOUNT_KEY);
        if (cached !== null) return cached;
        const settings = await this.prisma.shopSettings.findFirst();
        const val = settings?.globalDiscountPercent ?? 0;
        await this.redis.set(GLOBAL_DISCOUNT_KEY, val, GLOBAL_DISCOUNT_TTL);
        return val;
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

function applyGlobalDiscount<T extends { discountPercent: number }>(product: T, globalDiscount: number): T {
    if (!globalDiscount) return product;
    return { ...product, discountPercent: Math.min(100, product.discountPercent + globalDiscount) };
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
