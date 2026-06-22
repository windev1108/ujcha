import { api } from "@/config/server";
import type { AdminFeedbackPage, AdminFeedbackStats } from "./types";

export async function fetchAdminFeedbacks(
  page = 1,
  pageSize = 20,
  rating?: number,
): Promise<AdminFeedbackPage> {
  const { data } = await api.get<AdminFeedbackPage>("/admin/feedback", {
    params: { page, pageSize, ...(rating != null ? { rating } : {}) },
  });
  return data;
}

export async function fetchAdminFeedbackStats(): Promise<AdminFeedbackStats> {
  const { data } = await api.get<AdminFeedbackStats>("/admin/feedback/stats");
  return data;
}

export async function deleteAdminFeedback(id: string): Promise<void> {
  await api.delete(`/admin/feedback/${id}`);
}

export async function togglePinFeedback(id: string): Promise<{ id: string; isPinned: boolean }> {
  const { data } = await api.post<{ id: string; isPinned: boolean }>(`/admin/feedback/${id}/pin`);
  return data;
}

export async function bulkPinFeedbacks(ids: string[], pin: boolean): Promise<{ updated: number }> {
  const { data } = await api.post<{ updated: number }>('/admin/feedback/bulk-pin', { ids, pin });
  return data;
}

export async function fetchGrabImportedIds(): Promise<string[]> {
  const { data } = await api.get<string[]>("/admin/feedback/grab-imported-ids");
  return data;
}

export type GrabReviewImportItem = {
  reviewID: string;
  content: string;
  rating: number;
  eaterName?: string;
  createdAt?: number;
  orderedItemNames?: string[];
};

export async function importGrabFeedbacks(
  reviews: GrabReviewImportItem[],
): Promise<{ imported: number; skipped: number; failed: number; errors: string[] }> {
  const { data } = await api.post<{
    imported: number;
    skipped: number;
    failed: number;
    errors: string[];
  }>("/admin/feedback/grab-import", { reviews });
  return data;
}
