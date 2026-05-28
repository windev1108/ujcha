import { api } from "@/config/server";

import type { ShopSettings } from "./types";

export async function fetchShopSettings(): Promise<ShopSettings> {
  const { data } = await api.get<ShopSettings>("/admin/shop-settings");
  return data;
}

export async function updateShopSettings(body: {
  globalDiscountPercent: number;
}): Promise<ShopSettings> {
  const { data } = await api.patch<ShopSettings>("/admin/shop-settings", body);
  return data;
}
