import { create } from 'zustand'
import type { AppNotification } from '@/types'

interface NotificationState {
  unreadCount: number
  latest: AppNotification | null
  toastSeq: number

  setUnreadCount: (n: number) => void
  incrementUnread: () => void
  pushNotification: (n: AppNotification) => void
  clearLatest: () => void
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  unreadCount: 0,
  latest: null,
  toastSeq: 0,

  setUnreadCount: (n) => set({ unreadCount: n }),
  incrementUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
  pushNotification: (n) =>
    set((s) => ({ latest: n, toastSeq: s.toastSeq + 1, unreadCount: s.unreadCount + 1 })),
  clearLatest: () => set({ latest: null }),
}))
