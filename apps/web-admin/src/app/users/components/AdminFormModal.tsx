"use client";

import { Button, Input, ListBox, Modal, Select } from "@heroui/react";
import { useState } from "react";

import {
  adminSelectTriggerCompactClass,
  adminSelectValueCompactClass,
} from "@/lib/admin-form-classes";
import type { AdminRole } from "@/services/admin/types";

export type AdminFormState = {
  email: string;
  role: AdminRole;
  name?: string;
  phone?: string;
  address?: string;
};

export function AdminFormModal({
  mode,
  initial,
  onSave,
  onClose,
  isPending,
}: {
  mode: "create" | "edit";
  initial?: AdminFormState;
  onSave: (data: AdminFormState) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [email, setEmail] = useState(initial?.email ?? "");
  const [role, setRole] = useState<AdminRole>(initial?.role ?? "staff");
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");

  return (
    <>
      <Modal.Header className="border-b border-black/6 px-5 py-4">
        <Modal.Heading>
          {mode === "create" ? "Thêm nhân viên mới" : "Cập nhật phân quyền"}
        </Modal.Heading>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-4 px-5 py-5">
        {mode === "create" ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
              Email
            </label>
            <Input
              type="email"
              placeholder="staff@kun.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-black/10 bg-white"
              disabled={isPending}
            />
          </div>
        ) : (
          <div className="rounded-xl bg-[#f3f4f6] px-4 py-3">
            <p className="text-xs text-foreground/50">Email</p>
            <p className="mt-0.5 font-medium">{initial?.email}</p>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
            Vai trò
          </label>
          <Select
            value={role}
            onChange={(key) => {
              if (key != null) setRole(key as AdminRole);
            }}
          >
            <Select.Trigger className={adminSelectTriggerCompactClass}>
              <Select.Value className={adminSelectValueCompactClass} />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox className="min-w-(--trigger-width) outline-none">
                <ListBox.Item
                  id="super_admin"
                  textValue="Super Admin"
                  className="rounded-lg text-sm"
                >
                  Super Admin
                </ListBox.Item>
                <ListBox.Item
                  id="staff"
                  textValue="Staff"
                  className="rounded-lg text-sm"
                >
                  Staff
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        <div className="mt-1 border-t border-black/6 pt-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground/40">
            Thông tin liên lạc
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
                Họ tên
              </label>
              <Input
                placeholder="Nguyễn Văn A"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-xl border border-black/10 bg-white"
                disabled={isPending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
                Số điện thoại
              </label>
              <Input
                type="tel"
                placeholder="0901234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="rounded-xl border border-black/10 bg-white"
                disabled={isPending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
                Địa chỉ{" "}
                <span className="normal-case font-normal text-foreground/40">(tuỳ chọn)</span>
              </label>
              <Input
                placeholder="123 Nguyễn Trãi, Q.1, TP.HCM"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="rounded-xl border border-black/10 bg-white"
                disabled={isPending}
              />
            </div>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer className="flex justify-end gap-2 border-t border-black/6 px-5 py-4">
        <Button variant="ghost" onPress={onClose} isDisabled={isPending}>
          Hủy
        </Button>
        <Button
          className="rounded-xl bg-[#1a3c34] font-semibold text-white"
          onPress={() => onSave({ email, role, name: name.trim() || undefined, phone: phone.trim() || undefined, address: address.trim() || undefined })}
          isDisabled={isPending || (mode === "create" && !email.trim())}
        >
          {isPending
            ? "Đang lưu…"
            : mode === "create"
              ? "Thêm nhân viên"
              : "Lưu thay đổi"}
        </Button>
      </Modal.Footer>
    </>
  );
}
