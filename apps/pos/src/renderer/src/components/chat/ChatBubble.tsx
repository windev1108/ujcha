//pos/src/render/src/components/chat/ChatBubble.tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { ChatWindow } from './ChatWindow'
import { ChatMessage, ChatMessageType, fetchAdminRoomMessages, sendAdminRoomMessage, uploadChatImage } from '@/api';
import { useChatSocket } from '@/hooks/useChatSocket';

const PAGE_SIZE = 25
const MAX_IMAGE_MB = 8

function sortAsc(list: ChatMessage[]) {
    return [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

export function ChatBubble({ kind, id, disabled, guestName }: { kind: 'order' | 'group'; id: string; disabled?: boolean, guestName: string }) {
    const [open, setOpen] = useState(false)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [initialLoading, setInitialLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const [input, setInput] = useState('')
    const [sending, setSending] = useState(false)
    const [uploadingImage, setUploadingImage] = useState(false)
    const [closed, setClosed] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)

    const messagesRef = useRef<ChatMessage[]>([])
    messagesRef.current = messages
    const hasMoreRef = useRef(false)
    hasMoreRef.current = hasMore
    const loadingMoreRef = useRef(false)
    const openRef = useRef(open)
    openRef.current = open
    const mountedRef = useRef(true)

    useEffect(() => {
        mountedRef.current = true
        return () => { mountedRef.current = false }
    }, [])

    const loadInitial = useCallback(async () => {
        if (disabled) return
        setInitialLoading(true)
        try {
            const res = await fetchAdminRoomMessages(kind, id, { limit: PAGE_SIZE })
            setMessages(sortAsc(res.messages))
            setHasMore(res.hasMore)
        } catch (err) {
            console.error('[pos-chat] fetch failed:', err)
        } finally {
            if (mountedRef.current) setInitialLoading(false)
        }
    }, [kind, id, disabled])

    useEffect(() => {
        void loadInitial()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kind, id, disabled])

    const loadMore = useCallback(async () => {
        if (disabled || loadingMoreRef.current || !hasMoreRef.current) return
        const oldest = messagesRef.current[0]
        if (!oldest) return
        loadingMoreRef.current = true
        setLoadingMore(true)
        try {
            const res = await fetchAdminRoomMessages(kind, id, { limit: PAGE_SIZE, beforeId: oldest.id })
            const fresh = res.messages.filter(
                (m) => !messagesRef.current.some((existing) => existing.id === m.id)
            )
            if (fresh.length > 0) setMessages((prev) => [...sortAsc(fresh), ...prev])
            setHasMore(res.hasMore)
        } catch (err) {
            console.error('[pos-chat] load more failed:', err)
        } finally {
            loadingMoreRef.current = false
            if (mountedRef.current) setLoadingMore(false)
        }
    }, [kind, id, disabled])

    const syncLatest = useCallback(async () => {
        if (disabled) return
        try {
            const res = await fetchAdminRoomMessages(kind, id, { limit: PAGE_SIZE })
            const fresh = res.messages.filter(
                (m) => !messagesRef.current.some((existing) => existing.id === m.id)
            )
            if (fresh.length === 0) return
            setMessages((prev) => sortAsc([...prev, ...fresh]))
        } catch (err) {
            console.error('[pos-chat] sync failed:', err)
        }
    }, [kind, id, disabled])

    useChatSocket({
        kind,
        id,
        enabled: !disabled,
        onMessage: (msg) => {
            setMessages((prev) => {
                if (prev.some((m) => m.id === msg.id)) return prev
                return [...prev, msg]
            })
            if (!openRef.current && msg.senderType !== 'staff') {
                setUnreadCount((c) => c + 1)
            }
        },
        onRoomClosed: () => setClosed(true),
        onSynced: () => void syncLatest(),
    })

    const toggleOpen = useCallback(() => {
        setOpen((v) => {
            const next = !v
            if (next) setUnreadCount(0)
            return next
        })
    }, [])

    const appendMessage = (msg: ChatMessage) => {
        if (!mountedRef.current) return
        setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
        })
    }

    const handleSend = async () => {
        const content = input.trim()
        if (!content || sending || closed) return
        setSending(true)
        setInput('')
        try {
            const msg = await sendAdminRoomMessage(kind, id, content, 'text')
            appendMessage(msg)
        } catch (err) {
            console.error('[pos-chat] send failed:', err)
            if (mountedRef.current) {
                setInput(content)
                void syncLatest()
            }
        } finally {
            if (mountedRef.current) setSending(false)
        }
    }

    const handleSendSticker = async (url: string) => {
        if (sending || closed) return
        setSending(true)
        try {
            const msg = await sendAdminRoomMessage(kind, id, url, 'sticker')
            appendMessage(msg)
        } catch (err) {
            console.error('[pos-chat] send sticker failed:', err)
        } finally {
            if (mountedRef.current) setSending(false)
        }
    }

    const handleSendImage = async (file: File) => {
        if (closed || uploadingImage) return
        if (file.size > MAX_IMAGE_MB * 1024 * 1024) return
        setUploadingImage(true)
        try {
            const url = await uploadChatImage(file)
            const msg = await sendAdminRoomMessage(kind, id, url, 'image')
            appendMessage(msg)
        } catch (err) {
            console.error('[pos-chat] send image failed:', err)
        } finally {
            if (mountedRef.current) setUploadingImage(false)
        }
    }

    if (disabled) return null

    return (
        <div className="fixed bottom-5 right-5 z-[75] flex flex-col items-end gap-3">
            {open && (
                <div className="w-[440px] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                    <ChatWindow
                        key={`${kind}:${id}`}
                        guestName={guestName}
                        messages={messages}
                        loading={initialLoading}
                        hasMore={hasMore}
                        loadingMore={loadingMore}
                        onLoadMore={loadMore}
                        closed={closed}
                        input={input}
                        onInputChange={setInput}
                        onSend={() => void handleSend()}
                        onSendSticker={(url) => void handleSendSticker(url)}
                        onSendImage={(file) => void handleSendImage(file)}
                        uploadingImage={uploadingImage}
                        sending={sending}
                        onClose={() => setOpen(false)}
                        myId="staff"
                    />
                </div>
            )}
            <button
                type="button"
                onClick={toggleOpen}
                aria-label="Mở khung chat"
                className="relative flex size-14 items-center justify-center rounded-full bg-brand text-white shadow-lg transition hover:opacity-90"
            >
                {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
                {!open && unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold leading-5 text-white ring-2 ring-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>
        </div>
    )
}