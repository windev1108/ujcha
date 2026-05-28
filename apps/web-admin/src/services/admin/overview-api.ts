import { api } from "@/config/server";

import type { AdminOverviewDashboard } from "./types";

export async function fetchAdminOverview(): Promise<AdminOverviewDashboard> {
  const { data } = await api.get<AdminOverviewDashboard>("/admin/overview");
  return data;
}
