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
