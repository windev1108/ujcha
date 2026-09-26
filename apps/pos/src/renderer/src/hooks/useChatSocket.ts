//pos/src/render/src/hooks/useChatSocket.ts
import { useEffect, useRef } from 'react'
import { API_URL, type ChatMessage } from '../api'
import { getSocket } from '@/socket'

export function useChatSocket({
    kind,
    id,
    enabled,
    onMessage,
    onRoomClosed,
    onSynced,
}: {
    kind: 'order' | 'group'
    id: string | null
    enabled: boolean
    onMessage: (msg: ChatMessage) => void
    onRoomClosed: () => void
    onSynced?: () => void
}) {
    const onMessageRef = useRef(onMessage)
    onMessageRef.current = onMessage
    const onRoomClosedRef = useRef(onRoomClosed)
    onRoomClosedRef.current = onRoomClosed
    const onSyncedRef = useRef(onSynced)
    onSyncedRef.current = onSynced

    useEffect(() => {
        if (!enabled || !id) return

        const socket = getSocket(API_URL, '/chat')

        const handleMessage = (msg: ChatMessage) => onMessageRef.current(msg)
        const handleClosed = () => onRoomClosedRef.current()

        const join = () => {
            socket.emit('join-room', { kind, id }, () => {
                onSyncedRef.current?.()
            })
        }
        // Socket dùng chung có thể ĐÃ connected sẵn (giữ sống từ mount khác)
        // nên phải join ngay, không chỉ đợi 'connect'.
        join()

        socket.on('connect', join)
        socket.io.on('reconnect', join)
        socket.on('message', handleMessage)
        socket.on('room:closed', handleClosed)

        return () => {
            socket.off('connect', join)
            socket.io.off('reconnect', join)
            socket.off('message', handleMessage)
            socket.off('room:closed', handleClosed)
            socket.emit('leave-room', { kind, id })
        }
    }, [kind, id, enabled])
}