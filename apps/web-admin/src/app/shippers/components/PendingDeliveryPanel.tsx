"use client";

import { Button, Chip } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { Bike, Clock, RefreshCw, Zap } from "lucide-react";
import { useState } from "react";

import { formatVnd } from "@/lib/product-display";
import { adminKeys } from "@/services/admin/keys";
import { fetchAdminOrders } from "@/services/admin/orders-api";
import type { AdminOrder } from "@/services/admin/types";

import { AssignShipperModal } from "@/app/orders/components/AssignShipperModal";
import { formatOrderRef } from "@/app/orders/components/order-display";
import { formatRelativeVi } from "./shipper-display";

export function PendingDeliveryPanel() {
  const [assignTarget, setAssignTarget] = useState<AdminOrder | null>(null);

  const query = useQuery({
    queryKey: adminKeys.unassignedDeliveryOrders,
    queryFn: () =>
      fetchAdminOrders({ unassignedShipper: true, page: 1, pageSize: 30 }),
    refetchInterval: 30_000,
  });

  const orders = query.data?.items ?? [];
  const count = query.data?.total ?? orders.length;

  return (
    <>
      <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Zap className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-amber-950">
                Đơn delivery chờ phân công
              </p>
              <p className="text-xs text-amber-700/70">
                Cập nhật tự động · Nhấn để gán shipper ngay
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {count > 0 && (
              <Chip
                size="sm"
                className="border-0 bg-amber-200 font-bold text-amber-900"
              >
                <Chip.Label>{count} đơn</Chip.Label>
              </Chip>
            )}
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className="rounded-xl text-amber-700 hover:bg-amber-100"
              aria-label="Làm mới"
              onPress={() => void query.refetch()}
              isDisabled={query.isFetching}
            >
              <RefreshCw
                className={`size-4 ${query.isFetching ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>

        {query.isLoading ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl bg-amber-100/60"
              />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <p className="py-4 text-center text-sm text-amber-700/60">
            Không có đơn delivery nào chưa có shipper.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {orders.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => setAssignTarget(order)}
                className="group flex flex-col gap-2 rounded-xl border border-amber-200 bg-white p-3 text-left shadow-sm transition hover:border-[#1a3c34]/40 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                      <Bike className="size-3.5" />
                    </span>
                    <span className="font-mono text-sm font-bold text-[#1a3c34]">
                      {formatOrderRef(order)}
                    </span>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {formatVnd(order.finalAmount)}
                  </span>
                </div>

                {(order.typeDisplay.delivery?.guestDeliveryAddress || order.guestDeliveryAddress) && (
                  <p className="line-clamp-1 text-xs text-foreground/55">
                    {order.typeDisplay.delivery?.guestDeliveryAddress ?? order.guestDeliveryAddress}
                  </p>
                )}

                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-[11px] text-foreground/45">
                    <Clock className="size-3" />
                    {formatRelativeVi(order.createdAt)}
                  </span>
                  <span className="rounded-md bg-[#1a3c34]/0 px-2 py-0.5 text-[11px] font-semibold text-[#1a3c34] opacity-0 transition group-hover:bg-[#1a3c34]/8 group-hover:opacity-100">
                    Gán shipper →
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <AssignShipperModal
        order={assignTarget}
        isOpen={assignTarget !== null}
        onOpenChange={(open) => {
          if (!open) setAssignTarget(null);
        }}
      />
    </>
  );
}
