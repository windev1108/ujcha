import { api } from "@/config/server";

import type {
  AdminTableQrPayload,
  AdminTableRow,
  AdminTableStats,
  CreateTableBody,
  UpdateTableBody,
} from "./types";

export async function fetchAdminTables(): Promise<AdminTableRow[]> {
  const { data } = await api.get<AdminTableRow[]>("/admin/tables");
  return data;
}

export async function fetchAdminTableStats(): Promise<AdminTableStats> {
  const { data } = await api.get<AdminTableStats>("/admin/tables/stats");
  return data;
}

export async function fetchAdminTable(id: string): Promise<AdminTableRow> {
  const { data } = await api.get<AdminTableRow>(`/admin/tables/${id}`);
  return data;
}

export async function fetchAdminTableQrPayload(
  id: string,
): Promise<AdminTableQrPayload> {
  const { data } = await api.get<AdminTableQrPayload>(
    `/admin/tables/${id}/qr`,
  );
  return data;
}

export async function createAdminTable(
  body: CreateTableBody,
): Promise<AdminTableRow> {
  const { data } = await api.post<AdminTableRow>("/admin/tables", body);
  return data;
}

export async function updateAdminTable(
  id: string,
  body: UpdateTableBody,
): Promise<AdminTableRow> {
  const { data } = await api.patch<AdminTableRow>(
    `/admin/tables/${id}`,
    body,
  );
  return data;
}

export async function regenerateAdminTableQr(
  id: string,
): Promise<AdminTableRow> {
  const { data } = await api.post<AdminTableRow>(
    `/admin/tables/${id}/regenerate-qr`,
  );
  return data;
}

export async function deactivateAdminTable(id: string): Promise<AdminTableRow> {
  const { data } = await api.patch<AdminTableRow>(
    `/admin/tables/${id}/deactivate`,
  );
  return data;
}

export async function deleteAdminTable(id: string): Promise<void> {
  await api.delete(`/admin/tables/${id}`);
}
