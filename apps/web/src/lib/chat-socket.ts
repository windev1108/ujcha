// web/src/lib/chat-socket.ts
'use client'
import { io, type Socket } from 'socket.io-client'

const sockets = new Map<string, Socket>()
const pendingLeaves = new Map<string, ReturnType<typeof setTimeout>>()

export function getChatSocket(apiUrl: string): Socket {
  const key = `${apiUrl}/chat`
  const existing = sockets.get(key)
  if (existing) return existing

  const socket = io(`${apiUrl}/chat`, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
  })
  sockets.set(key, socket)
  return socket
}

function roomKey(kind: string, id: string) {
  return `${kind}:${id}`
}

// Gọi thay cho socket.emit('join-room', ...) trực tiếp.
// Nếu có 1 leave-room đang chờ cho đúng room này (do StrictMode/HMR remount
// nhả ra rồi nhận lại gần như ngay lập tức), huỷ nó đi thay vì để leave bay
// tới server sau join mới và đá socket ra khỏi room.
export function joinChatRoom(
  socket: Socket,
  kind: string,
  id: string,
  ack: () => void,
) {
  const key = roomKey(kind, id)
  const pending = pendingLeaves.get(key)
  if (pending) {
    clearTimeout(pending)
    pendingLeaves.delete(key)
  }
  socket.emit('join-room', { kind, id }, ack)
}

// Gọi thay cho socket.emit('leave-room', ...) trực tiếp trong cleanup.
// Trì hoãn 300ms — nếu component remount lại đúng room này trong lúc chờ
// (StrictMode double-invoke, Fast Refresh), leave sẽ bị huỷ bởi joinChatRoom.
export function scheduleLeaveChatRoom(socket: Socket, kind: string, id: string) {
  const key = roomKey(kind, id)
  const timer = setTimeout(() => {
    socket.emit('leave-room', { kind, id })
    pendingLeaves.delete(key)
  }, 300)
  pendingLeaves.set(key, timer)
}