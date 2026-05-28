import { api } from "@/config/server";
import type {
  AdminRow,
  AdminListResponse,
  AdminStats,
  CreateAdminBody,
  UpdateAdminBody,
  CustomerListResponse,
} from "./types";

export async function fetchAdmins(params?: {
  q?: string;
  role?: string;
  page?: number;
  pageSize?: number;
}): Promise<AdminListResponse> {
  const { data } = await api.get<AdminListResponse>("/admin/admins", {
    params: {
      ...(params?.q?.trim() ? { q: params.q.trim() } : {}),
      ...(params?.role ? { role: params.role } : {}),
      ...(params?.page ? { page: params.page } : {}),
      ...(params?.pageSize ? { pageSize: params.pageSize } : {}),
    },
  });
  return data;
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const { data } = await api.get<AdminStats>("/admin/admins/stats");
  return data;
}

export async function fetchAdminById(id: string): Promise<AdminRow> {
  const { data } = await api.get<AdminRow>(`/admin/admins/${id}`);
  return data;
}

export async function createAdmin(body: CreateAdminBody): Promise<AdminRow> {
  const { data } = await api.post<AdminRow>("/admin/admins", body);
  return data;
}

export async function updateAdmin(
  id: string,
  body: UpdateAdminBody,
): Promise<AdminRow> {
  const { data } = await api.patch<AdminRow>(`/admin/admins/${id}`, body);
  return data;
}

export async function deleteAdmin(id: string): Promise<void> {
  await api.delete(`/admin/admins/${id}`);
}

export async function fetchCustomers(params?: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<CustomerListResponse> {
  const { data } = await api.get<CustomerListResponse>(
    "/admin/users/customers",
    {
      params: {
        ...(params?.q?.trim() ? { q: params.q.trim() } : {}),
        ...(params?.page ? { page: params.page } : {}),
        ...(params?.pageSize ? { pageSize: params.pageSize } : {}),
      },
    },
  );
  return data;
}
