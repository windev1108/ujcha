"use client";

import { create } from "zustand";
import type { AppNotification } from "@/services/notification/api";

interface NotificationState {
  unreadCount: number;
  setUnreadCount: (n: number) => void;
  incrementUnread: () => void;
  pushNotification: (n: AppNotification) => void;
  latest: AppNotification | null;
  toastSeq: number;
  clearLatest: () => void;
  bgCount: number;
  bgTitle: string;
  addBgNotif: (title: string) => void;
  resetBg: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  latest: null,
  toastSeq: 0,
  setUnreadCount: (n) => set({ unreadCount: n }),
  incrementUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
  pushNotification: (n) => set((s) => ({ latest: n, toastSeq: s.toastSeq + 1 })),
  clearLatest: () => set({ latest: null }),
  bgCount: 0,
  bgTitle: "",
  addBgNotif: (title) => set((s) => ({ bgCount: s.bgCount + 1, bgTitle: title })),
  resetBg: () => set({ bgCount: 0, bgTitle: "" }),
}));
