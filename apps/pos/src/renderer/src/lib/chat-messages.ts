// lib/chat-messages.ts

import { ChatMessage } from "@/api";

export function sortAsc(list: ChatMessage[]) {
    return [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

/** Gộp theo id, idempotent: gọi bao nhiêu lần cũng không nhân đôi. */
export function mergeMessages(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
    if (incoming.length === 0) return prev
    const map = new Map(prev.map((m) => [m.id, m]))
    let changed = false
    for (const m of incoming) {
        if (!map.has(m.id)) { map.set(m.id, m); changed = true }
    }
    return changed ? sortAsc([...map.values()]) : prev
}