"use client";

import { Button, Label, ListBox, Modal, Select, useOverlayState } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { useEffect, useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import {
  adminFieldStack,
  adminLabelClass,
  adminSelectTriggerClass,
  adminSelectValueClass,
} from "@/lib/admin-form-classes";
import { updateAdminOrderStatus } from "@/services/admin/orders-api";
import type {
  AdminOrder,
  AdminOrderStatus,
  AdminPaymentStatus,
} from "@/services/admin/types";

import { formatOrderRef, orderStatusLabel } from "./order-display";

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

type Props = {
  order: AdminOrder | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

const ALL_STATUSES: AdminOrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "delivering",
  "completed",
  "cancelled",
];

function getStatuses(orderType: string | undefined): AdminOrderStatus[] {
  if (orderType === "delivery") return ALL_STATUSES;
  return ALL_STATUSES.filter((s) => s !== "delivering");
}

const payments: AdminPaymentStatus[] = ["pending", "paid"];

export function OrderEditModal({ order, isOpen, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { showAlert } = useAppDialog();
  const modal = useOverlayState({ isOpen, onOpenChange });
  const [status, setStatus] = useState<AdminOrderStatus>("pending");
  const [paymentStatus, setPaymentStatus] =
    useState<AdminPaymentStatus>("pending");

  useEffect(() => {
    if (order) {
      setStatus(order.status);
      setPaymentStatus(order.paymentStatus);
    }
  }, [order, isOpen]);

  const mut = useMutation({
    mutationFn: () => {
      if (!order) throw new Error("no order");
      return updateAdminOrderStatus(order.id, { status, paymentStatus });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      modal.close();
    },
    onError: async (e) => showAlert(axiosMessage(e), "Lỗi"),
  });

  if (!order) return null;

  const statuses = getStatuses(order.type);

  return (
    <Modal.Root state={modal}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="md" scroll="inside">
          <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>Cập nhật đơn</Modal.Heading>
            <Modal.CloseTrigger />
          </Modal.Header>
          <Modal.Body className="space-y-4">
            <p className="font-mono text-sm font-semibold text-[#1a3c34]">
              {formatOrderRef(order)}
            </p>
            <div className={adminFieldStack}>
              <Label className={adminLabelClass}>
                Trạng thái đơn
              </Label>
              <Select
                className="w-full"
                value={status}
                onChange={(key) => {
                  if (key != null) setStatus(key as AdminOrderStatus);
                }}
              >
                <Select.Trigger className={adminSelectTriggerClass}>
                  <Select.Value className={adminSelectValueClass} />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover placement="bottom start">
                  <ListBox className="min-w-(--trigger-width) outline-none">
                    {statuses.map((s) => (
                      <ListBox.Item
                        key={s}
                        id={s}
                        textValue={orderStatusLabel(s)}
                        className="rounded-lg text-sm"
                      >
                        {orderStatusLabel(s)}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
            <div className={adminFieldStack}>
              <Label className={adminLabelClass}>
                Thanh toán
              </Label>
              <Select
                className="w-full"
                value={paymentStatus}
                onChange={(key) => {
                  if (key != null) setPaymentStatus(key as AdminPaymentStatus);
                }}
              >
                <Select.Trigger className={adminSelectTriggerClass}>
                  <Select.Value className={adminSelectValueClass} />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover placement="bottom start">
                  <ListBox className="min-w-(--trigger-width) outline-none">
                    {payments.map((p) => (
                      <ListBox.Item
                        key={p}
                        id={p}
                        textValue={p === "paid" ? "Đã thanh toán" : "Chưa TT"}
                        className="rounded-lg text-sm"
                      >
                        {p === "paid" ? "Đã thanh toán" : "Chưa thanh toán"}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
          </Modal.Body>
          <Modal.Footer className="flex justify-end gap-2">
            <Button variant="ghost" onPress={() => modal.close()}>
              Hủy
            </Button>
            <Button
              className="bg-[#1a3c34] font-semibold text-white"
              onPress={() => mut.mutate()}
              isDisabled={mut.isPending}
            >
              {mut.isPending ? "Đang lưu…" : "Lưu"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  );
}
