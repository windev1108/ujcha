import { api } from "@/config/server";

import type { AdminUserAddress, AdminUserSearchRow } from "./types";

export async function searchAdminUsers(
  q: string,
): Promise<AdminUserSearchRow[]> {
  const { data } = await api.get<AdminUserSearchRow[]>("/admin/users", {
    params: { q: q.trim() || undefined },
  });
  return data;
}

export async function fetchUserAddresses(
  userId: string,
): Promise<AdminUserAddress[]> {
  const { data } = await api.get<AdminUserAddress[]>(
    `/admin/users/${userId}/addresses`,
  );
  return data;
}
