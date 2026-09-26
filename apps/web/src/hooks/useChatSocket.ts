// web/src/hooks/useChatSocket.ts
'use client'
import { useEffect, useRef } from 'react'
import { env } from '@/config/env'
import type { ChatMessage } from '@/services/chat/api'
import { getChatSocket, joinChatRoom, scheduleLeaveChatRoom } from '@/lib/chat-socket'

export function useChatSocket({
  kind, id, enabled, onMessage, onRoomClosed, onSynced,
}: {
  kind: 'order' | 'group'
  id: string | null
  enabled: boolean
  onMessage: (msg: ChatMessage) => void
  onRoomClosed: () => void
  onSynced?: () => void
}) {
  const onMessageRef = useRef(onMessage); onMessageRef.current = onMessage
  const onRoomClosedRef = useRef(onRoomClosed); onRoomClosedRef.current = onRoomClosed
  const onSyncedRef = useRef(onSynced); onSyncedRef.current = onSynced

  useEffect(() => {
    if (!enabled || !id) return
    const socket = getChatSocket(env.API_URL)

    const handleMessage = (msg: ChatMessage) => onMessageRef.current(msg)
    const handleClosed = () => onRoomClosedRef.current()

    const join = () => joinChatRoom(socket, kind, id, () => onSyncedRef.current?.())
    join()

    socket.on('connect', join)
    socket.io.on('reconnect', join)
    socket.on('message', handleMessage)
    socket.on('room:closed', handleClosed)

    // Vá thêm mọi race còn sót: mỗi lần tab quay lại foreground, resync 1 lần.
    const handleVisible = () => {
      if (document.visibilityState === 'visible') onSyncedRef.current?.()
    }
    document.addEventListener('visibilitychange', handleVisible)

    return () => {
      socket.off('connect', join)
      socket.io.off('reconnect', join)
      socket.off('message', handleMessage)
      socket.off('room:closed', handleClosed)
      document.removeEventListener('visibilitychange', handleVisible)
      scheduleLeaveChatRoom(socket, kind, id)
    }
  }, [kind, id, enabled])
}