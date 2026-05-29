"use client";

import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { env } from "@/config/env";

type StatusPayload = { orderId: string; status: string };

type Options = {
  onStatusChange: (payload: StatusPayload) => void;
  enabled?: boolean;
};

export function useOrderStatusSocket({ onStatusChange, enabled = true }: Options) {
  const callbackRef = useRef(onStatusChange);
  callbackRef.current = onStatusChange;

  useEffect(() => {
    if (!enabled) return;

    const socket = io(env.API_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on("order:status", (payload: StatusPayload) => {
      callbackRef.current(payload);
    });

    return () => {
      socket.disconnect();
    };
  }, [enabled]);
}
