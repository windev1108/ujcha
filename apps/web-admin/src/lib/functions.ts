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


export function reconcile(draft: string[] | null, server: string[]): string[] {
    if (!draft) return server;
    const serverSet = new Set(server);
    const kept = draft.filter((id) => serverSet.has(id));
    const keptSet = new Set(kept);
    return [...kept, ...server.filter((id) => !keptSet.has(id))];
}

export function sameOrder(a: string[], b: string[]) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Ghép thứ tự mới của tập con (đang lọc) vào đúng các slot của danh sách đầy đủ. */
export function mergeSubsetOrder(full: string[], subsetNew: string[]): string[] {
    const subset = new Set(subsetNew);
    let i = 0;
    return full.map((id) => (subset.has(id) ? subsetNew[i++] : id));
}

export function parseCost(text: string): number | null | "invalid" {
    const t = text.trim().replace(",", ".");
    if (!t) return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0 || Math.round(n * 1e4) / 1e4 !== n) return "invalid";
    return n;
}

export function formatCost(v: string): string {
    return Number.parseFloat(v).toLocaleString("vi-VN", { maximumFractionDigits: 4 });
}