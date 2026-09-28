import { useState } from 'react'
import { X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@heroui/react'
import type { AdminOrder } from '../../types/common'
import { useChatDockStore, type DockConversation } from '@/store/chat-dock-store'
import { ChatPanel } from './ChatPanel'
import { fetchOrderById } from '@/api'

const BUBBLE_COLUMN_WIDTH = 56   // size avatar lg + chừa khoảng
const WINDOW_GAP = 16

export function ChatDock({
    onOpenOrder,
    rightOffset = 16,
    bottomOffset = 20,
}: {
    onOpenOrder: (order: AdminOrder) => void
    /** px tính từ mép phải màn hình — đẩy sang trái khi có panel khác (vd: AI panel) */
    rightOffset?: number
    bottomOffset?: number
}) {
    const conversations = useChatDockStore((s) => s.conversations)
    const order = useChatDockStore((s) => s.order)
    const openKey = useChatDockStore((s) => s.openKey)
    const toggle = useChatDockStore((s) => s.toggle)
    const close = useChatDockStore((s) => s.close)
    const dismiss = useChatDockStore((s) => s.dismiss)
    const [viewingKey, setViewingKey] = useState<string | null>(null)

    const list = order.map((k) => conversations[k]).filter(Boolean)
    const active = openKey ? conversations[openKey] : null
    if (list.length === 0) return null

    const handleViewOrder = async (conv: DockConversation) => {
        if (!conv.orderId || viewingKey) return
        setViewingKey(conv.key)
        try {
            onOpenOrder(await fetchOrderById(conv.orderId))
        } catch (err) {
            console.error('[pos-chat] open order failed:', err)
        } finally {
            setViewingKey(null)
        }
    }

    return (
        <>
            {active && (
                <div
                    className="fixed z-[75] w-[440px] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                    style={{ right: rightOffset + BUBBLE_COLUMN_WIDTH + WINDOW_GAP, bottom: bottomOffset }}
                >
                    <ChatPanel
                        key={active.key}
                        conversation={active}
                        onClose={close}
                        onViewOrder={() => void handleViewOrder(active)}
                        viewingOrder={viewingKey === active.key}
                    />
                </div>
            )}

            {/* Stack bubble: cũ nhất ở dưới, khách nhắn mới dồn lên trên */}
            <div
                className="fixed z-[75] flex flex-col-reverse items-center gap-3"
                style={{ right: rightOffset, bottom: bottomOffset }}
            >
                {list.map((conv) => (
                    <DockBubble
                        key={conv.key}
                        conv={conv}
                        active={conv.key === openKey}
                        onClick={() => toggle(conv.key)}
                        onDismiss={() => dismiss(conv.key)}
                    />
                ))}
            </div>
        </>
    )
}

function DockBubble({
    conv, active, onClick, onDismiss,
}: {
    conv: DockConversation
    active: boolean
    onClick: () => void
    onDismiss: () => void
}) {
    const hasUnread = conv.unread > 0 && !active
    return (
        <div className="group relative animate-in fade-in slide-in-from-bottom-2 duration-200">
            {/* Preview khi hover (ẩn khi đang mở chat) */}
            {!active && (
                <div className="pointer-events-none absolute right-full top-1/2 mr-3 hidden w-max max-w-[260px] -translate-y-1/2 rounded-2xl bg-gray-900/90 px-3 py-2 text-xs text-white shadow-lg group-hover:block">
                    <p className="truncate font-bold">{conv.customerName}</p>
                    {conv.orderCode && <p className="font-mono text-[10px] text-white/60">{conv.orderCode}</p>}
                    {conv.lastMessage && <p className="mt-0.5 truncate text-white/80">{conv.lastMessage}</p>}
                </div>
            )}

            <button
                type="button"
                onClick={onClick}
                aria-label={`Chat với ${conv.customerName}`}
                className={`cursor-pointer relative block rounded-full shadow-lg ring-2 transition hover:scale-105 ${active ? 'ring-brand' : 'ring-white'}`}
            >
                {hasUnread && <span className="absolute inset-0 animate-ping rounded-full bg-brand/30" />}
                <Avatar size="lg" className="relative border bg-white">
                    {conv.avatar && <AvatarImage src={conv.avatar} alt={conv.customerName} />}
                    <AvatarFallback>{conv.customerName?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
                </Avatar>
                {hasUnread && (
                    <span className="absolute -right-1 -top-1 flex min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold leading-5 text-white ring-2 ring-white">
                        {conv.unread > 9 ? '9+' : conv.unread}
                    </span>
                )}
            </button>

            {/* Gỡ bubble khỏi dock */}
            <button
                type="button"
                onClick={onDismiss}
                aria-label="Ẩn cuộc trò chuyện"
                className="absolute -left-1 -top-1 hidden size-5 items-center justify-center rounded-full bg-gray-700 text-white shadow group-hover:flex hover:bg-gray-900"
            >
                <X className="size-3" />
            </button>
        </div>
    )
}