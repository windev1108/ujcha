import { RecipeCondition, RecipeGroupForm } from "@/services/admin/types";

export function buildScopeKey(conditions: RecipeCondition[]): string {
    if (conditions.length === 0) return "ALL";
    return [...conditions]
        .sort((a, b) => a.group.localeCompare(b.group))
        .map((c) => `${c.group}::${c.value}`)
        .join("|");
}

/// Từ dữ liệu phẳng API trả về → gom thành nhóm theo scopeKey giống nhau
export function groupsFromFlatItems(items: { ingredientId: string; quantity: string | number; conditions: RecipeCondition[] }[]): RecipeGroupForm[] {
    const map = new Map<string, RecipeGroupForm>();
    for (const it of items) {
        const conditions = it.conditions ?? [];
        const key = buildScopeKey(conditions);
        let g = map.get(key);
        if (!g) {
            g = { localId: crypto.randomUUID(), conditions, ingredients: [] };
            map.set(key, g);
        }
        g.ingredients.push({ ingredientId: it.ingredientId, quantity: Number(it.quantity) || 0 });
    }
    return [...map.values()];
}

/// Ngược lại: từ nhóm → mảng phẳng để gửi API
export function flattenGroups(groups: RecipeGroupForm[]) {
    return groups.flatMap((g) =>
        g.ingredients.map((ing) => ({
            ingredientId: ing.ingredientId,
            quantity: ing.quantity,
            conditions: g.conditions,
        })),
    );
}