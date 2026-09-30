import { Prisma } from '@prisma/client';
import { normalizeInlineOptionGroups } from './utils';
import { buildReferenceSelection, pickBestRecipeRows } from './recipe-match';

export const DEFAULT_ROUNDING_STEP = 1000;

export type RecipeRowLike = {
  ingredientId: string;
  quantity: Prisma.Decimal;
  conditions: Prisma.JsonValue;
};
export type IngredientCostInfo = {
  name: string;
  costPerUnit: Prisma.Decimal | null;
};
export type PricingConfigLite = {
  isEnabled: boolean;
  defaultMarkupPercent: number | null;
  roundingStep: number;
};
export type MarkupSource = 'product' | 'category' | 'global' | 'fixed';
export type PricingStatus =
  | 'ok'
  | 'fixed'
  | 'no_recipe'
  | 'missing_cost'
  | 'zero_cost'
  | 'baseline_non_positive';

const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : null;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

/** cost × (1 + markup/100), làm tròn LÊN theo step. Dùng Decimal để không lệch số. */
export function priceFromCost(
  cost: Prisma.Decimal,
  markupPercent: number,
  step = DEFAULT_ROUNDING_STEP,
): number {
  const s = step > 0 ? step : DEFAULT_ROUNDING_STEP;
  return cost
    .mul(new Prisma.Decimal(markupPercent).div(100).add(1))
    .div(s)
    .ceil()
    .mul(s)
    .toNumber();
}

export function resolveMarkup(
  product: { pricingMode: string; pricingMarkupPercent: unknown },
  categoryMarkupPercent: unknown,
  config: PricingConfigLite,
): { markupPercent: number | null; source: MarkupSource } {
  if (!config.isEnabled || product.pricingMode === 'fixed') {
    return { markupPercent: null, source: 'fixed' };
  }
  const p = num(product.pricingMarkupPercent);
  if (p != null) return { markupPercent: p, source: 'product' };
  const c = num(categoryMarkupPercent);
  if (c != null) return { markupPercent: c, source: 'category' };
  if (config.defaultMarkupPercent != null) {
    return { markupPercent: config.defaultMarkupPercent, source: 'global' };
  }
  return { markupPercent: null, source: 'fixed' };
}

/** Tầng lõi: cost + giá của biến thể mốc. Khớp CHÍNH XÁC như trừ kho. */
export function computeCostAndPrice(input: {
  optionGroups: unknown;
  recipeRows: RecipeRowLike[];
  ingredients: Map<string, IngredientCostInfo>;
  markupPercent: number | null;
  roundingStep?: number;
}) {
  const ref = buildReferenceSelection(
    normalizeInlineOptionGroups(input.optionGroups),
  );
  const { picked, ambiguousIngredientIds } = pickBestRecipeRows(
    input.recipeRows,
    ref.selected,
  );

  const warnings: string[] = [];
  if (ambiguousIngredientIds.length) {
    const names = ambiguousIngredientIds.map(
      (id) => input.ingredients.get(id)?.name ?? id,
    );
    warnings.push(
      `Công thức mơ hồ (nhiều dòng cùng mức điều kiện) ở: ${names.join(', ')}.`,
    );
  }

  const base = {
    refVariant: ref.selected,
    refSource: ref.sources,
    refDelta: ref.delta,
    ambiguousIngredientIds,
    warnings,
  };
  const none = {
    cost: null as number | null,
    refPrice: null as number | null,
    autoPrice: null as number | null,
  };

  if (picked.size === 0) {
    return {
      ...base,
      ...none,
      status: 'no_recipe' as const,
      missingIngredients: [] as string[],
    };
  }

  let cost = new Prisma.Decimal(0);
  const missing: string[] = [];
  for (const [ingredientId, row] of picked) {
    const ing = input.ingredients.get(ingredientId);
    if (!ing || ing.costPerUnit == null) {
      missing.push(ing?.name ?? ingredientId);
      continue;
    }
    cost = cost.add(row.quantity.mul(ing.costPerUnit));
  }
  // Thiếu dù chỉ một nguyên liệu → không tính (tránh cost thấp giả).
  if (missing.length) {
    return {
      ...base,
      ...none,
      status: 'missing_cost' as const,
      missingIngredients: missing,
    };
  }
  if (cost.lte(0)) {
    return {
      ...base,
      ...none,
      status: 'zero_cost' as const,
      missingIngredients: [] as string[],
    };
  }

  let refPrice: number | null = null;
  let autoPrice: number | null = null;
  if (input.markupPercent != null) {
    refPrice = priceFromCost(cost, input.markupPercent, input.roundingStep);
    autoPrice = refPrice - ref.delta; // BASELINE: giá khi mọi phụ phí = 0
    if (autoPrice <= 0) {
      warnings.push(
        'BASELINE_NON_POSITIVE: giá cơ bản sau khi trừ phụ phí mặc định ≤ 0.',
      );
    }
  }
  return {
    ...base,
    status: 'ok' as const,
    cost: round2(cost.toNumber()),
    refPrice,
    autoPrice,
    missingIngredients: [] as string[],
  };
}

