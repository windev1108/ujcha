import { api } from "@/config/server";

import type { AdminProduct, CreateProductBody, UpdateProductBody } from "./types";

export async function fetchAdminProducts(params?: {
  categoryId?: string;
  q?: string;
}): Promise<AdminProduct[]> {
  const { data } = await api.get<AdminProduct[]>("/admin/products", {
    params: {
      ...(params?.categoryId ? { categoryId: params.categoryId } : {}),
      ...(params?.q?.trim() ? { q: params.q.trim() } : {}),
    },
  });
  return data;
}

export async function fetchAdminProduct(id: string): Promise<AdminProduct> {
  const { data } = await api.get<AdminProduct>(`/admin/products/${id}`);
  return data;
}

export async function createAdminProduct(
  body: CreateProductBody,
): Promise<AdminProduct> {
  const { data } = await api.post<AdminProduct>("/admin/products", body);
  return data;
}

export async function updateAdminProduct(
  id: string,
  body: UpdateProductBody,
): Promise<AdminProduct> {
  const { data } = await api.patch<AdminProduct>(`/admin/products/${id}`, body);
  return data;
}

export async function deleteAdminProduct(id: string): Promise<void> {
  await api.delete(`/admin/products/${id}`);
}
