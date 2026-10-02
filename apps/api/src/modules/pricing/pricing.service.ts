import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import {
  buildPricingSnapshot,
  computeProductPricing,
  type IngredientCostInfo,
  type RecipeRowLike,
} from '../../helper/pricing-calc';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { PricingConfigService } from './pricing-config.service';

const LIST_CACHE_PATTERN = 'ujcha:products:list:*';
const CHUNK = 50;

export type RecomputeScope = { productIds?: string[]; categoryId?: string };

/** JSONB không giữ thứ tự key → so sánh bằng bản đã sắp xếp key. */
function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, x]) => [k, sortKeys(x)]),
    );
  }
  return v;
}
const canon = (v: unknown) =>
  JSON.stringify(sortKeys(JSON.parse(JSON.stringify(v ?? null))));
const decEq = (a: Prisma.Decimal | null, b: number | null) =>
  a === null || b === null ? a === null && b === null : a.equals(b);

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly pricingConfig: PricingConfigService,
  ) { }

  /** Dùng ở các hook: lỗi recompute không được làm hỏng thao tác chính (đã có cron đêm làm lưới an toàn). */
  async recomputeQuietly(scope: RecomputeScope = {}) {
    try {
      return await this.recompute(scope);
    } catch (e) {
      this.logger.error(
        `Recompute thất bại: ${e instanceof Error ? e.stack : e}`,
      );
      return null;
    }
  }

  async recompute(scope: RecomputeScope = {}) {
    if (scope.productIds && scope.productIds.length === 0) {
      return { scanned: 0, updated: 0 };
    }
    const config = await this.pricingConfig.get(true);
    const where: Prisma.ProductWhereInput = {
      ...(scope.productIds && { id: { in: scope.productIds } }),
      ...(scope.categoryId && { categoryId: scope.categoryId }),
    };
    const scoped = Object.keys(where).length > 0;
    let autoPriceChanged = false;

    // Công tắc tắt khẩn cấp: gỡ autoPrice bằng MỘT câu SQL trước, không phụ thuộc phần tính toán bên dưới.
    if (!config.isEnabled) {
      const r = await this.prisma.product.updateMany({
        where: { ...where, autoPrice: { not: null } },
        data: { autoPrice: null },
      });
      if (r.count > 0) autoPriceChanged = true;
    }

    const products = await this.prisma.product.findMany({
      where,
      select: {
        id: true,
        pricingMode: true,
        pricingMarginPercent: true,
        optionGroups: true,
        autoPrice: true,
        costPrice: true,
        pricingSnapshotJson: true,
        category: { select: { pricingMarginPercent: true } },
      },
    });

    const ids = products.map((p) => p.id);
    const [recipeRows, ingredientRows] = await Promise.all([
      this.prisma.productRecipeItem.findMany({
        where: scoped ? { productId: { in: ids } } : undefined,
        select: {
          productId: true,
          ingredientId: true,
          quantity: true,
          conditions: true,
        },
      }),
      this.prisma.ingredient.findMany({
        select: { id: true, name: true, costPerUnit: true },
      }),
    ]);

    const ingredients = new Map<string, IngredientCostInfo>(
      ingredientRows.map((i) => [
        i.id,
        { name: i.name, costPerUnit: i.costPerUnit },
      ]),
    );
    const rowsByProduct = new Map<string, RecipeRowLike[]>();
    for (const r of recipeRows) {
      const arr = rowsByProduct.get(r.productId) ?? [];
      arr.push(r);
      rowsByProduct.set(r.productId, arr);
    }

    const updates: Prisma.PrismaPromise<unknown>[] = [];
    for (const p of products) {
      const r = computeProductPricing({
        product: p,
        categoryMarginPercent: p.category.pricingMarginPercent,
        config,
        recipeRows: rowsByProduct.get(p.id) ?? [],
        ingredients,
      });
      const snapshot = buildPricingSnapshot(r);
      const autoSame = decEq(p.autoPrice, r.autoPrice);
      const costSame = decEq(p.costPrice, r.cost);
      const snapSame = canon(p.pricingSnapshotJson) === canon(snapshot);
      if (autoSame && costSame && snapSame) continue; // chỉ ghi khi có thay đổi
      if (!autoSame) autoPriceChanged = true;

      updates.push(
        this.prisma.product.update({
          where: { id: p.id },
          data: {
            autoPrice:
              r.autoPrice == null ? null : new Prisma.Decimal(r.autoPrice),
            costPrice: r.cost == null ? null : new Prisma.Decimal(r.cost),
            pricingSnapshotJson: snapshot as unknown as Prisma.InputJsonValue,
            pricingComputedAt: new Date(),
          },
          select: { id: true },
        }),
      );
    }

    for (let i = 0; i < updates.length; i += CHUNK) {
      await this.prisma.$transaction(updates.slice(i, i + CHUNK));
    }
    if (autoPriceChanged) await this.redis.delByPattern(LIST_CACHE_PATTERN);

    return { scanned: products.length, updated: updates.length };
  }

  /** Lưới an toàn nếu sót hook. */
  @Cron('0 3 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async recomputeNightly() {
    const r = await this.recomputeQuietly();
    if (r)
      this.logger.log(
        `Recompute đêm: quét ${r.scanned}, cập nhật ${r.updated}.`,
      );
  }
}
