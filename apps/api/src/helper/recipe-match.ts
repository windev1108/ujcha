import { NormalizedOptionGroup } from './utils';

export type RecipeCondition = { group: string; value: string };

export function conditionsMatch(
  conditions: RecipeCondition[],
  selected: Record<string, string>,
): boolean {
  return conditions.every((c) => selected[c.group] === c.value);
}

export function pickReferenceValue(group: NormalizedOptionGroup) {
  return (
    group.values.find((v) => v.isDefault) ??
    group.values.reduce((min, v) => (v.priceDelta < min.priceDelta ? v : min))
  );
}

export function buildReferenceSelection(groups: NormalizedOptionGroup[]) {
  const selected: Record<string, string> = {};
  const sources: Record<string, 'default' | 'lowest_price'> = {};
  let delta = 0;
  for (const g of groups) {
    const v = pickReferenceValue(g);
    selected[g.name] = v.label;
    sources[g.name] = v.isDefault ? 'default' : 'lowest_price';
    delta += v.priceDelta;
  }
  return { selected, sources, delta };
}

/** Với mỗi nguyên liệu chọn dòng công thức khớp nhiều điều kiện nhất. Hoà điểm → giữ dòng đầu, đánh dấu mơ hồ. */
export function pickBestRecipeRows<
  T extends { ingredientId: string; conditions: unknown },
>(
  rows: T[],
  selected: Record<string, string>,
): { picked: Map<string, T>; ambiguousIngredientIds: string[] } {
  const best = new Map<string, { row: T; score: number }>();
  const ambiguous = new Set<string>();
  for (const r of rows) {
    const conditions = (r.conditions as RecipeCondition[] | null) ?? [];
    if (!conditionsMatch(conditions, selected)) continue;
    const score = conditions.length;
    const cur = best.get(r.ingredientId);
    if (!cur || score > cur.score) {
      best.set(r.ingredientId, { row: r, score });
      ambiguous.delete(r.ingredientId);
    } else if (score === cur.score) {
      ambiguous.add(r.ingredientId);
    }
  }
  return {
    picked: new Map([...best].map(([id, v]) => [id, v.row])),
    ambiguousIngredientIds: [...ambiguous],
  };
}
