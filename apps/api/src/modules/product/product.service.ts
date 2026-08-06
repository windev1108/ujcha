import { Injectable, NotFoundException } from '@nestjs/common';
import {
    computeFinalPrice,
    normalizeInlineOptionGroups,
    normalizeInlineToppings,
    sortBySales,
    withSoldCount,
} from '../../helper/utils';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { OrderStatus } from '@prisma/client/wasm';

const PRODUCT_LIST_TTL = 300;
const PRODUCT_LIST_KEY = (
    categoryId?: string,
    categorySlug?: string,
    q?: string,
) => `ujcha:products:list:${categoryId ?? ''}:${categorySlug ?? ''}:${q ?? ''}`;
const GLOBAL_DISCOUNT_KEY = 'ujcha:shop:globalDiscount';
const GLOBAL_DISCOUNT_TTL = 60;
const SOLD_COUNT_KEY = 'ujcha:products:soldCount';
const SOLD_COUNT_TTL = 300;

@Injectable()
export class ProductService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
    ) { }

    async list(
        categoryId?: string,
        categorySlug?: string,
        q?: string,
        locale?: string,
    ) {
        const qx = q?.trim();
        const cacheKey = PRODUCT_LIST_KEY(categoryId, categorySlug, qx);
        const cached = await this.redis.get(cacheKey);
        const [globalDiscount, soldCounts] = await Promise.all([
            this.getGlobalDiscount(),
            this.getSoldCounts(),
        ]);

        const decorate = (p: any) =>
            withFinalPrice(
                applyLocale(
                    applyGlobalDiscount(withSoldCount(p, soldCounts), globalDiscount),
                    locale,
                ),
            );

        if (cached) return sortBySales((cached as any[]).map(decorate));

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
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                        nameTranslation: true,
                        slug: true,
                        thumbnail: true,
                    },
                },
            },
        });
        const result = rows.map(normalizeProductRow);
        await this.redis.set(cacheKey, result, PRODUCT_LIST_TTL);
        return sortBySales(result.map(decorate));
    }

    async bestSellers(limit = 12, locale?: string) {
        const [globalDiscount, soldCounts] = await Promise.all([
            this.getGlobalDiscount(),
            this.getSoldCounts(),
        ]);

        // Lấy dư ứng viên (x3) để bù các sp đã hết hàng / ngừng bán bị lọc ra sau
        const candidateIds = Object.entries(soldCounts)
            .filter(([, count]) => count > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit * 3)
            .map(([id]) => id);

        if (candidateIds.length === 0) return [];

        const rows = await this.prisma.product.findMany({
            where: { id: { in: candidateIds }, isAvailable: true, isSoldOut: false },
            include: {
                category: {
                    select: { id: true, name: true, nameTranslation: true, slug: true, thumbnail: true },
                },
            },
        });

        const decorated = rows.map(normalizeProductRow).map((p) =>
            withFinalPrice(
                applyLocale(
                    applyGlobalDiscount(withSoldCount(p, soldCounts), globalDiscount),
                    locale,
                ),
            ),
        );

        return sortBySales(decorated).slice(0, limit);
    }

    private async getSoldCounts(): Promise<Record<string, number>> {
        const cached = await this.redis.get<Record<string, number>>(SOLD_COUNT_KEY);
        if (cached) return cached;
        const grouped = await this.prisma.orderItem.groupBy({
            by: ['productId'],
            _sum: { quantity: true },
            where: { order: { status: OrderStatus.completed } },
        });
        const map: Record<string, number> = {};
        for (const g of grouped) map[g.productId] = g._sum.quantity ?? 0;
        await this.redis.set(SOLD_COUNT_KEY, map, SOLD_COUNT_TTL);
        return map;
    }

    // (tuỳ chọn) để invalidate cache lượt bán khi có order mới hoàn tất, gọi song song invalidateListCache
    async invalidateSoldCountCache() {
        await this.redis.del(SOLD_COUNT_KEY);
    }
    async invalidateListCache() {
        await this.redis.delByPattern('ujcha:products:list:*');
    }

    async getById(id: string, locale?: string) {
        const [row, globalDiscount, soldCounts] = await Promise.all([
            this.prisma.product.findUnique({
                where: { id },
                include: { category: { select: { id: true, name: true, nameTranslation: true, slug: true, thumbnail: true } } },
            }),
            this.getGlobalDiscount(),
            this.getSoldCounts(),
        ]);
        if (!row) {
            throw new NotFoundException({
                message: 'Không tìm thấy sản phẩm.',
                code: 'PRODUCT_NOT_FOUND',
            });
        }
        return withFinalPrice(applyLocale(applyGlobalDiscount(withSoldCount(normalizeProductRow(row), soldCounts), globalDiscount), locale));
    }

    async getBySlug(slug: string, locale?: string) {
        const [row, globalDiscount, soldCounts] = await Promise.all([
            this.prisma.product.findUnique({
                where: { slug },
                include: { category: { select: { id: true, name: true, nameTranslation: true, slug: true, thumbnail: true } } },
            }),
            this.getGlobalDiscount(),
            this.getSoldCounts(),
        ]);
        if (!row) {
            throw new NotFoundException({
                message: 'Không tìm thấy sản phẩm.',
                code: 'PRODUCT_NOT_FOUND',
            });
        }
        return withFinalPrice(applyLocale(applyGlobalDiscount(withSoldCount(normalizeProductRow(row), soldCounts), globalDiscount), locale));
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

function withFinalPrice<T extends { price: unknown; discountPercent: number }>(
    product: T,
): T & { finalPrice: number } {
    return {
        ...product,
        finalPrice: computeFinalPrice(product.price, product.discountPercent),
    };
}

/** Override `name` with the translation for the given locale (non-vi only). */
function applyLocale<
    T extends { name: string; nameTranslation: Record<string, string> },
>(product: T, locale: string | undefined): T {
    if (!locale || locale === 'vi') return product;
    const translated = product.nameTranslation?.[locale]?.trim();
    if (!translated) return product;
    return { ...product, name: translated };
}

function applyGlobalDiscount<T extends { discountPercent: number }>(
    product: T,
    globalDiscount: number,
): T {
    if (!globalDiscount) return product;
    // Product-specific discount takes priority; global is the fallback when product has none
    if (product.discountPercent > 0) return product;
    return { ...product, discountPercent: globalDiscount };
}

function normalizeProductRow<
    T extends {
        optionGroups: unknown;
        toppings: unknown;
        nameTranslation: unknown;
        descriptionTranslation: unknown;
    },
>(row: T) {
    return {
        ...row,
        optionGroups: normalizeInlineOptionGroups(row.optionGroups as any),
        toppings: normalizeInlineToppings(row.toppings as any),
        nameTranslation: (row.nameTranslation &&
            typeof row.nameTranslation === 'object'
            ? row.nameTranslation
            : {}) as Record<string, string>,
        descriptionTranslation: (row.descriptionTranslation &&
            typeof row.descriptionTranslation === 'object'
            ? row.descriptionTranslation
            : {}) as Record<string, string>,
    };
}
