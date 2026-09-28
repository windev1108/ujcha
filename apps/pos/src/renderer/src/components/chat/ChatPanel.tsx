import { useCallback, useEffect, useRef, useState } from 'react'
import { ClipboardList, ExternalLink, Loader2, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage, Button } from '@heroui/react'
import { ChatWindow } from './ChatWindow'
import {
    type ChatMessage, type ChatStickerDto,
    fetchAdminRoomMessages, fetchChatStickers, sendAdminRoomMessage, uploadChatImage,
} from '@/api'
import { useChatSocket } from '@/hooks/useChatSocket'
import { useChatDockStore, type DockConversation } from '@/store/chat-dock-store'
import { mergeMessages } from '@/lib/chat-messages'

const PAGE_SIZE = 20
const MAX_IMAGE_MB = 8

let stickersCache: ChatStickerDto[] | null = null // sticker ít đổi, khỏi fetch mỗi lần mở

function sortAsc(list: ChatMessage[]) {
    return [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

export function ChatPanel({
    conversation, onClose, onViewOrder, viewingOrder,
}: {
    conversation: DockConversation
    onClose: () => void
    onViewOrder: () => void
    viewingOrder: boolean
}) {
    const { kind, id } = conversation
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [initialLoading, setInitialLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const [input, setInput] = useState('')
    const [sending, setSending] = useState(false)
    const [uploadingImage, setUploadingImage] = useState(false)
    const [closed, setClosed] = useState(false)
    const [stickers, setStickers] = useState<ChatStickerDto[]>(stickersCache ?? [])

    const messagesRef = useRef<ChatMessage[]>([])
    const seenIdsRef = useRef(new Set<string>())

    messagesRef.current = messages
    const hasMoreRef = useRef(false)
    hasMoreRef.current = hasMore
    const loadingMoreRef = useRef(false)
    const mountedRef = useRef(true)

    useEffect(() => {
        mountedRef.current = true
        return () => { mountedRef.current = false }
    }, [])

    const loadInitial = useCallback(async () => {
        setInitialLoading(true)
        try {
            const [res, st] = await Promise.all([
                fetchAdminRoomMessages(kind, id, { limit: PAGE_SIZE }),
                stickersCache ? Promise.resolve(stickersCache) : fetchChatStickers().catch(() => [] as ChatStickerDto[]),
            ])
            if (!mountedRef.current) return
            stickersCache = st
            setStickers(st)
            setMessages((prev) => mergeMessages(prev, res.messages))
            setHasMore(res.hasMore)
        } catch (err) {
            console.error('[pos-chat] fetch failed:', err)
        } finally {
            if (mountedRef.current) setInitialLoading(false)
        }
    }, [kind, id])

    useEffect(() => { void loadInitial() }, [loadInitial])

    const loadMore = useCallback(async () => {
        if (loadingMoreRef.current || !hasMoreRef.current) return
        const oldest = messagesRef.current[0]
        if (!oldest) return
        loadingMoreRef.current = true
        setLoadingMore(true)
        try {
            const res = await fetchAdminRoomMessages(kind, id, { limit: PAGE_SIZE, beforeId: oldest.id })
            setMessages((prev) => mergeMessages(prev, res.messages))
            setHasMore(res.hasMore)
        } catch (err) {
            console.error('[pos-chat] load more failed:', err)
        } finally {
            loadingMoreRef.current = false
            if (mountedRef.current) setLoadingMore(false)
        }
    }, [kind, id])

    const syncLatest = useCallback(async () => {
        try {
            const res = await fetchAdminRoomMessages(kind, id, { limit: PAGE_SIZE })
            setMessages((prev) => mergeMessages(prev, res.messages))
        } catch (err) {
            console.error('[pos-chat] sync failed:', err)
        }
    }, [kind, id])

    const patchConversation = useChatDockStore((s) => s.patch)

    useEffect(() => {
        const cust = [...messages].reverse().find((m) => m.senderType !== 'staff')
        if (!cust) return
        const name = cust.displayName || conversation.customerName
        const avatar = cust.avatar ?? conversation.avatar
        if (name === conversation.customerName && avatar === conversation.avatar) return
        patchConversation(conversation.key, { customerName: name, avatar })
    }, [messages, conversation.key, conversation.customerName, conversation.avatar, patchConversation])

    useChatSocket({
        kind, id, enabled: true,
        onMessage: (msg) => {
            if (seenIdsRef.current.has(msg.id)) return
            seenIdsRef.current.add(msg.id)
            setMessages((prev) => mergeMessages(prev, [msg]))
        },
        onRoomClosed: () => setClosed(true),
        onSynced: () => void syncLatest(),
    })

    const appendMessage = (msg: ChatMessage) => {
        if (!mountedRef.current) return
        setMessages((prev) => mergeMessages(prev, [msg]))
    }

    const handleSend = async () => {
        const content = input.trim()
        if (!content || sending || closed) return
        setSending(true)
        setInput('')
        try {
            appendMessage(await sendAdminRoomMessage(kind, id, content, 'text'))
        } catch (err) {
            console.error('[pos-chat] send failed:', err)
            if (mountedRef.current) { setInput(content); void syncLatest() }
        } finally {
            if (mountedRef.current) setSending(false)
        }
    }

    // Gửi thẳng emoji, không đi qua state input (tránh stale closure)
    const handleSendQuickEmoji = async (emoji: string) => {
        if (sending || closed) return
        setSending(true)
        try {
            appendMessage(await sendAdminRoomMessage(kind, id, emoji, 'text'))
        } catch (err) {
            console.error('[pos-chat] send emoji failed:', err)
        } finally {
            if (mountedRef.current) setSending(false)
        }
    }

    const handleSendSticker = async (url: string) => {
        if (sending || closed) return
        setSending(true)
        try {
            appendMessage(await sendAdminRoomMessage(kind, id, url, 'sticker'))
        } catch (err) {
            console.error('[pos-chat] send sticker failed:', err)
        } finally {
            if (mountedRef.current) setSending(false)
        }
    }

    const handleSendImage = async (file: File) => {
        if (closed || uploadingImage || file.size > MAX_IMAGE_MB * 1024 * 1024) return
        setUploadingImage(true)
        try {
            const url = await uploadChatImage(file)
            appendMessage(await sendAdminRoomMessage(kind, id, url, 'image'))
        } catch (err) {
            console.error('[pos-chat] send image failed:', err)
        } finally {
            if (mountedRef.current) setUploadingImage(false)
        }
    }

    const c = conversation
    const header = (
        <div className="flex items-center gap-3 border-b border-black/6 px-4 py-3">
            <Avatar size="md" className="shrink-0 border bg-white">
                {c.avatar && <AvatarImage src={c.avatar} alt={c.customerName} />}
                <AvatarFallback>{c.customerName?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-900">{c.customerName}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                    <ClipboardList className="size-3 shrink-0" />
                    <span className="truncate">
                        {c.kind === 'group' ? 'Đơn nhóm' : 'Đơn'}{' '}
                        <span className="font-mono font-bold text-brand">{c.orderCode ?? '…'}</span>
                    </span>
                </p>
            </div>

            <Button
                type="button"
                onClick={onViewOrder}
                variant='outline'
                isDisabled={!c.orderId || viewingOrder}
                className="flex shrink-0 items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
            >
                {viewingOrder ? <Loader2 className="size-3.5 animate-spin" /> : <ExternalLink className="size-3.5" />}
                Xem đơn
            </Button>

            <button
                type="button"
                onClick={onClose}
                aria-label="Đóng"
                className="cursor-pointer flex size-7 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-black/6"
            >
                <X className="size-4" />
            </button>
        </div>
    )

    return (
        <ChatWindow
            header={header}
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
            onSendQuickEmoji={(e) => void handleSendQuickEmoji(e)}
            uploadingImage={uploadingImage}
            sending={sending}
            onClose={onClose}
            myId="staff"
            stickers={stickers}
        />
    )
}