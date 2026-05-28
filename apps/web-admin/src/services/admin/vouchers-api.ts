import { api } from "@/config/server";

import type {
  AdminVoucher,
  AdminVoucherStats,
  CreateVoucherBody,
  UpdateVoucherBody,
} from "./types";

export async function fetchAdminVouchers(): Promise<AdminVoucher[]> {
  const { data } = await api.get<AdminVoucher[]>("/admin/vouchers");
  return data;
}

export async function fetchAdminVoucherStats(): Promise<AdminVoucherStats> {
  const { data } = await api.get<AdminVoucherStats>("/admin/vouchers/stats");
  return data;
}

export async function fetchAdminVoucher(id: string): Promise<AdminVoucher> {
  const { data } = await api.get<AdminVoucher>(`/admin/vouchers/${id}`);
  return data;
}

export async function createAdminVoucher(
  body: CreateVoucherBody,
): Promise<AdminVoucher> {
  const { data } = await api.post<AdminVoucher>("/admin/vouchers", body);
  return data;
}

export async function updateAdminVoucher(
  id: string,
  body: UpdateVoucherBody,
): Promise<AdminVoucher> {
  const { data } = await api.patch<AdminVoucher>(`/admin/vouchers/${id}`, body);
  return data;
}

export async function deleteAdminVoucher(id: string): Promise<void> {
  await api.delete(`/admin/vouchers/${id}`);
}
