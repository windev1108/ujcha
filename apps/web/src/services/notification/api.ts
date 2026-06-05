import { api } from "@/config/server";

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  content: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

export async function fetchNotifications(): Promise<AppNotification[]> {
  const { data } = await api.get<AppNotification[]>("/notifications");
  return data;
}

export async function fetchUnreadCount(): Promise<number> {
  const { data } = await api.get<{ count: number }>("/notifications/unread-count");
  return data.count;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post("/notifications/read-all");
}

export async function deleteNotification(id: string): Promise<void> {
  await api.delete(`/notifications/${id}`);
}

export async function deleteAllNotifications(): Promise<void> {
  await api.delete("/notifications");
}
