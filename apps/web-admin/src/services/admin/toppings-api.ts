import { api } from "@/config/server";

import type { AdminTopping } from "./types";

export async function fetchAdminToppings(
  activeOnly?: boolean,
): Promise<AdminTopping[]> {
  const { data } = await api.get<AdminTopping[]>("/admin/toppings", {
    params: activeOnly === true ? { activeOnly: "true" } : {},
  });
  return data;
}

export type CreateAdminToppingBody = {
  name: string;
  price: number;
  sortOrder?: number;
  isActive?: boolean;
};

export type UpdateAdminToppingBody = Partial<CreateAdminToppingBody>;

export async function createAdminTopping(
  body: CreateAdminToppingBody,
): Promise<AdminTopping> {
  const { data } = await api.post<AdminTopping>("/admin/toppings", body);
  return data;
}

export async function updateAdminTopping(
  id: string,
  body: UpdateAdminToppingBody,
): Promise<AdminTopping> {
  const { data } = await api.patch<AdminTopping>(
    `/admin/toppings/${id}`,
    body,
  );
  return data;
}

export async function deleteAdminTopping(id: string): Promise<void> {
  await api.delete(`/admin/toppings/${id}`);
}
