import { io, type Socket } from 'socket.io-client'

const sockets = new Map<string, Socket>()

/**
 * Shared socket per (apiUrl, namespace) — reused across toàn app thay vì mỗi
 * component tự mở io() riêng (StaffApp, OrdersModal, chat panels... trước đây
 * mỗi cái tự connect một kết nối riêng tới cùng server).
 *
 * KHÔNG disconnect + tạo lại chỉ vì `.connected` đang tạm thời false —
 * socket.io đã tự lo việc reconnect (reconnection: true). Nếu tạo lại ở đây
 * sẽ làm "mồ côi" các listener mà những component khác đã gắn vào socket cũ.
 */
export function getSocket(apiUrl: string, namespace = ''): Socket {
    const key = `${apiUrl}${namespace}`
    const existing = sockets.get(key)
    if (existing) return existing

    const socket = io(`${apiUrl}${namespace}`, {
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2000,
    })
    sockets.set(key, socket)
    return socket
}

/** Gọi khi logout để lần đăng nhập sau mở kết nối sạch (không dính state cũ). */
export function disconnectAllSockets() {
    sockets.forEach((s) => s.disconnect())
    sockets.clear()
}