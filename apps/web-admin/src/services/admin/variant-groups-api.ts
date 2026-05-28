import { api } from "@/config/server";

import type {
  CreateVariantGroupBody,
  UpdateVariantGroupBody,
  VariantGroup,
} from "./types";

export async function fetchVariantGroups(): Promise<VariantGroup[]> {
  const { data } = await api.get<VariantGroup[]>("/admin/variant-groups");
  return data;
}

export async function fetchVariantGroup(id: string): Promise<VariantGroup> {
  const { data } = await api.get<VariantGroup>(`/admin/variant-groups/${id}`);
  return data;
}

export async function createVariantGroup(
  body: CreateVariantGroupBody,
): Promise<VariantGroup> {
  const { data } = await api.post<VariantGroup>("/admin/variant-groups", body);
  return data;
}

export async function updateVariantGroup(
  id: string,
  body: UpdateVariantGroupBody,
): Promise<VariantGroup> {
  const { data } = await api.patch<VariantGroup>(
    `/admin/variant-groups/${id}`,
    body,
  );
  return data;
}

export async function deleteVariantGroup(id: string): Promise<void> {
  await api.delete(`/admin/variant-groups/${id}`);
}
