"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { env } from "@/config/env";
import { useNotificationStore } from "@/store/notification-store";
import { notificationKeys } from "@/services/notification/hooks";
import type { AppNotification } from "@/services/notification/api";

export function useNotificationSocket(accessToken: string | null) {
  const { incrementUnread, pushNotification } = useNotificationStore();
  const qc = useQueryClient();

  useEffect(() => {
    if (!accessToken) return;

    const socket = io(`${env.API_URL}/notifications`, {
      query: { token: accessToken },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on("notification", (payload: AppNotification) => {
      pushNotification(payload);

      // Check if this is an upsert of an existing item or a brand-new notification.
      const prevList = qc.getQueryData<AppNotification[]>(notificationKeys.all);
      const prevItem = prevList?.find((n) => n.id === payload.id);

      qc.setQueryData<AppNotification[]>(notificationKeys.all, (prev) => {
        if (!prev) return [payload];
        const idx = prev.findIndex((n) => n.id === payload.id);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = payload;
          return updated;
        }
        return [payload, ...prev].slice(0, 20);
      });

      // Increment badge only for new notifications or when an existing one is reset to unread.
      if (!prevItem || prevItem.isRead) {
        incrementUnread();
        qc.setQueryData<number>(notificationKeys.unreadCount, (prev) => (prev ?? 0) + 1);
      }
    });

    socket.on(
      "broadcast_notification",
      (payload: Pick<AppNotification, "type" | "title" | "content">) => {
        incrementUnread();
        pushNotification(payload as AppNotification);
        // Refetch so each user gets their own DB record with correct id
        void qc.invalidateQueries({ queryKey: notificationKeys.all });
        qc.setQueryData<number>(notificationKeys.unreadCount, (prev) =>
          (prev ?? 0) + 1,
        );
      },
    );

    return () => {
      socket.disconnect();
    };
  }, [accessToken, incrementUnread, pushNotification, qc]);
}
