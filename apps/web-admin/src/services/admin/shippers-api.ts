import { api } from "@/config/server";

import type { AdminShipper, AdminShipperStats } from "./types";

export async function fetchAdminShippers(
  activeOnly?: boolean,
): Promise<AdminShipper[]> {
  const { data } = await api.get<AdminShipper[]>("/admin/shippers", {
    params: activeOnly === true ? { activeOnly: "true" } : {},
  });
  return data;
}

export async function fetchAdminShipperStats(): Promise<AdminShipperStats> {
  const { data } = await api.get<AdminShipperStats>("/admin/shippers/stats");
  return data;
}

export async function createAdminShipper(body: {
  name: string;
  phone?: string;
}): Promise<AdminShipper> {
  const { data } = await api.post<AdminShipper>("/admin/shippers", body);
  return data;
}

export async function updateAdminShipper(
  id: string,
  body: { name?: string; phone?: string },
): Promise<AdminShipper> {
  const { data } = await api.patch<AdminShipper>(`/admin/shippers/${id}`, body);
  return data;
}

export async function createAdminShipperFromStaff(
  adminId: string,
): Promise<AdminShipper> {
  const { data } = await api.post<AdminShipper>("/admin/shippers/from-staff", { adminId });
  return data;
}

export async function toggleAdminShipperAvailability(
  id: string,
  isActive: boolean,
): Promise<AdminShipper> {
  const { data } = await api.patch<AdminShipper>(
    `/admin/shippers/${id}/availability`,
    { isActive },
  );
  return data;
}
