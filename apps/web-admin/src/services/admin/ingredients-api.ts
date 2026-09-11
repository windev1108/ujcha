import { api } from "@/config/server";

import type { Ingredient, InventoryTransaction } from "./types";

export async function fetchAdminIngredients(q?: string): Promise<Ingredient[]> {
  const { data } = await api.get<Ingredient[]>("/admin/ingredients", {
    params: q?.trim() ? { q: q.trim() } : {},
  });
  return data;
}

export async function fetchAdminIngredient(id: string): Promise<Ingredient> {
  const { data } = await api.get<Ingredient>(`/admin/ingredients/${id}`);
  return data;
}

export type CreateIngredientBody = {
  name: string;
  unit: string;
  stockQty?: number;
  lowStockThreshold?: number;
  note?: string;
};

export type UpdateIngredientBody = Partial<CreateIngredientBody> & {
  isActive?: boolean;
};

export async function createAdminIngredient(
  body: CreateIngredientBody,
): Promise<Ingredient> {
  const { data } = await api.post<Ingredient>("/admin/ingredients", body);
  return data;
}

export async function updateAdminIngredient(
  id: string,
  body: UpdateIngredientBody,
): Promise<Ingredient> {
  const { data } = await api.patch<Ingredient>(`/admin/ingredients/${id}`, body);
  return data;
}

export async function adjustAdminIngredientStock(
  id: string,
  changeQty: number,
  note?: string,
): Promise<Ingredient> {
  const { data } = await api.patch<Ingredient>(`/admin/ingredients/${id}/stock`, {
    changeQty,
    note,
  });
  return data;
}

export async function deleteAdminIngredient(id: string): Promise<void> {
  await api.delete(`/admin/ingredients/${id}`);
}

export async function fetchAdminIngredientHistory(
  id: string,
): Promise<InventoryTransaction[]> {
  const { data } = await api.get<InventoryTransaction[]>(
    `/admin/ingredients/${id}/history`,
  );
  return data;
}