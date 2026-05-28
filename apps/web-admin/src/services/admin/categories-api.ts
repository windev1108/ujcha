import { api } from "@/config/server";

import type {
  AdminCategory,
  CreateCategoryBody,
  UpdateCategoryBody,
} from "./types";

export async function fetchAdminCategories(): Promise<AdminCategory[]> {
  const { data } = await api.get<AdminCategory[]>("/admin/categories");
  return data;
}

export async function fetchAdminCategory(id: string): Promise<AdminCategory> {
  const { data } = await api.get<AdminCategory>(`/admin/categories/${id}`);
  return data;
}

export async function createAdminCategory(
  body: CreateCategoryBody,
): Promise<AdminCategory> {
  const { data } = await api.post<AdminCategory>("/admin/categories", body);
  return data;
}

export async function updateAdminCategory(
  id: string,
  body: UpdateCategoryBody,
): Promise<AdminCategory> {
  const { data } = await api.patch<AdminCategory>(
    `/admin/categories/${id}`,
    body,
  );
  return data;
}

export async function deleteAdminCategory(id: string): Promise<void> {
  await api.delete(`/admin/categories/${id}`);
}
