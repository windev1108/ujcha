"use client";
import { useCallback, useEffect, useState } from "react";

const GUEST_ORDERS_KEY = "ujcha_guest_orders";
const GUEST_ORDER_MAX = 20;
const GUEST_ORDER_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface GuestOrderMeta {
  paymentCode: string;
  type: "delivery" | "pickup" | "table";
  totalAmount: number;
  createdAt: string;
}

function readFromStorage(): GuestOrderMeta[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GUEST_ORDERS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as GuestOrderMeta[];
    if (!Array.isArray(arr)) return [];
    const now = Date.now();
    return arr.filter(
      (o) =>
        o?.paymentCode &&
        o?.createdAt &&
        now - new Date(o.createdAt).getTime() < GUEST_ORDER_TTL_MS,
    );
  } catch {
    return [];
  }
}

function writeToStorage(orders: GuestOrderMeta[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GUEST_ORDERS_KEY, JSON.stringify(orders));
  } catch {}
}

export function saveGuestOrder(order: GuestOrderMeta): void {
  const existing = readFromStorage();
  const deduped = existing.filter((o) => o.paymentCode !== order.paymentCode);
  writeToStorage([order, ...deduped].slice(0, GUEST_ORDER_MAX));
}

export function useGuestOrders(): [GuestOrderMeta[], (paymentCode: string) => void, () => void] {
  // Start with [] on both server and client to avoid hydration mismatch.
  // useEffect populates data client-side after hydration completes.
  const [orders, setOrders] = useState<GuestOrderMeta[]>([]);

  useEffect(() => {
    const fresh = readFromStorage();
    writeToStorage(fresh);
    setOrders(fresh);

    const id = setInterval(() => setOrders(readFromStorage()), 5 * 60_000);
    return () => clearInterval(id);
  }, []);

  const remove = useCallback((paymentCode: string) => {
    setOrders((prev) => {
      const next = prev.filter((o) => o.paymentCode !== paymentCode);
      writeToStorage(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    writeToStorage([]);
    setOrders([]);
  }, []);

  return [orders, remove, clearAll];
}
