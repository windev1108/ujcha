import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { API_URL_VALUE } from '@/services/api'
import type { OrderStatus } from '@/types'

interface Options {
  enabled?: boolean
  onStatusChange: (payload: { orderId: string; status: OrderStatus }) => void
}

export function useOrderStatusSocket({ enabled = true, onStatusChange }: Options) {
  const socketRef = useRef<Socket | null>(null)
  const cbRef = useRef(onStatusChange)
  cbRef.current = onStatusChange

  useEffect(() => {
    if (!enabled) return

    const socket = io(API_URL_VALUE, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    })
    socketRef.current = socket

    socket.on('order:status', (payload: { orderId: string; status: OrderStatus }) => {
      cbRef.current(payload)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [enabled])
}
