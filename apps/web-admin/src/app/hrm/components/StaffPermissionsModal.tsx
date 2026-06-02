"use client";

import { Button, Modal, useOverlayState } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Lock, Shield } from "lucide-react";
import { useState } from "react";

import { updateStaffPermissions } from "@/services/admin/hrm-api";
import { ALL_PERMISSIONS, PERMISSION_LABELS, type Permission } from "@/lib/permissions";
import type { StaffWithFaceProfile } from "@/services/admin/types";

type Props = {
  staff: StaffWithFaceProfile | null;
  isOpen: boolean;
  onClose: () => void;
};

const LOCKED_PERMISSIONS: Permission[] = ["attendance"];

export function StaffPermissionsModal({ staff, isOpen, onClose }: Props) {
  const modal = useOverlayState({ isOpen, onOpenChange: (o) => { if (!o) onClose(); } });
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<Permission>>(new Set());

  const [initialized, setInitialized] = useState(false);
  if (isOpen && staff && !initialized) {
    setSelected(new Set([...LOCKED_PERMISSIONS, ...(staff.permissions as Permission[])]));
    setInitialized(true);
  }
  if (!isOpen && initialized) {
    setInitialized(false);
  }

  const saveMut = useMutation({
    mutationFn: () => updateStaffPermissions(staff!.id, [...selected]),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "hrm", "staff"] });
      onClose();
    },
  });

  if (!staff) return null;

  const displayName = staff.name ?? staff.phone ?? `ID: ${staff.id}`;

  function toggle(p: Permission) {
    if (LOCKED_PERMISSIONS.includes(p)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  return (
    <Modal.Root state={modal}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="sm" scroll="inside">
          <Modal.Dialog className="max-w-sm rounded-2xl border border-black/6 p-0 shadow-xl">
            <div className="flex flex-col">
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-black/6 px-5 py-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#e8f0ee]">
                  <Shield className="size-4 text-[#1a3c34]" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">Phân quyền trang</p>
                  <p className="truncate text-xs text-foreground/50">{displayName}</p>
                </div>
              </div>

              {/* Body */}
              <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto px-5 py-4">
                <p className="text-xs text-foreground/50">
                  Chọn các trang nhân viên này được phép truy cập.
                </p>
                <div className="flex flex-col gap-1.5">
                  {ALL_PERMISSIONS.map((p) => {
                    const locked = LOCKED_PERMISSIONS.includes(p);
                    const checked = selected.has(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => toggle(p)}
                        disabled={locked}
                        className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-colors ${locked
                          ? "cursor-default border-[#1a3c34]/20 bg-[#e8f0ee]/60"
                          : checked
                            ? "border-[#1a3c34]/25 bg-[#e8f0ee] hover:bg-[#d8ebe5]"
                            : "border-black/8 bg-white hover:bg-black/[0.03]"
                          }`}
                      >
                        <span className={`flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${checked ? "border-[#1a3c34] bg-[#1a3c34]" : "border-black/20 bg-white"
                          }`}>
                          {checked && (
                            <svg className="size-3 text-white" fill="none" viewBox="0 0 12 12">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        <span className={`flex-1 text-sm font-medium ${locked ? "text-[#1a3c34]" : checked ? "text-[#1a3c34]" : "text-foreground/70"}`}>
                          {PERMISSION_LABELS[p]}
                        </span>
                        {locked && (
                          <Lock className="size-3.5 shrink-0 text-[#1a3c34]/50" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 border-t border-black/6 px-5 py-3">
                <Button
                  variant="ghost"
                  className="rounded-xl"
                  onPress={onClose}
                  isDisabled={saveMut.isPending}
                >
                  Hủy
                </Button>
                <Button
                  className="rounded-xl bg-[#1a3c34] font-semibold text-white"
                  onPress={() => saveMut.mutate()}
                  isDisabled={saveMut.isPending}
                >
                  {saveMut.isPending ? "Đang lưu…" : "Lưu quyền"}
                </Button>
              </div>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  );
}
