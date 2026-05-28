"use client";

import {
  Button,
  Description,
  Label,
  ListBox,
  Modal,
  Select,
  useOverlayState,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { useEffect, useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import {
  adminFieldStack,
  adminLabelClass,
  adminSelectTriggerClass,
  adminSelectValueClass,
} from "@/lib/admin-form-classes";
import { adminKeys } from "@/services/admin/keys";
import { assignOrderShipper } from "@/services/admin/orders-api";
import { fetchAdminShippers } from "@/services/admin/shippers-api";
import type { AdminOrder } from "@/services/admin/types";

import { formatOrderRef } from "./order-display";

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

export function AssignShipperModal({ order, isOpen, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { showAlert } = useAppDialog();
  const modal = useOverlayState({ isOpen, onOpenChange });
  const [shipperId, setShipperId] = useState<string>("");

  const { data: shippers = [] } = useQuery({
    queryKey: ["admin", "shippers", true] as const,
    queryFn: () => fetchAdminShippers(true),
    enabled: isOpen,
  });

  useEffect(() => {
    if (order?.shipperId) setShipperId(order.shipperId);
    else if (shippers[0]) setShipperId(shippers[0].id);
    else setShipperId("");
  }, [order, shippers, isOpen]);

  const mut = useMutation({
    mutationFn: ({ oid, sid }: { oid: string; sid: string }) =>
      assignOrderShipper(oid, sid),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      if (order) {
        await queryClient.invalidateQueries({
          queryKey: adminKeys.order(order.id),
        });
      }
      modal.close();
    },
    onError: async (e) => showAlert(axiosMessage(e), "Lỗi"),
  });

  if (!order) return null;

  return (
    <Modal.Root state={modal}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="md" scroll="inside">
          <Modal.Dialog className="max-h-[90vh]">
          <Modal.Header>
            <Modal.Heading>Gán shipper</Modal.Heading>
            <Modal.CloseTrigger />
          </Modal.Header>
          <Modal.Body className="space-y-4">
            <p className="text-sm text-foreground/70">
              Đơn{" "}
              <span className="font-mono font-semibold text-[#1a3c34]">
                {formatOrderRef(order)}
              </span>{" "}
              — giao hàng
            </p>
            <div className={adminFieldStack}>
              <Label className={adminLabelClass}>
                Shipper
              </Label>
              <Description className="text-xs text-foreground/50">
                Chỉ shipper đang hoạt động.
              </Description>
              <Select
                className="w-full"
                value={shipperId || undefined}
                onChange={(key) => setShipperId(key == null ? "" : String(key))}
                placeholder="Chọn shipper"
              >
                <Select.Trigger className={adminSelectTriggerClass}>
                  <Select.Value className={adminSelectValueClass} />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover placement="bottom start">
                  <ListBox className="max-h-56 min-w-(--trigger-width) overflow-y-auto outline-none">
                    {shippers.map((s) => (
                      <ListBox.Item
                        key={s.id}
                        id={s.id}
                        textValue={s.name}
                        className="rounded-lg text-sm"
                      >
                        <span className="font-medium">{s.name}</span>
                        {s.phone ? (
                          <span className="ml-2 text-foreground/50">
                            {s.phone}
                          </span>
                        ) : null}
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
              onPress={() => {
                if (!shipperId) return;
                mut.mutate({ oid: order.id, sid: shipperId });
              }}
              isDisabled={!shipperId || mut.isPending}
            >
              {mut.isPending ? "Đang lưu…" : "Xác nhận gán"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  );
}
