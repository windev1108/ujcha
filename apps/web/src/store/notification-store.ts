"use client";

import { create } from "zustand";
import type { AppNotification } from "@/services/notification/api";

interface NotificationState {
  unreadCount: number;
  setUnreadCount: (n: number) => void;
  incrementUnread: () => void;
  pushNotification: (n: AppNotification) => void;
  // Latest notification for toast display
  latest: AppNotification | null;
  clearLatest: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  latest: null,
  setUnreadCount: (n) => set({ unreadCount: n }),
  incrementUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
  pushNotification: (n) => set({ latest: n }),
  clearLatest: () => set({ latest: null }),
}));
