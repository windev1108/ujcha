"use client";

import { Button, Modal, useOverlayState } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { Search, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";

import { adminKeys } from "@/services/admin/keys";
import { fetchStaffWithProfiles } from "@/services/admin/hrm-api";
import { createAdminShipperFromStaff, fetchAdminShippers } from "@/services/admin/shippers-api";
import type { StaffWithFaceProfile } from "@/services/admin/types";

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
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddShipperFromStaffModal({ isOpen, onOpenChange }: Props) {
  const qc = useQueryClient();
  const modal = useOverlayState({ isOpen, onOpenChange });

  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  const staffQ = useQuery({
    queryKey: ["admin", "hrm", "staff"],
    queryFn: fetchStaffWithProfiles,
    enabled: isOpen,
  });

  const shippersQ = useQuery({
    queryKey: adminKeys.shippers,
    queryFn: () => fetchAdminShippers(),
    enabled: isOpen,
  });

  // Set of adminIds already linked to a shipper
  const linkedAdminIds = useMemo(
    () => new Set((shippersQ.data ?? []).filter((s) => s.adminId).map((s) => s.adminId!)),
    [shippersQ.data],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (staffQ.data ?? []).filter((s) => {
      if (!q) return true;
      const name = (s.name ?? "").toLowerCase();
      const email = s.email.toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [staffQ.data, search]);

  const mut = useMutation({
    mutationFn: createAdminShipperFromStaff,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: adminKeys.shippers });
      await qc.invalidateQueries({ queryKey: adminKeys.shipperStats });
      setError(null);
      setAddingId(null);
      onOpenChange(false);
    },
    onError: (e) => {
      setError(axiosMessage(e));
      setAddingId(null);
    },
  });

  const handleAdd = (staff: StaffWithFaceProfile) => {
    setError(null);
    setAddingId(staff.id);
    mut.mutate(staff.id);
  };

  const isLoading = staffQ.isLoading || shippersQ.isLoading;

  return (
    <Modal.Root state={modal}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="lg" scroll="inside">
          <Modal.Dialog className="max-w-lg rounded-2xl border border-black/6 p-0 shadow-xl">
            <Modal.Header className="border-b border-black/6 px-5 py-4">
              <Modal.Heading className="flex items-center gap-2">
                <UserPlus className="size-4 text-[#1a3c34]" />
                Thêm shipper từ nhân viên
              </Modal.Heading>
            </Modal.Header>

            <Modal.Body className="px-5 py-4">
              {/* Search */}
              <div className="relative mb-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/35" />
                <input
                  type="text"
                  placeholder="Tìm theo tên hoặc email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-black/10 bg-[#f8faf9] py-2.5 pl-10 pr-4 text-sm focus:border-[#1a3c34] focus:outline-none"
                />
              </div>

              {error && (
                <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Staff list */}
              <div className="flex flex-col gap-1">
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl p-3">
                      <div className="size-10 shrink-0 animate-pulse rounded-xl bg-black/5" />
                      <div className="flex flex-1 flex-col gap-1.5">
                        <div className="h-3.5 w-32 animate-pulse rounded bg-black/5" />
                        <div className="h-3 w-48 animate-pulse rounded bg-black/5" />
                      </div>
                    </div>
                  ))
                  : filtered.length === 0
                    ? (
                      <p className="py-8 text-center text-sm text-foreground/40">
                        {search ? "Không tìm thấy nhân viên phù hợp." : "Không có nhân viên nào."}
                      </p>
                    )
                    : filtered.map((staff) => {
                      const isLinked = linkedAdminIds.has(staff.id);
                      const displayName = staff.name ?? staff.email.split("@")[0];
                      const isAdding = addingId === staff.id;

                      return (
                        <div
                          key={staff.id}
                          className={`flex items-center gap-3 rounded-xl p-3 transition-colors ${isLinked ? "opacity-50" : "hover:bg-black/[0.03]"}`}
                        >
                          {/* Avatar */}
                          {staff.faceProfile?.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={staff.faceProfile.imageUrl}
                              alt={displayName}
                              className="size-10 shrink-0 rounded-xl object-cover ring-1 ring-black/8"
                            />
                          ) : (
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f0ee] text-sm font-bold text-[#1a3c34]">
                              {displayName.slice(0, 1).toUpperCase()}
                            </div>
                          )}

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {displayName}
                            </p>
                            <p className="truncate text-[11px] text-foreground/45">
                              {staff.email}
                              {staff.phone ? ` · ${staff.phone}` : ""}
                              {" · "}
                              <span className="capitalize">{staff.role === "super_admin" ? "Super Admin" : "Staff"}</span>
                            </p>
                          </div>

                          {/* Action */}
                          {isLinked ? (
                            <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                              Đã là shipper
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              className="shrink-0 rounded-xl bg-[#1a3c34] px-3 font-semibold text-white"
                              isDisabled={mut.isPending}
                              onPress={() => handleAdd(staff)}
                            >
                              {isAdding ? "Đang thêm…" : "Thêm"}
                            </Button>
                          )}
                        </div>
                      );
                    })}
              </div>
            </Modal.Body>

            <Modal.Footer className="flex justify-end border-t border-black/6 px-5 py-4">
              <Button variant="ghost" onPress={() => onOpenChange(false)}>
                Đóng
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  );
}
