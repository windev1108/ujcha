import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  deleteNotification,
} from '@/services/notification/api'
import { QK } from '@/constants/query-keys'
import { useNotificationStore } from '@/store/notification-store'
import { formatDate } from '@/lib/format'
import type { AppNotification } from '@/types'

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { setUnreadCount } = useNotificationStore()

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: QK.notifications,
    queryFn: fetchNotifications,
  })

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.notifications })
      setUnreadCount(0)
    },
  })

  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QK.notifications }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QK.notifications }),
  })

  const unreadCount = notifications.filter((n) => !n.isRead).length

  function renderItem({ item }: { item: AppNotification }) {
    return (
      <TouchableOpacity
        onPress={() => !item.isRead && readMutation.mutate(item.id)}
        className={`flex-row px-4 py-4 border-b border-black/5 ${item.isRead ? 'bg-white' : 'bg-primary/5'}`}
      >
        <View className={`w-9 h-9 rounded-full items-center justify-center mr-3 mt-0.5 ${item.isRead ? 'bg-surface-card' : 'bg-primary/10'}`}>
          <Ionicons name="notifications-outline" size={16} color={item.isRead ? '#717171' : '#1a3c34'} />
        </View>
        <View className="flex-1">
          <Text className="text-[14px] font-semibold text-ink leading-tight">{item.title}</Text>
          <Text className="text-sm text-muted mt-0.5 leading-4">{item.content}</Text>
          <Text className="text-[11px] text-muted mt-1">{formatDate(item.createdAt)}</Text>
        </View>
        <TouchableOpacity
          onPress={() => deleteMutation.mutate(item.id)}
          className="pl-2 self-start pt-1"
          hitSlop={8}
        >
          <Ionicons name="close" size={16} color="#717171" />
        </TouchableOpacity>
      </TouchableOpacity>
    )
  }

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        title={t('notifications')}
        right={
          unreadCount > 0 ? (
            <TouchableOpacity onPress={() => markAllMutation.mutate()}>
              <Text className="text-sm text-primary font-medium">{t('notif_mark_all_read')}</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {isLoading ? (
        <ActivityIndicator color="#1a3c34" className="mt-16" />
      ) : notifications.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Ionicons name="notifications-outline" size={48} color="#717171" />
          <Text className="text-muted mt-3">{t('no_notifications')}</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        />
      )}
    </View>
  )
}
