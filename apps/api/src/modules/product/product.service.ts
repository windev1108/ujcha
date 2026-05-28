import { Injectable, NotFoundException } from '@nestjs/common';
import {
    expandOptionGroupsWithMap,
    extractVariantGroupIds,
} from '../../helper/utils';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const PRODUCT_LIST_TTL = 300; // 5 minutes
const PRODUCT_LIST_KEY = (categoryId?: string, categorySlug?: string, q?: string) =>
    `kun:products:list:${categoryId ?? ''}:${categorySlug ?? ''}:${q ?? ''}`;

@Injectable()
export class ProductService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
    ) { }

    // ── helpers ──────────────────────────────────────────────────────────

    private async buildVgMap(rows: { optionGroups: unknown }[]) {
        const allIds = new Set<string>();
        for (const row of rows) {
            for (const id of extractVariantGroupIds(row.optionGroups)) allIds.add(id);
        }
        const vgMap = new Map<string, { id: string; name: string; values: unknown }>();
        if (allIds.size > 0) {
            const vgs = await this.prisma.variantGroup.findMany({
                where: { id: { in: [...allIds] } },
            });
            for (const vg of vgs) vgMap.set(vg.id, vg);
        }
        return vgMap;
    }

    private async expandRows<T extends { optionGroups: unknown }>(rows: T[]): Promise<(T & { optionGroups: { id: string; name: string; values: { label: string; priceDelta: number }[] }[] })[]> {
        const vgMap = await this.buildVgMap(rows);
        return rows.map((row) => ({
            ...row,
            optionGroups: expandOptionGroupsWithMap(row.optionGroups, vgMap),
        }));
    }

    private async expandRow<T extends { optionGroups: unknown }>(row: T) {
        const [result] = await this.expandRows([row]);
        return result!;
    }

    // ── public methods ────────────────────────────────────────────────────

    async list(categoryId?: string, categorySlug?: string, q?: string) {
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
            include: { category: { select: { id: true, name: true, slug: true, thumbnail: true } } },
        });
        const result = await this.expandRows(rows);
        await this.redis.set(cacheKey, result, PRODUCT_LIST_TTL);
        return result;
    }

    async invalidateListCache() {
        await this.redis.delByPattern('kun:products:list:*');
    }

    async getById(id: string) {
        const row = await this.prisma.product.findUnique({
            where: { id },
            include: { category: { select: { id: true, name: true, slug: true, thumbnail: true } } },
        });
        if (!row) {
            throw new NotFoundException({
                message: 'Không tìm thấy sản phẩm.',
                code: 'PRODUCT_NOT_FOUND',
            });
        }
        return this.expandRow(row);
    }

    async getBySlug(slug: string) {
        const row = await this.prisma.product.findUnique({
            where: { slug },
            include: { category: { select: { id: true, name: true, slug: true, thumbnail: true } } },
        });
        if (!row) {
            throw new NotFoundException({
                message: 'Không tìm thấy sản phẩm.',
                code: 'PRODUCT_NOT_FOUND',
            });
        }
        return this.expandRow(row);
    }
}
