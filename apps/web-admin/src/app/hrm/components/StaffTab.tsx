"use client";

import {
  Button,
  Card,
  CardContent,
  Chip,
  Input,
  ListBox,
  Modal,
  Pagination,
  Select,
  Table,
  useOverlayState,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle2, Pencil, Plus, Search, Shield, Trash2, UserX } from "lucide-react";
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
import type { AdminRole, AdminRow, StaffWithFaceProfile } from "@/services/admin/types";
import { useAuthStore } from "@/store/auth-store";

import { AdminFormModal, type AdminFormState } from "../../users/components/AdminFormModal";
import { FaceSetupModal } from "./FaceSetupModal";
import { StaffPermissionsModal } from "./StaffPermissionsModal";

const PAGE_SIZE = 10;

type FaceEntry = StaffWithFaceProfile["faceProfile"];

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

function roleBadgeClass(role: AdminRole) {
  return role === "super_admin"
    ? "bg-[color-mix(in_oklab,#1a3c34_12%,white)] text-[#1a3c34] border border-[#1a3c34]/20"
    : "bg-[color-mix(in_oklab,#71b394_15%,white)] text-[#3a7060] border border-[#71b394]/30";
}

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "Vừa mới đây";
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} ngày trước`;
  return new Date(dateStr).toLocaleDateString("vi-VN");
}

function StaffAvatar({ admin, faceEntry }: { admin: AdminRow; faceEntry: FaceEntry | undefined }) {
  const initials = (admin.name ?? admin.email).slice(0, 2).toUpperCase();
  return (
    <div className="relative size-10 shrink-0">
      {faceEntry?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={faceEntry.imageUrl}
          alt={admin.name ?? admin.email}
          className="size-10 rounded-full object-cover object-center ring-1 ring-black/8"
        />
      ) : (
        <div className="flex size-10 items-center justify-center rounded-full bg-[color-mix(in_oklab,#1a3c34_10%,white)] text-sm font-bold text-[#1a3c34] ring-1 ring-black/8">
          {initials}
        </div>
      )}
      {admin.googleId && (
        <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-500 ring-2 ring-white" />
      )}
    </div>
  );
}

export function StaffTab() {
  const qc = useQueryClient();
  const { confirm } = useAppDialog();
  const currentAdmin = useAuthStore((s) => s.admin);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [editTarget, setEditTarget] = useState<AdminRow | null>(null);
  const [faceTarget, setFaceTarget] = useState<StaffWithFaceProfile | null>(null);
  const [permTarget, setPermTarget] = useState<StaffWithFaceProfile | null>(null);
  const formModal = useOverlayState();

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 320);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, roleFilter]);

  const adminsQuery = useQuery({
    queryKey: adminKeys.admins({
      q: debouncedSearch || undefined,
      role: roleFilter || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    queryFn: () => fetchAdmins({
      q: debouncedSearch || undefined,
      role: roleFilter || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
  });

  const faceQ = useQuery({
    queryKey: ["admin", "hrm", "staff"],
    queryFn: fetchStaffWithProfiles,
  });

  const faceMap = useMemo(() => {
    const m = new Map<string, FaceEntry>();
    for (const s of faceQ.data ?? []) m.set(s.id, s.faceProfile);
    return m;
  }, [faceQ.data]);

  const createMut = useMutation({
    mutationFn: createAdmin,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "admins"] });
      formModal.close();
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { role: AdminRole; name?: string; phone?: string; address?: string } }) =>
      updateAdmin(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "admins"] });
      formModal.close();
      setEditTarget(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteAdmin,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "admins"] }),
  });

  const handleSave = (data: AdminFormState) => {
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
      description: `Xóa tài khoản "${admin.email}"? Hành động không thể hoàn tác.`,
      tone: "danger",
      confirmLabel: "Xóa",
    });
    if (ok) deleteMut.mutate(admin.id);
  };

  const buildStaffEntry = (admin: AdminRow): StaffWithFaceProfile => ({
    id: admin.id,
    email: admin.email,
    role: admin.role,
    name: admin.name,
    phone: admin.phone,
    address: admin.address,
    createdAt: admin.createdAt,
    permissions: faceQ.data?.find((s) => s.id === admin.id)?.permissions ?? [],
    faceProfile: faceMap.get(admin.id) ?? null,
  });

  const openFaceModal = (admin: AdminRow) => setFaceTarget(buildStaffEntry(admin));

  const openPermModal = (admin: AdminRow) => setPermTarget(buildStaffEntry(admin));

  const totalPages = adminsQuery.data?.totalPages ?? 1;
  const pageWindow = usePaginationWindow(page, totalPages);

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <Card className="rounded-2xl border border-black/6 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full max-w-xs">
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
                className="w-full max-w-[180px]"
                placeholder="Vai trò"
                value={roleFilter === "" ? "__all__" : roleFilter}
                onChange={(key) =>
                  setRoleFilter(key == null || key === "__all__" ? "" : String(key))
                }
                variant="secondary"
              >
                <Select.Trigger className={adminSelectTriggerCompactClass}>
                  <Select.Value className={adminSelectValueCompactClass} />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover placement="bottom start">
                  <ListBox className="min-w-(--trigger-width) outline-none">
                    <ListBox.Item id="__all__" textValue="Tất cả vai trò" className="rounded-lg text-sm">Tất cả vai trò</ListBox.Item>
                    <ListBox.Item id="super_admin" textValue="Super Admin" className="rounded-lg text-sm">Super Admin</ListBox.Item>
                    <ListBox.Item id="staff" textValue="Staff" className="rounded-lg text-sm">Staff</ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
            <Button
              type="button"
              onPress={() => { setEditTarget(null); formModal.open(); }}
              className="shrink-0 rounded-full bg-[#1a3c34] px-5 font-semibold text-white"
            >
              <Plus className="mr-2 size-4" />
              Thêm mới
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="overflow-x-auto rounded-2xl border border-black/6 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.12)]">
        <Table.Root aria-label="Danh sách nhân viên">
          <Table.ScrollContainer>
            <Table.Content>
              <Table.Header>
                <Table.Column isRowHeader className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Nhân viên
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Vai trò
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Liên lạc
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Ảnh nhận diện
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Trạng thái
                </Table.Column>
                <Table.Column className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Thao tác
                </Table.Column>
              </Table.Header>
              <Table.Body>
                {adminsQuery.isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                    <Table.Row key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <Table.Cell key={j} className="px-5 py-4">
                          <div className="h-4 animate-pulse rounded-md bg-black/5" />
                        </Table.Cell>
                      ))}
                    </Table.Row>
                  ))
                  : (adminsQuery.data?.items ?? []).map((admin) => {
                    const isSelf = admin.id === currentAdmin?.id;
                    const faceEntry = faceMap.get(admin.id);
                    return (
                      <Table.Row key={admin.id} id={admin.id}>

                        {/* Nhân viên */}
                        <Table.Cell className="px-5 py-3 align-middle">
                          <div className="flex items-center gap-3">
                            <StaffAvatar admin={admin} faceEntry={faceEntry} />
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground">
                                {admin.name ?? admin.email.split("@")[0]}
                                {isSelf && (
                                  <span className="ml-2 text-xs font-normal text-foreground/45">(Bạn)</span>
                                )}
                              </p>
                              <p className="text-xs text-foreground/50">{admin.email}</p>
                              <p className="mt-0.5 text-[11px] text-foreground/35">{formatRelativeTime(admin.createdAt)}</p>
                            </div>
                          </div>
                        </Table.Cell>

                        {/* Vai trò */}
                        <Table.Cell className="px-5 py-3 align-middle">
                          <Chip size="sm" variant="soft" className={`border-0 font-semibold ${roleBadgeClass(admin.role)}`}>
                            <Chip.Label>{admin.role === "super_admin" ? "Super Admin" : "Staff"}</Chip.Label>
                          </Chip>
                        </Table.Cell>

                        {/* Liên lạc */}
                        <Table.Cell className="px-5 py-3 align-middle">
                          <div className="flex flex-col gap-0.5">
                            {admin.phone ? (
                              <span className="text-sm text-foreground">{admin.phone}</span>
                            ) : (
                              <span className="text-sm text-foreground/30">—</span>
                            )}
                            {admin.address && (
                              <span className="max-w-[180px] truncate text-[11px] text-foreground/50">{admin.address}</span>
                            )}
                          </div>
                        </Table.Cell>

                        {/* Ảnh nhận diện */}
                        <Table.Cell className="px-5 py-3 align-middle">
                          {faceEntry?.imageUrl ? (
                            <div className="size-14 overflow-hidden rounded-lg border border-black/8">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={faceEntry.imageUrl}
                                alt="Ảnh nhận diện"
                                className="h-full w-full object-cover object-center"
                              />
                            </div>
                          ) : (
                            <div className="flex size-14 items-center justify-center rounded-lg border border-dashed border-black/15 bg-black/3 text-[10px] text-foreground/30">
                              Chưa có
                            </div>
                          )}
                        </Table.Cell>

                        {/* Trạng thái */}
                        <Table.Cell className="px-5 py-3 align-middle">
                          <div className="flex flex-col gap-1.5">
                            {faceEntry ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                                <CheckCircle2 className="size-3.5 shrink-0" />
                                Đã đăng ký nhận diện
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500">
                                <UserX className="size-3.5 shrink-0" />
                                Chưa đăng ký
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1.5 text-xs text-foreground/50">
                              <span className={`size-2 shrink-0 rounded-full ${admin.googleId ? "bg-emerald-500" : "bg-zinc-300"}`} />
                              {admin.googleId ? "Google" : "Chưa liên kết"}
                            </span>
                          </div>
                        </Table.Cell>

                        {/* Thao tác */}
                        <Table.Cell className="px-5 py-3 text-right align-middle">
                          <div className="inline-flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant={faceEntry ? "outline" : "primary"}
                              aria-label="Cấu hình nhận diện"
                              className={`rounded-lg text-xs ${faceEntry ? "border-black/15" : "bg-[#1a3c34] text-white"}`}
                              onPress={() => openFaceModal(admin)}
                            >
                              <Camera className="size-3.5" />
                            </Button>
                            {admin.role === "staff" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label="Phân quyền"
                                className="text-[#1a3c34]"
                                onPress={() => openPermModal(admin)}
                              >
                                <Shield className="size-3.5" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label="Chỉnh sửa"
                              className="text-[#1a3c34]"
                              onPress={() => { setEditTarget(admin); formModal.open(); }}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            {!isSelf && (
                              <Button
                                isIconOnly
                                size="sm"
                                variant="ghost"
                                aria-label="Xóa"
                                className="text-red-600 hover:bg-red-50"
                                onPress={() => handleDelete(admin)}
                                isDisabled={deleteMut.isPending}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table.Root>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-black/6 px-5 py-4 sm:flex-row">
          <p className="text-xs text-foreground/50">
            Hiển thị {adminsQuery.data?.items.length ?? 0} trên {adminsQuery.data?.total ?? 0} nhân viên
          </p>
          <Pagination.Root className="w-full justify-end sm:w-auto">
            <Pagination.Content className="flex flex-wrap items-center justify-end gap-1">
              <Pagination.Item>
                <Pagination.Previous isDisabled={page <= 1} onPress={() => setPage(Math.max(1, page - 1))}>
                  <Pagination.PreviousIcon />
                </Pagination.Previous>
              </Pagination.Item>
              {pageWindow.map((n) => (
                <Pagination.Item key={n}>
                  <Pagination.Link
                    isActive={n === page}
                    onPress={() => setPage(n)}
                    className={n === page ? "min-w-9 rounded-full bg-[#1a3c34] text-white data-[active=true]:bg-[#1a3c34]" : "min-w-9 rounded-full"}
                  >
                    {n}
                  </Pagination.Link>
                </Pagination.Item>
              ))}
              <Pagination.Item>
                <Pagination.Next isDisabled={page >= totalPages} onPress={() => setPage(Math.min(totalPages, page + 1))}>
                  <Pagination.NextIcon />
                </Pagination.Next>
              </Pagination.Item>
            </Pagination.Content>
          </Pagination.Root>
        </div>
      </Card>

      {/* Edit / Create modal */}
      <Modal.Root
        state={formModal}
        onOpenChange={(open) => { if (!open) setEditTarget(null); }}
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
                onSave={handleSave}
                onClose={() => { formModal.close(); setEditTarget(null); }}
                isPending={createMut.isPending || updateMut.isPending}
              />
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal.Root>

      {/* Face setup modal */}
      <FaceSetupModal
        staff={faceTarget}
        isOpen={faceTarget !== null}
        onClose={() => setFaceTarget(null)}
        onSuccess={() => {
          void qc.invalidateQueries({ queryKey: ["admin", "hrm", "staff"] });
          setFaceTarget(null);
        }}
      />

      {/* Permissions modal */}
      <StaffPermissionsModal
        staff={permTarget}
        isOpen={permTarget !== null}
        onClose={() => setPermTarget(null)}
      />
    </div>
  );
}
