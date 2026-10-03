// src/helper/topping-recipe.ts
import { Prisma } from '@prisma/client';
import { toppingNameKey } from './utils';

export type GlobalToppingRecipeMap = Map<
  string,
  { ingredientId: string; quantity: Prisma.Decimal }[]
>;

export async function loadGlobalToppingRecipes(
  db: Prisma.TransactionClient,
): Promise<GlobalToppingRecipeMap> {
  const rows = await db.globalToppingRecipeItem.findMany();
  const map: GlobalToppingRecipeMap = new Map();
  for (const r of rows) {
    const arr = map.get(r.nameKey) ?? [];
    arr.push({ ingredientId: r.ingredientId, quantity: r.quantity });
    map.set(r.nameKey, arr);
  }
  return map;
}

/** Ưu tiên dòng riêng của sản phẩm (override); không có thì dùng global theo tên. */
export function resolveToppingRecipeRows(
  toppingName: string,
  global: GlobalToppingRecipeMap,
): { ingredientId: string; quantity: Prisma.Decimal }[] {
  return global.get(toppingNameKey(toppingName)) ?? [];
}

export async function findProductIdsByToppingNameKeys(
  db: Prisma.TransactionClient,
  nameKeys: string[],
): Promise<string[]> {
  if (!nameKeys.length) return [];
  const keys = new Set(nameKeys);
  const products = await db.product.findMany({
    select: { id: true, toppings: true },
  });
  return products
    .filter((p) =>
      (Array.isArray(p.toppings) ? (p.toppings as any[]) : []).some((t) =>
        keys.has(toppingNameKey(String(t?.name ?? ''))),
      ),
    )
    .map((p) => p.id);
}