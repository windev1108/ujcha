import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { normalizeInlineOptionGroups } from '../../helper/utils';
import {
  buildReferenceSelection,
  pickBestRecipeRows,
} from '../../helper/recipe-match';
import { PrismaService } from '../prisma/prisma.service';
import { PricingConfigService } from './pricing-config.service';
import { computeCostAndPrice } from '../../helper/pricing-calc';
import {
  loadGlobalToppingRecipes,
  resolveToppingRecipeRows,
} from '../../helper/topping-recipe';

type IngredientInfo = { name: string; costPerUnit: Prisma.Decimal | null };
type RecipeRow = {
  productId: string;
  ingredientId: string;
  quantity: Prisma.Decimal;
  conditions: Prisma.JsonValue;
};
export type CostStatus =
  | 'ok'
  | 'no_recipe'
  | 'missing_cost'
  | 'zero_cost'
  | 'too_many_combos';

@Injectable()
export class PricingCostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingConfig: PricingConfigService,
  ) {}

  async preview(params: {
    productId?: string;
    categoryId?: string;
    categorySlug?: string;
    marginPercent?: number;
  }) {
    const { productId, categoryId, categorySlug, marginPercent } = params;
    const products = await this.prisma.product.findMany({
      where: productId
        ? { id: productId }
        : categoryId
          ? { categoryId }
          : categorySlug
            ? { category: { slug: categorySlug } }
            : {},
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        isAvailable: true,
        optionGroups: true,
        category: { select: { slug: true } },
      },
      orderBy: { name: 'asc' },
    });

    const ids = products.map((p) => p.id);
    const [recipeRows, ingredientRows] = await Promise.all([
      this.prisma.productRecipeItem.findMany({
        where: { productId: { in: ids } },
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

    const ingredients = new Map<string, IngredientInfo>(
      ingredientRows.map((i) => [
        i.id,
        { name: i.name, costPerUnit: i.costPerUnit },
      ]),
    );
    const rowsByProduct = new Map<string, RecipeRow[]>();
    for (const r of recipeRows) {
      const arr = rowsByProduct.get(r.productId) ?? [];
      arr.push(r);
      rowsByProduct.set(r.productId, arr);
    }

    const { roundingStep } = await this.pricingConfig.get(true);
    const items = products.map((p) =>
      this.analyze(
        p,
        rowsByProduct.get(p.id) ?? [],
        ingredients,
        marginPercent,
        roundingStep,
      ),
    );
    const summary = items.reduce<Record<string, number>>(
      (acc, it) => ({ ...acc, [it.status]: (acc[it.status] ?? 0) + 1 }),
      { total: items.length },
    );
    return { marginPercent: marginPercent ?? null, summary, items };
  }

  private analyze(
    product: {
      id: string;
      name: string;
      sku: string | null;
      price: Prisma.Decimal;
      isAvailable: boolean;
      optionGroups: Prisma.JsonValue;
      category: { slug: string };
    },
    rows: RecipeRow[],
    ingredients: Map<string, IngredientInfo>,
    marginPercent: number | undefined,
    roundingStep: number,
  ) {
    const fixedPrice = Number(product.price.toString());
    const calc = computeCostAndPrice({
      optionGroups: product.optionGroups,
      recipeRows: rows,
      ingredients,
      marginPercent: marginPercent ?? null,
      roundingStep,
    });

    const base = {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      category: product.category.slug,
      isAvailable: product.isAvailable,
      fixedPrice,
      referenceVariant: calc.refVariant,
      referenceSource: calc.refSource,
    };

    if (calc.status === 'no_recipe')
      return { ...base, status: 'no_recipe' as CostStatus };
    if (calc.status === 'missing_cost') {
      return {
        ...base,
        status: 'missing_cost' as CostStatus,
        missingIngredients: calc.missingIngredients,
      };
    }
    if (calc.status === 'zero_cost')
      return { ...base, status: 'zero_cost' as CostStatus };

    const costN = calc.cost;
    const listPrice = fixedPrice + calc.refDelta;
    const previewPrice = calc.refPrice; // null khi không truyền biên
    return {
      ...base,
      status: 'ok' as CostStatus,
      cost: costN,
      fixedPriceOfReference: listPrice,
      // Biên lợi nhuận gộp thực tế trên giá niêm yết (cùng định nghĩa với dashboard doanh thu).
      actualMarginPercent:
        listPrice > 0 ? Math.round((1 - costN / listPrice) * 1000) / 10 : null,
      foodCostPercent:
        listPrice > 0 ? Math.round((costN / listPrice) * 1000) / 10 : null,
      previewPrice,
      priceDiff: previewPrice === null ? null : previewPrice - listPrice,
      warnings: calc.warnings,
    };
  }
  async estimateLineCosts(
    lines: CostLineInput[],
  ): Promise<Map<string, LineCost>> {
    const out = new Map<string, LineCost>();
    if (lines.length === 0) return out;

    const productIds = [...new Set(lines.map((l) => l.productId))];
    const [
      recipeRows,
      toppingRows,
      ingredientRows,
      globalToppingRecipes,
      products,
    ] = await Promise.all([
      this.prisma.productRecipeItem.findMany({
        where: { productId: { in: productIds } },
        select: {
          productId: true,
          ingredientId: true,
          quantity: true,
          conditions: true,
        },
      }),
      this.prisma.productToppingRecipeItem.findMany({
        where: { productId: { in: productIds } },
        select: {
          productId: true,
          toppingId: true,
          ingredientId: true,
          quantity: true,
        },
      }),
      this.prisma.ingredient.findMany({
        select: { id: true, costPerUnit: true },
      }),
      loadGlobalToppingRecipes(this.prisma),
      this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, toppings: true },
      }),
    ]);
    const toppingNameOf = new Map<string, string>(); // `${productId}|${toppingId}` -> name
    for (const p of products) {
      const arr = Array.isArray(p.toppings) ? (p.toppings as any[]) : [];
      for (const t of arr) {
        toppingNameOf.set(`${p.id}|${t.id}`, String(t?.name ?? ''));
      }
    }
    const unitCostOf = new Map(
      ingredientRows.map((i) => [i.id, i.costPerUnit]),
    );
    const recipesByProduct = new Map<string, RecipeRow[]>();
    for (const r of recipeRows) {
      const arr = recipesByProduct.get(r.productId) ?? [];
      arr.push(r);
      recipesByProduct.set(r.productId, arr);
    }
    const toppingsByKey = new Map<string, typeof toppingRows>();
    for (const t of toppingRows) {
      const k = `${t.productId}|${t.toppingId}`;
      const arr = toppingsByKey.get(k) ?? [];
      arr.push(t);
      toppingsByKey.set(k, arr);
    }

    for (const l of lines) {
      const key = lineCostKey(l);
      if (out.has(key)) continue;

      const rows = recipesByProduct.get(l.productId) ?? [];
      // Công thức có điều kiện mà đơn không có tuỳ chọn (vd đơn Grab) → không xác định được.
      const hasConditional = rows.some(
        (r) => Array.isArray(r.conditions) && r.conditions.length > 0,
      );
      if (hasConditional && Object.keys(l.options).length === 0) {
        out.set(key, { ok: false, reason: 'missing_options' });
        continue;
      }

      const { picked } = pickBestRecipeRows(rows, l.options);
      if (picked.size === 0) {
        out.set(key, { ok: false, reason: 'no_recipe' });
        continue;
      }

      const state = { cost: new Prisma.Decimal(0), missing: false };
      const add = (ingredientId: string, qty: Prisma.Decimal) => {
        const c = unitCostOf.get(ingredientId);
        if (c == null) {
          state.missing = true;
          return;
        }
        state.cost = state.cost.add(qty.mul(c));
      };

      for (const [ingredientId, row] of picked) add(ingredientId, row.quantity);

      let toppingNoRecipe = false;
      for (const toppingId of l.toppingIds) {
        const trs = resolveToppingRecipeRows(
          toppingNameOf.get(`${l.productId}|${toppingId}`) ?? '',
          globalToppingRecipes,
        );
        if (trs.length === 0) {
          toppingNoRecipe = true;
          continue;
        }
        for (const t of trs) add(t.ingredientId, t.quantity);
      }

      if (state.missing || state.cost.lte(0)) {
        out.set(key, { ok: false, reason: 'missing_cost' });
      } else if (toppingNoRecipe) {
        out.set(key, { ok: false, reason: 'topping_no_recipe' });
      } else {
        out.set(key, { ok: true, unitCost: state.cost.toNumber() });
      }
    }
    return out;
  }
}

export type LineCostReason =
  | 'no_recipe'
  | 'missing_options'
  | 'missing_cost'
  | 'topping_no_recipe';
export type LineCost =
  | { ok: true; unitCost: number }
  | { ok: false; reason: LineCostReason };
export type CostLineInput = {
  productId: string;
  options: Record<string, string>;
  toppingIds: string[];
};

export function lineCostKey(l: CostLineInput): string {
  const opts = Object.entries(l.options).sort(([a], [b]) => a.localeCompare(b));
  return `${l.productId}|${JSON.stringify(opts)}|${[...l.toppingIds].sort().join(',')}`;
}
