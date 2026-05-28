"use client";

import { Button, Input, Label, Modal, useOverlayState } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { useEffect, useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import {
  adminFieldStackLoose,
  adminInputClass,
  adminLabelClass,
} from "@/lib/admin-form-classes";
import { adminKeys } from "@/services/admin/keys";
import { updateAdminShipper } from "@/services/admin/shippers-api";
import type { AdminShipper } from "@/services/admin/types";

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
  shipper: AdminShipper | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ShipperFormModal({ shipper, isOpen, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { showAlert } = useAppDialog();
  const modal = useOverlayState({ isOpen, onOpenChange });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (isOpen && shipper) {
      setName(shipper.name);
      setPhone(shipper.phone ?? "");
    }
  }, [isOpen, shipper]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!shipper) return;
      return updateAdminShipper(shipper.id, {
        name: name.trim(),
        phone: phone.trim() || undefined,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: adminKeys.shippers });
      onOpenChange(false);
    },
    onError: async (e) => showAlert(axiosMessage(e), "Lỗi"),
  });

  const submit = () => {
    if (!name.trim()) {
      void showAlert("Vui lòng nhập tên shipper.", "Thiếu thông tin");
      return;
    }
    mut.mutate();
  };

  if (!shipper) return null;

  return (
    <Modal.Root state={modal}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="md" scroll="inside">
          <Modal.Dialog className="max-w-md rounded-2xl border border-black/6 p-0 shadow-xl">
            <Modal.Header className="border-b border-black/6 px-5 py-4">
              <Modal.Heading>Cập nhật shipper</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-5 px-5 py-4">
              <div className={adminFieldStackLoose}>
                <Label className={adminLabelClass}>Họ tên</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  className={adminInputClass}
                />
              </div>
              <div className={adminFieldStackLoose}>
                <Label className={adminLabelClass}>Số điện thoại</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Tuỳ chọn"
                  className={adminInputClass}
                />
              </div>
            </Modal.Body>
            <Modal.Footer className="flex justify-end gap-2 border-t border-black/6 px-5 py-4">
              <Button variant="ghost" onPress={() => onOpenChange(false)}>
                Huỷ
              </Button>
              <Button
                className="bg-[#1a3c34] font-semibold text-white"
                onPress={submit}
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
