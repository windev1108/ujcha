import { api } from '@/services/api'
import type { AppNotification } from '@/types'

export async function fetchNotifications(): Promise<AppNotification[]> {
  const res = await api.get<AppNotification[]>('/notifications')
  return res.data
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await api.get<{ count: number }>('/notifications/unread-count')
  return res.data.count
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`)
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/notifications/read-all')
}

export async function deleteNotification(id: string): Promise<void> {
  await api.delete(`/notifications/${id}`)
}

export async function deleteAllNotifications(): Promise<void> {
  await api.delete('/notifications')
}
