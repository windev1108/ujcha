"use client";

import { Button, Input, Label, Modal, TextArea, useOverlayState } from "@heroui/react";
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
import { adjustUserPoints } from "@/services/admin/points-api";
import type { AdminUserSearchRow } from "@/services/admin/types";

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
  user: AdminUserSearchRow | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PointAdjustModal({ user, isOpen, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { showAlert } = useAppDialog();
  const modal = useOverlayState({ isOpen, onOpenChange });
  const [amountInput, setAmountInput] = useState("");
  const [noteInput, setNoteInput] = useState("");

  useEffect(() => {
    if (isOpen) {
      setAmountInput("");
      setNoteInput("");
    }
  }, [isOpen, user?.id]);

  const mut = useMutation({
    mutationFn: async (body: { amount: number; note?: string }) => {
      if (!user) throw new Error("no user");
      return adjustUserPoints({
        userId: user.id,
        amount: body.amount,
        note: body.note,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: adminKeys.pointStats });
      await qc.invalidateQueries({ queryKey: ["admin", "users", "search"] });
      onOpenChange(false);
    },
    onError: async (e) => showAlert(axiosMessage(e), "Lỗi"),
  });

  const submit = () => {
    const amount = Number.parseInt(amountInput.trim(), 10);
    if (!Number.isFinite(amount) || amount === 0) {
      void showAlert("Nhập số điểm khác 0 (âm để trừ).", "Thiếu thông tin");
      return;
    }
    const note = noteInput.trim();
    mut.mutate({ amount, note: note || undefined });
  };

  if (!user) return null;

  return (
    <Modal.Root state={modal}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="md" scroll="inside">
          <Modal.Dialog className="max-w-md rounded-2xl border border-black/6 p-0 shadow-xl">
            <Modal.Header className="border-b border-black/6 px-5 py-4">
              <Modal.Heading>Điều chỉnh điểm</Modal.Heading>
              <p className="mt-1 text-sm text-foreground/55">
                {user.name ?? "Khách"} · SĐT {user.phone ?? "—"}
              </p>
            </Modal.Header>
            <Modal.Body className="space-y-4 px-5 py-4">
              <div className={`${adminFieldStackLoose}`}>
                <Label className={adminLabelClass}>
                  Số điểm (+ cộng, − trừ)
                </Label>
                <Input
                  type="number"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className={adminInputClass}
                  placeholder="VD: 500 hoặc -100"
                />
              </div>
              <div className={`${adminFieldStackLoose}`}>
                <Label className={adminLabelClass}>Ghi chú (tuỳ chọn)</Label>
                <TextArea
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  className="min-h-[88px] rounded-xl border border-black/10 bg-white"
                  placeholder="Lý do điều chỉnh…"
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
                {mut.isPending ? "Đang gửi…" : "Xác nhận"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  );
}
