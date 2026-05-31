"use client";

import { Button, Card, Chip, Pagination, Table } from "@heroui/react";
import { Pencil, Trash2 } from "lucide-react";

import type { AdminListResponse, AdminRole, AdminRow } from "@/services/admin/types";

function roleBadgeClass(role: AdminRole) {
  return role === "super_admin"
    ? "bg-[color-mix(in_oklab,#1a3c34_12%,white)] text-[#1a3c34] border border-[#1a3c34]/20"
    : "bg-[color-mix(in_oklab,#71b394_15%,white)] text-[#3a7060] border border-[#71b394]/30";
}

function roleLabel(role: AdminRole) {
  return role === "super_admin" ? "Super Admin" : "Staff";
}

function initialsFromName(nameOrPhone: string | null | undefined) {
  if (!nameOrPhone) return "AD";
  return nameOrPhone.replace(/\s+/g, "").slice(0, 2).toUpperCase();
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

export function StaffTable({
  admins,
  isLoading,
  currentAdminId,
  page,
  totalPages,
  pageWindow,
  onPageChange,
  onEdit,
  onDelete,
  isDeletePending,
  faceProfilesMap,
}: {
  admins: AdminListResponse | undefined;
  isLoading: boolean;
  currentAdminId: string | undefined;
  page: number;
  totalPages: number;
  pageWindow: number[];
  onPageChange: (n: number) => void;
  onEdit: (admin: AdminRow) => void;
  onDelete: (admin: AdminRow) => void;
  isDeletePending: boolean;
  faceProfilesMap?: Map<string, { imageUrl: string | null } | null>;
}) {
  const colCount = faceProfilesMap ? 6 : 5;

  return (
    <Card className="overflow-x-auto rounded-2xl border border-black/6 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.12)]">
      <Table.Root aria-label="Danh sách nhân viên">
        <Table.ScrollContainer>
          <Table.Content>
            <Table.Header>
              <Table.Column
                isRowHeader
                className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45"
              >
                Người dùng
              </Table.Column>
              <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Vai trò
              </Table.Column>
              <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Trạng thái
              </Table.Column>
              {faceProfilesMap && (
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Ảnh nhận diện
                </Table.Column>
              )}
              <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Hoạt động cuối
              </Table.Column>
              <Table.Column className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Thao tác
              </Table.Column>
            </Table.Header>
            <Table.Body>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                  <Table.Row key={i}>
                    {Array.from({ length: colCount }).map((__, j) => (
                      <Table.Cell key={j} className="px-5 py-4">
                        <div className="h-4 animate-pulse rounded-md bg-black/5" />
                      </Table.Cell>
                    ))}
                  </Table.Row>
                ))
                : (admins?.items ?? []).map((admin) => {
                  const isSelf = admin.id === currentAdminId;
                  const faceProfile = faceProfilesMap?.get(admin.id);
                  return (
                    <Table.Row key={admin.id} id={admin.id}>
                      <Table.Cell className="px-5 py-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="relative size-10 shrink-0">
                            {faceProfile?.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={faceProfile.imageUrl}
                                alt={admin.name ?? admin.phone ?? "Staff"}
                                className="size-10 rounded-full object-cover object-center ring-1 ring-black/8"
                              />
                            ) : (
                              <div className="flex size-10 items-center justify-center rounded-full bg-[color-mix(in_oklab,#1a3c34_10%,white)] font-bold text-sm text-[#1a3c34] ring-1 ring-black/8">
                                {initialsFromName(admin.name ?? admin.phone)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground">
                              {admin.name ?? admin.phone ?? "—"}
                              {isSelf && (
                                <span className="ml-2 text-xs font-normal text-foreground/45">
                                  (Bạn)
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-foreground/50">
                              {admin.phone ?? admin.email ?? "—"}
                            </p>
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="px-5 py-4 align-middle">
                        <Chip
                          size="sm"
                          variant="soft"
                          className={`border-0 font-semibold ${roleBadgeClass(admin.role)}`}
                        >
                          <Chip.Label>{roleLabel(admin.role)}</Chip.Label>
                        </Chip>
                      </Table.Cell>
                      <Table.Cell className="px-5 py-4 align-middle">
                        <span className="inline-flex items-center gap-2 text-xs font-medium">
                          <span
                            className={`size-2 shrink-0 rounded-full ${admin.isActive ? "bg-emerald-500" : "bg-zinc-400"}`}
                          />
                          {admin.isActive ? "Đang hoạt động" : "Vô hiệu hóa"}
                        </span>
                      </Table.Cell>
                      {faceProfilesMap && (
                        <Table.Cell className="px-5 py-4 align-middle">
                          {faceProfile?.imageUrl ? (
                            <div className="size-14 overflow-hidden rounded-lg border border-black/8 bg-black/4">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={faceProfile.imageUrl}
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
                      )}
                      <Table.Cell className="px-5 py-4 align-middle text-sm text-foreground/60">
                        {formatRelativeTime(admin.createdAt)}
                      </Table.Cell>
                      <Table.Cell className="px-5 py-4 text-right align-middle">
                        {!isSelf && (
                          <div className="inline-flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label="Sửa / Phân quyền"
                              onPress={() => onEdit(admin)}
                              className="gap-1.5 text-xs text-[#1a3c34]"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="ghost"
                              aria-label="Xóa"
                              className="text-red-600 hover:bg-red-50"
                              onPress={() => onDelete(admin)}
                              isDisabled={isDeletePending}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        )}
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
          Hiển thị {admins?.items.length ?? 0} trên {admins?.total ?? 0} nhân
          viên
        </p>
        <Pagination.Root className="w-full justify-end sm:w-auto">
          <Pagination.Content className="flex flex-wrap items-center justify-end gap-1">
            <Pagination.Item>
              <Pagination.Previous
                isDisabled={page <= 1}
                onPress={() => onPageChange(Math.max(1, page - 1))}
              >
                <Pagination.PreviousIcon />
              </Pagination.Previous>
            </Pagination.Item>
            {pageWindow.map((n) => (
              <Pagination.Item key={n}>
                <Pagination.Link
                  isActive={n === page}
                  onPress={() => onPageChange(n)}
                  className={
                    n === page
                      ? "min-w-9 rounded-full bg-[#1a3c34] text-white data-[active=true]:bg-[#1a3c34]"
                      : "min-w-9 rounded-full"
                  }
                >
                  {n}
                </Pagination.Link>
              </Pagination.Item>
            ))}
            <Pagination.Item>
              <Pagination.Next
                isDisabled={page >= totalPages}
                onPress={() => onPageChange(Math.min(totalPages, page + 1))}
              >
                <Pagination.NextIcon />
              </Pagination.Next>
            </Pagination.Item>
          </Pagination.Content>
        </Pagination.Root>
      </div>
    </Card>
  );
}
