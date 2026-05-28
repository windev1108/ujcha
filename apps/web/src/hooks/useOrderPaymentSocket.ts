"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { env } from "@/config/env";

export type OrderPaidPayload = {
  orderId: string;
  paymentCode: string;
  transferAmount: number;
  transactionId: string;
};

type Options = {
  orderId: string | null;
  onPaid?: (payload: OrderPaidPayload) => void;
  enabled?: boolean;
};

export function useOrderPaymentSocket({ orderId, onPaid, enabled = true }: Options) {
  const [isPaid, setIsPaid] = useState(false);
  const onPaidRef = useRef(onPaid);
  const orderIdRef = useRef(orderId);
  onPaidRef.current = onPaid;
  orderIdRef.current = orderId;

  useEffect(() => {
    if (!enabled || !orderId) return;

    const socket = io(env.API_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on("order:paid", (payload: OrderPaidPayload) => {
      if (payload.orderId !== orderIdRef.current) return;
      setIsPaid(true);
      onPaidRef.current?.(payload);
    });

    return () => {
      socket.disconnect();
    };
  }, [orderId, enabled]);

  return { isPaid };
}
