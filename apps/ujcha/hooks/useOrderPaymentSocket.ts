import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { API_URL_VALUE } from '@/services/api'

interface Options {
  orderId: string | null
  enabled?: boolean
  onPaid?: () => void
}

export function useOrderPaymentSocket({ orderId, enabled = true, onPaid }: Options) {
  const [isPaid, setIsPaid] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const cbRef = useRef(onPaid)
  cbRef.current = onPaid

  useEffect(() => {
    if (!enabled || !orderId) return

    const socket = io(API_URL_VALUE, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    })
    socketRef.current = socket

    socket.on(
      'order:paid',
      (payload: { orderId: string; paymentCode: string; transferAmount: number }) => {
        if (payload.orderId === orderId) {
          setIsPaid(true)
          cbRef.current?.()
        }
      },
    )

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [orderId, enabled])

  return { isPaid }
}
