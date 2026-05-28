"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { env } from "@/config/env";

export type OrderPaidPayload = {
  orderId: string;
  paymentCode: string;
  transferAmount: number;
  transactionId: string;
};

type Options = {
  /** Nếu set, onOrderPaid chỉ gọi khi đúng orderId này */
  orderId?: string;
  onOrderPaid?: (payload: OrderPaidPayload) => void;
  onOrderNew?: (payload: { orderId: string; type: string }) => void;
  onOrderStatus?: (payload: { orderId: string; status: string }) => void;
};

export function useOrderSocket(options?: Options) {
  const queryClient = useQueryClient();
  const cbRef = useRef(options?.onOrderPaid);
  const orderIdRef = useRef(options?.orderId);
  const onNewRef = useRef(options?.onOrderNew);
  const onStatusRef = useRef(options?.onOrderStatus);
  cbRef.current = options?.onOrderPaid;
  orderIdRef.current = options?.orderId;
  onNewRef.current = options?.onOrderNew;
  onStatusRef.current = options?.onOrderStatus;

  useEffect(() => {
    const socket = io(env.API_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on("order:paid", (payload: OrderPaidPayload) => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      void queryClient.invalidateQueries({
        queryKey: ["admin", "orders", payload.orderId],
      });

      const cb = cbRef.current;
      const oid = orderIdRef.current;
      if (cb && (!oid || oid === payload.orderId)) {
        cb(payload);
      }
    });

    socket.on("order:new", (payload: { orderId: string; type: string }) => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      void queryClient.invalidateQueries({
        queryKey: ["admin", "orders", "unassigned-delivery"],
      });
      onNewRef.current?.(payload);
    });

    socket.on("order:status", (payload: { orderId: string; status: string }) => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      void queryClient.invalidateQueries({
        queryKey: ["admin", "orders", payload.orderId],
      });
      onStatusRef.current?.(payload);
    });

    socket.on("order:external", () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    });

    socket.on("order:shipper-assigned", () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      void queryClient.invalidateQueries({
        queryKey: ["admin", "orders", "unassigned-delivery"],
      });
      void queryClient.invalidateQueries({ queryKey: ["admin", "shippers"] });
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient]);
}
