//pos/src/render/src/hooks/useGlobalChatNotifications.ts
import { useEffect, useRef } from 'react'
import { getSocket } from '@/socket'
import { API_URL } from '../api'
import newMessageMp3 from '../assets/mp3/new-message.mp3'
import { useChatNotifyStore } from '@/store/chat-notify-store'

interface ChatNewMessagePayload {
    kind: 'order' | 'group'
    id: string
}

/**
 * Thông báo "có tin nhắn mới" ở cấp toàn app — mount 1 lần duy nhất (ở
 * StaffApp), phát audio bất kể staff đang mở màn hình nào / đang xem đơn nào.
 *
 * Sửa 3 lỗi so với bản trước:
 * 1. Gateway bắn event tên `chat:new-message` (không phải `chat:notify`).
 * 2. Gateway chỉ gửi vào room `room:staff-lobby` — phải tự emit
 *    `join-staff-lobby` (và join lại sau mỗi lần reconnect) thì mới nhận được.
 * 3. Payload thật chỉ có `{ kind, id }`, KHÔNG có `message` — gateway cố tình
 *    không kèm nội dung. `sendStaffMessage` (khi staff tự gửi) không gọi
 *    notifyStaffNewMessage, nên event này chưa bao giờ là tin của chính
 *    staff — không cần (và không thể) lọc theo senderType.
 */
export function useGlobalChatNotifications(enabled: boolean) {
    const audioRef = useRef<HTMLAudioElement | null>(null)

    useEffect(() => {
        const audio = new Audio(newMessageMp3)
        audio.preload = 'auto'
        audioRef.current = audio
        return () => { audio.pause(); audioRef.current = null }
    }, [])

    useEffect(() => {
        if (!enabled) return
        const socket = getSocket(API_URL, '/chat')

        const join = () => socket.emit('join-staff-lobby', () => { })
        join()
        socket.on('connect', join)
        socket.io.on('reconnect', join)

        const handleNewMessage = (payload: ChatNewMessagePayload) => {
            if (payload.kind !== 'order') return
            useChatNotifyStore.getState().markUnread(payload.id)
            const audio = audioRef.current
            if (!audio) return
            audio.currentTime = 0
            audio.play().catch(() => { })
        }

        socket.on('chat:new-message', handleNewMessage)
        return () => {
            socket.off('connect', join)
            socket.io.off('reconnect', join)
            socket.off('chat:new-message', handleNewMessage)
            socket.emit('leave-staff-lobby')
        }
    }, [enabled])
}