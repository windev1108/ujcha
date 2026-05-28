"use client";

import {
  Avatar,
  Button,
  Checkbox,
  Modal,
  Text,
  useOverlayState,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { ClipboardList, X } from "lucide-react";
import { useEffect, useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import { formatVnd } from "@/lib/product-display";
import { adminKeys } from "@/services/admin/keys";
import { assignOrderShipper, fetchAdminOrders } from "@/services/admin/orders-api";
import type { AdminOrder, AdminShipper } from "@/services/admin/types";

import { formatOrderRef } from "@/app/orders/components/order-display";
import {
  deliveryAddressSummary,
  formatRelativeVi,
  shipperNameInitials,
} from "./shipper-display";

function axiosMessage(e: unknown): string {
  const err = e as AxiosError<{ message?: string | string[] }>;
  const d = err.response?.data;
  if (d && typeof d === "object") {
    const m = d.message;
    if (typeof m === "string") return m;
    if (Array.isArray(m)) return m.join(", ");
  }
  return err.message || "Có lỗi xảy ra.";
}

function shipperInitials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length >= 2)
    return (p[0]!.slice(0, 1) + p[p.length - 1]!.slice(0, 1)).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "SP";
}

type Props = {
  shipper: AdminShipper | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AssignOrdersModal({ shipper, isOpen, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { showAlert } = useAppDialog();
  const modal = useOverlayState({ isOpen, onOpenChange });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const ordersQuery = useQuery({
    queryKey: [...adminKeys.unassignedDeliveryOrders, isOpen],
    queryFn: () =>
      fetchAdminOrders({
        unassignedShipper: true,
        page: 1,
        pageSize: 50,
      }),
    enabled: isOpen && shipper != null,
  });

  useEffect(() => {
    if (!isOpen) setSelected(new Set());
  }, [isOpen]);

  const items = ordersQuery.data?.items ?? [];
  const pendingCount = items.length;

  const mut = useMutation({
    mutationFn: async () => {
      if (!shipper) throw new Error("Chọn shipper.");
      const ids = [...selected];
      if (ids.length === 0) throw new Error("Chọn ít nhất một đơn.");
      let ok = 0;
      let firstErr: unknown;
      for (const oid of ids) {
        try {
          await assignOrderShipper(oid, shipper.id);
          ok++;
        } catch (e) {
          if (!firstErr) firstErr = e;
        }
      }
      if (ok === 0 && firstErr) throw firstErr;
      return { ok, fail: ids.length - ok };
    },
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      await qc.invalidateQueries({ queryKey: adminKeys.unassignedDeliveryOrders });
      await qc.invalidateQueries({ queryKey: adminKeys.shipperStats });
      await qc.invalidateQueries({ queryKey: adminKeys.shippers });
      setSelected(new Set());
      onOpenChange(false);
      if (r.fail > 0) {
        await showAlert(
          `Đã gán ${r.ok} đơn. ${r.fail} đơn không gán được (kiểm tra trạng thái đơn).`,
          "Hoàn tất một phần",
        );
      }
    },
    onError: async (e) => showAlert(axiosMessage(e), "Lỗi"),
  });

  const deliveries = shipper?.completedDeliveryCount ?? 0;
  const trustScore = Math.min(
    5,
    Math.round((3.8 + Math.min(deliveries, 500) / 500) * 10) / 10,
  );

  return (
    <Modal.Root state={modal}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="lg" scroll="inside">
          <Modal.Dialog className="max-h-[90vh] max-w-2xl rounded-2xl border border-black/6 p-0 shadow-xl">
            <Modal.Header className="flex flex-row items-start justify-between gap-3 border-b border-black/6 px-5 py-4">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="relative shrink-0">
                  <Avatar size="lg" className="ring-2 ring-[#1a3c34]/20" {...({} as any)}>
                    <Avatar.Fallback className="text-sm font-bold" {...({} as any)}>
                      {shipper ? shipperNameInitials(shipper.name) : "—"}
                    </Avatar.Fallback>
                  </Avatar>
                  <span
                    className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-[#1a3c34] text-[10px] text-white shadow"
                    aria-hidden
                  >
                    ✓
                  </span>
                </div>
                <div className="min-w-0">
                  <Modal.Heading className="text-left text-lg">
                    {shipper?.name ?? "—"}
                  </Modal.Heading>
                  <p className="mt-1 text-xs text-foreground/60">
                    <span className="font-semibold text-foreground/75">
                      {deliveries.toLocaleString("vi-VN")}
                    </span>{" "}
                    đơn giao hoàn thành
                  </p>
                </div>
              </div>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                className="shrink-0 rounded-xl"
                aria-label="Đóng"
                onPress={() => onOpenChange(false)}
              >
                <X className="size-4" />
              </Button>
            </Modal.Header>
            <Modal.Body className="space-y-4 px-5 py-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Đơn chưa gán shipper
                  </p>
                  <p className="text-base font-semibold text-[#1a3c34]">
                    Đơn giao hàng chờ phân công
                  </p>
                </div>
                <Text className="text-sm text-foreground/55">
                  {pendingCount} đơn
                </Text>
              </div>

              <div className="max-h-[min(52vh,420px)] space-y-2 overflow-y-auto rounded-xl border border-black/8 bg-[#fafafa] p-2">
                {ordersQuery.isLoading ? (
                  <div className="space-y-2 p-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-14 animate-pulse rounded-lg bg-black/6"
                      />
                    ))}
                  </div>
                ) : items.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-foreground/50">
                    Không có đơn delivery nào chưa gán shipper.
                  </p>
                ) : (
                  items.map((o) => {
                    const sel = selected.has(o.id);
                    return (
                      <label
                        key={o.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${sel ? "border-[#1a3c34]/35 bg-emerald-50/80" : "border-transparent bg-white hover:bg-white"}`}
                      >
                        <Checkbox
                          isSelected={sel}
                          onChange={(v) => {
                            setSelected((prev) => {
                              const n = new Set(prev);
                              if (v) n.add(o.id);
                              else n.delete(o.id);
                              return n;
                            });
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-sm font-bold text-[#1a3c34]">
                            {formatOrderRef(o)}
                          </p>
                          <p className="truncate text-xs text-foreground/55">
                            {deliveryAddressSummary(o)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold tabular-nums text-foreground">
                            {formatVnd(o.finalAmount)}
                          </p>
                          <p className="text-[11px] text-foreground/45">
                            {formatRelativeVi(o.createdAt)}
                          </p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </Modal.Body>
            <Modal.Footer className="flex flex-col gap-2 border-t border-black/6 px-5 py-4">
              <Button
                className="w-full rounded-full bg-[#1a3c34] py-6 font-semibold text-white"
                onPress={() => mut.mutate()}
                isDisabled={
                  mut.isPending ||
                  !shipper?.isActive ||
                  selected.size === 0
                }
              >
                <ClipboardList className="mr-2 size-4" />
                {mut.isPending
                  ? "Đang gán…"
                  : `Gán ${selected.size} đơn`}
              </Button>
              <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
                {shipper
                  ? `Gán cho ${shipper.name} — đơn delivery chưa có shipper`
                  : ""}
              </p>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  );
}
