import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'
import { useNotificationStore } from '@/store/notification-store'
import { QK } from '@/constants/query-keys'
import { API_URL_VALUE } from '@/services/api'
import type { AppNotification } from '@/types'

export function useNotificationSocket(accessToken: string | null) {
  const socketRef = useRef<Socket | null>(null)
  const queryClient = useQueryClient()
  const { pushNotification, setUnreadCount } = useNotificationStore()

  useEffect(() => {
    if (!accessToken) return

    const socket = io(`${API_URL_VALUE}/notifications`, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    })
    socketRef.current = socket

    socket.on('notification', (n: AppNotification) => {
      queryClient.setQueryData<AppNotification[]>(QK.notifications, (old) =>
        old ? [n, ...old] : [n],
      )
      pushNotification(n)
    })

    socket.on('broadcast_notification', () => {
      queryClient.invalidateQueries({ queryKey: QK.notifications })
      setUnreadCount(useNotificationStore.getState().unreadCount + 1)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [accessToken])
}
