"use client";

import { Button, Label, ListBox, Modal, Select, useOverlayState } from "@heroui/react";
import { useState } from "react";

import {
  adminFieldStack,
  adminLabelClass,
  adminSelectTriggerClass,
  adminSelectValueClass,
} from "@/lib/admin-form-classes";
import type { AdminOrderStatus } from "@/services/admin/types";

import { orderStatusLabel } from "./order-display";

const BULK_STATUSES: AdminOrderStatus[] = [
  "confirmed",
  "preparing",
  "ready",
  "delivering",
  "completed",
  "cancelled",
];

type Props = {
  count: number;
  isOpen: boolean;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (status: AdminOrderStatus) => void;
};

export function BulkStatusModal({ count, isOpen, isPending, onOpenChange, onConfirm }: Props) {
  const modal = useOverlayState({ isOpen, onOpenChange });
  const [status, setStatus] = useState<AdminOrderStatus>("confirmed");

  return (
    <Modal.Root state={modal}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="sm" scroll="inside">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Cập nhật hàng loạt</Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>
            <Modal.Body className="space-y-4">
              <p className="text-sm text-foreground/70">
                Áp dụng trạng thái mới cho{" "}
                <strong className="text-foreground">{count} đơn hàng</strong>{" "}
                đã chọn.
              </p>
              <div className={adminFieldStack}>
                <Label className={adminLabelClass}>Trạng thái mới</Label>
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
                      {BULK_STATUSES.map((s) => (
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
            </Modal.Body>
            <Modal.Footer className="flex justify-end gap-2">
              <Button variant="ghost" onPress={() => modal.close()} isDisabled={isPending}>
                Hủy
              </Button>
              <Button
                className="bg-[#1a3c34] font-semibold text-white"
                onPress={() => onConfirm(status)}
                isDisabled={isPending}
              >
                {isPending ? "Đang cập nhật…" : `Cập nhật ${count} đơn`}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  );
}