/** Tầng recompute: áp quy tắc bật/tắt + markup 3 cấp. */
export function computeProductPricing(input: {
  product: {
    pricingMode: string;
    pricingMarkupPercent: unknown;
    optionGroups: unknown;
  };
  categoryMarkupPercent: unknown;
  config: PricingConfigLite;
  recipeRows: RecipeRowLike[];
  ingredients: Map<string, IngredientCostInfo>;
}) {
  const { markupPercent, source } = resolveMarkup(
    input.product,
    input.categoryMarkupPercent,
    input.config,
  );
  const calc = computeCostAndPrice({
    optionGroups: input.product.optionGroups,
    recipeRows: input.recipeRows,
    ingredients: input.ingredients,
    markupPercent,
    roundingStep: input.config.roundingStep,
  });

  let status: PricingStatus = calc.status;
  let autoPrice: number | null = null;
  if (markupPercent == null) {
    status = 'fixed'; // vẫn giữ cost để lưu costPrice nếu tính được
  } else if (calc.status === 'ok') {
    if (calc.autoPrice! <= 0) status = 'baseline_non_positive';
    else autoPrice = calc.autoPrice;
  }
  return { ...calc, status, source, markupPercent, autoPrice };
}
export type PricingResult = ReturnType<typeof computeProductPricing>;

/** Không chứa computedAt để so sánh "có đổi không" ở recompute (dùng cột pricingComputedAt). */
export function buildPricingSnapshot(r: PricingResult) {
  return {
    source: r.source,
    markupPercent: r.markupPercent,
    refVariant: r.refVariant,
    refSource: r.refSource,
    refDelta: r.refDelta,
    cost: r.cost,
    refPrice: r.refPrice,
    status: r.status,
    warnings: r.warnings,
  };
}

export function buildPricingView(row: {
  price: unknown;
  pricingMode: string;
  autoPrice: unknown;
  costPrice: unknown;
  pricingSnapshotJson: unknown;
  pricingComputedAt: Date | null;
}) {
  const snap =
    row.pricingSnapshotJson &&
    typeof row.pricingSnapshotJson === 'object' &&
    !Array.isArray(row.pricingSnapshotJson)
      ? (row.pricingSnapshotJson as Record<string, unknown>)
      : null;
  const price = num(row.price) ?? 0;
  const autoPrice = num(row.autoPrice);
  const costPrice = num(row.costPrice);
  const effectiveBasePrice =
    row.pricingMode !== 'fixed' && autoPrice != null ? autoPrice : price;
  const listPrice = effectiveBasePrice + (num(snap?.refDelta) ?? 0); // giá của biến thể mốc
  return {
    mode: row.pricingMode,
    source: (snap?.source as MarkupSource | undefined) ?? 'fixed',
    markupPercent: num(snap?.markupPercent),
    costPrice,
    autoPrice,
    effectiveBasePrice,
    actualMarkupPercent:
      costPrice && costPrice > 0
        ? Math.round((listPrice / costPrice - 1) * 1000) / 10
        : null,
    status:
      (snap?.status as PricingStatus | undefined) ?? ('not_computed' as const),
    warnings: Array.isArray(snap?.warnings) ? (snap!.warnings as string[]) : [],
    computedAt: row.pricingComputedAt,
  };
}
