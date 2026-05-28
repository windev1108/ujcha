import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(apiUrl: string): Socket {
    if (socket?.connected) return socket

    socket?.disconnect()
    socket = io(apiUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2000,
    })

    return socket
}