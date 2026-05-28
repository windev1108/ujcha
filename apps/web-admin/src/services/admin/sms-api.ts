import { api } from "@/config/server";

export type SmsLogItem = {
  id: string;
  phone: string;
  message: string;
  textbeeId: string | null;
  status: string;
  error: string | null;
  createdAt: string;
};

export type SmsLogsResponse = {
  items: SmsLogItem[];
  total: number;
};

export async function fetchSmsLogs(params: {
  page?: number;
  limit?: number;
  phone?: string;
}): Promise<SmsLogsResponse> {
  const { data } = await api.get<SmsLogsResponse>("/admin/sms", { params });
  return data;
}
