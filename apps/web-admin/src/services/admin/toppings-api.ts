import { api } from "@/config/server";

import type { AdminTopping } from "./types";

export async function fetchAdminToppings(): Promise<AdminTopping[]> {
  const { data } = await api.get<AdminTopping[]>("/admin/toppings");
  return data;
}

export async function setAdminToppingOutOfStock(
  name: string,
  isOutOfStock: boolean,
): Promise<{ nameKey: string; isOutOfStock: boolean }> {
  const { data } = await api.post<{ nameKey: string; isOutOfStock: boolean }>(
    "/admin/toppings/out-of-stock",
    { name, isOutOfStock },
  );
  return data;
}