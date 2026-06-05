import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  deleteNotification,
  deleteAllNotifications,
  type AppNotification,
} from "./api";
import { useNotificationStore } from "@/store/notification-store";

export const notificationKeys = {
  all: ["notifications"] as const,
  unreadCount: ["notifications", "unread-count"] as const,
};

export function useNotificationsQuery(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: fetchNotifications,
    enabled,
    staleTime: 30_000,
  });
}

export function useUnreadCountQuery(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: fetchUnreadCount,
    enabled,
    staleTime: 30_000,
  });
}

export function useMarkReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onMutate: (id) => {
      // Flip isRead immediately so the IntersectionObserver in NotificationItem
      // sees isRead=true and stops watching — prevents the refetch cascade.
      qc.setQueryData<AppNotification[]>(notificationKeys.all, (prev) =>
        prev ? prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)) : prev,
      );
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.unreadCount });
    },
  });
}

export function useMarkAllReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all });
      qc.invalidateQueries({ queryKey: notificationKeys.unreadCount });
    },
  });
}

export function useDeleteNotificationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteNotification,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: notificationKeys.all });
      const prev = qc.getQueryData<AppNotification[]>(notificationKeys.all);
      qc.setQueryData<AppNotification[]>(notificationKeys.all, (old) =>
        old ? old.filter((n) => n.id !== id) : [],
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(notificationKeys.all, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.unreadCount });
    },
  });
}

export function useDeleteAllNotificationsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteAllNotifications,
    onSuccess: () => {
      qc.setQueryData(notificationKeys.all, []);
      qc.setQueryData(notificationKeys.unreadCount, 0);
      useNotificationStore.getState().setUnreadCount(0);
    },
  });
}

