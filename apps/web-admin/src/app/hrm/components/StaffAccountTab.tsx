"use client";

import {
  Button,
  Card,
  CardContent,
  Input,
  ListBox,
  Modal,
  Select,
  useOverlayState,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import {
  adminSelectTriggerCompactClass,
  adminSelectValueCompactClass,
} from "@/lib/admin-form-classes";
import { adminKeys } from "@/services/admin/keys";
import {
  createAdmin,
  deleteAdmin,
  fetchAdmins,
  updateAdmin,
} from "@/services/admin/admin-management-api";
import { fetchStaffWithProfiles } from "@/services/admin/hrm-api";
import type { AdminRole, AdminRow } from "@/services/admin/types";
import { useAuthStore } from "@/store/auth-store";

import { AdminFormModal, type AdminFormState } from "../../users/components/AdminFormModal";
import { StaffTable } from "../../users/components/StaffTable";

const PAGE_SIZE = 10;

function usePaginationWindow(current: number, totalPages: number, max = 5) {
  return useMemo(() => {
    if (totalPages <= 0) return [];
    const half = Math.floor(max / 2);
    let start = Math.max(1, current - half);
    const end = Math.min(totalPages, start + max - 1);
    start = Math.max(1, end - max + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [current, totalPages, max]);
}

export function StaffAccountTab() {
  const queryClient = useQueryClient();
  const { confirm } = useAppDialog();
  const currentAdmin = useAuthStore((s) => s.admin);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [editTarget, setEditTarget] = useState<AdminRow | null>(null);
  const formModal = useOverlayState();

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 320);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, roleFilter]);

  const adminsQuery = useQuery({
    queryKey: adminKeys.admins({
      q: debouncedSearch || undefined,
      role: roleFilter || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    queryFn: () =>
      fetchAdmins({
        q: debouncedSearch || undefined,
        role: roleFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const faceProfilesQuery = useQuery({
    queryKey: ["admin", "hrm", "staff"],
    queryFn: fetchStaffWithProfiles,
  });

  const faceProfilesMap = useMemo(() => {
    const map = new Map<string, { imageUrl: string | null } | null>();
    for (const s of faceProfilesQuery.data ?? []) {
      map.set(s.id, s.faceProfile ? { imageUrl: s.faceProfile.imageUrl } : null);
    }
    return map;
  }, [faceProfilesQuery.data]);

  const createMut = useMutation({
    mutationFn: createAdmin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "admins"] });
      formModal.close();
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { role: AdminRole; name?: string; phone?: string; address?: string } }) =>
      updateAdmin(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "admins"] });
      formModal.close();
      setEditTarget(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteAdmin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "admins"] });
    },
  });

  const handleOpenCreate = () => {
    setEditTarget(null);
    formModal.open();
  };

  const handleOpenEdit = (admin: AdminRow) => {
    setEditTarget(admin);
    formModal.open();
  };

  const handleFormSave = (data: AdminFormState) => {
    if (editTarget) {
      updateMut.mutate({
        id: editTarget.id,
        body: { role: data.role, name: data.name, phone: data.phone, address: data.address },
      });
    } else {
      createMut.mutate({
        email: data.email,
        role: data.role,
        name: data.name,
        phone: data.phone,
        address: data.address,
      });
    }
  };

  const handleDelete = async (admin: AdminRow) => {
    const ok = await confirm({
      title: "Xóa nhân viên?",
      description: `Xóa tài khoản "${admin.name ?? admin.phone ?? admin.id}"? Hành động không thể hoàn tác.`,
      tone: "danger",
      confirmLabel: "Xóa",
    });
    if (ok) deleteMut.mutate(admin.id);
  };

  const totalPages = adminsQuery.data?.totalPages ?? 1;
  const pageWindow = usePaginationWindow(page, totalPages, 5);

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-2xl border border-black/6 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full max-w-xl">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-foreground/40"
                  aria-hidden
                />
                <Input
                  aria-label="Tìm kiếm nhân viên"
                  placeholder="Tìm theo email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-full border-0 bg-[#f3f4f6] py-2 pl-10 pr-4 text-sm ring-1 ring-black/6"
                />
              </div>
              <Select
                className="w-full max-w-[200px]"
                placeholder="Vai trò"
                value={roleFilter === "" ? "__all__" : roleFilter}
                onChange={(key) =>
                  setRoleFilter(
                    key == null || key === "__all__" ? "" : String(key),
                  )
                }
                variant="secondary"
              >
                <Select.Trigger className={adminSelectTriggerCompactClass}>
                  <Select.Value className={adminSelectValueCompactClass} />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover placement="bottom start">
                  <ListBox className="min-w-(--trigger-width) outline-none">
                    <ListBox.Item id="__all__" textValue="Tất cả vai trò" className="rounded-lg text-sm">
                      Tất cả vai trò
                    </ListBox.Item>
                    <ListBox.Item id="super_admin" textValue="Super Admin" className="rounded-lg text-sm">
                      Super Admin
                    </ListBox.Item>
                    <ListBox.Item id="staff" textValue="Staff" className="rounded-lg text-sm">
                      Staff
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
            <Button
              type="button"
              onPress={handleOpenCreate}
              className="shrink-0 rounded-full bg-[#1a3c34] px-5 font-semibold text-white"
            >
              <Plus className="mr-2 size-4" />
              Thêm mới
            </Button>
          </div>
        </CardContent>
      </Card>

      <StaffTable
        admins={adminsQuery.data}
        isLoading={adminsQuery.isLoading}
        currentAdminId={currentAdmin?.id}
        page={page}
        totalPages={totalPages}
        pageWindow={pageWindow}
        onPageChange={setPage}
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
        isDeletePending={deleteMut.isPending}
        faceProfilesMap={faceProfilesMap}
      />

      <Modal.Root
        state={formModal}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
      >
        <Modal.Backdrop>
          <Modal.Container placement="center" size="md" scroll="inside">
            <Modal.Dialog className="max-w-md rounded-2xl border border-black/6 p-0 shadow-xl">
              <AdminFormModal
                mode={editTarget ? "edit" : "create"}
                initial={
                  editTarget
                    ? {
                        email: editTarget.email,
                        role: editTarget.role,
                        name: editTarget.name ?? "",
                        phone: editTarget.phone ?? "",
                        address: editTarget.address ?? "",
                      }
                    : undefined
                }
                onSave={handleFormSave}
                onClose={() => {
                  formModal.close();
                  setEditTarget(null);
                }}
                isPending={createMut.isPending || updateMut.isPending}
              />
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal.Root>
    </div>
  );
}
