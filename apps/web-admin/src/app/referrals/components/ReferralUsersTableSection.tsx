"use client";

import {
  Avatar,
  Button,
  Card,
  CardContent,
  Chip,
  Pagination,
  Table,
  Text,
} from "@heroui/react";
import { Download, Filter } from "lucide-react";
import { useMemo } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import { formatCompactCount } from "@/app/(landing)/components/dashboard-utils";
import type { AdminReferralUserRow } from "@/services/admin/types";

function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return `${p[0][0] ?? ""}${p[p.length - 1][0] ?? ""}`.toUpperCase();
}

function usePaginationWindow(
  current: number,
  totalPages: number,
  max = 5,
): number[] {
  return useMemo(() => {
    if (totalPages <= 0) return [];
    const half = Math.floor(max / 2);
    let start = Math.max(1, current - half);
    let end = Math.min(totalPages, start + max - 1);
    start = Math.max(1, end - max + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [current, totalPages, max]);
}

type Props = {
  title: string;
  description?: string;
  items: AdminReferralUserRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  isLoading: boolean;
  onPageChange: (p: number) => void;
  /** Ẩn phân trang (ví dụ tab tổng quan chỉ xem nhanh) */
  hidePagination?: boolean;
};

export function ReferralUsersTableSection({
  title,
  description,
  items,
  total,
  page,
  pageSize,
  totalPages,
  isLoading,
  onPageChange,
  hidePagination,
}: Props) {
  const { showAlert } = useAppDialog();
  const safePage = Math.min(Math.max(1, page), Math.max(1, totalPages));
  const pageWindow = usePaginationWindow(safePage, totalPages, 5);

  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return (
    <Card className="overflow-x-auto rounded-2xl border border-black/[0.06] shadow-[0_12px_40px_-24px_rgba(0,0,0,0.12)]">
      <CardContent className="border-b border-black/[0.06] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#1a3c34]">{title}</p>
            {description ? (
              <p className="mt-0.5 text-xs text-foreground/50">{description}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              isDisabled
              className="gap-1.5 rounded-full text-foreground/40"
            >
              <Filter className="size-4" aria-hidden />
              Lọc
            </Button>
            <span title="Tính năng xuất CSV sẽ cập nhật sau">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                isDisabled
                className="gap-1.5 rounded-full text-foreground/40"
              >
                <Download className="size-4" aria-hidden />
                Tải CSV
              </Button>
            </span>
          </div>
        </div>
      </CardContent>

      <Table.Root className="min-w-[900px]" aria-label={title}>
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
                Mã giới thiệu
              </Table.Column>
              <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Lượt giới thiệu
              </Table.Column>
              <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Điểm tích lũy
              </Table.Column>
              <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Trạng thái
              </Table.Column>
              <Table.Column className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Thao tác
              </Table.Column>
            </Table.Header>
            <Table.Body>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                  <Table.Row key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <Table.Cell key={j} className="px-5 py-4">
                        <div className="h-4 animate-pulse rounded-md bg-black/5" />
                      </Table.Cell>
                    ))}
                  </Table.Row>
                ))
                : items.map((u) => (
                  <Table.Row key={u.id}>
                    <Table.Cell className="max-w-[260px] px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar size="sm" className="shrink-0" {...({} as any)}>
                          <Avatar.Fallback className="text-[10px] font-bold" {...({} as any)}>
                            {initials(u.name)}
                          </Avatar.Fallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {u.name}
                          </p>
                          <p className="truncate text-xs text-foreground/50">
                            {u.email ?? u.phone ?? "—"}
                          </p>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="px-5 py-3">
                      <span className="rounded-lg bg-[#f3f4f6] px-2 py-1 font-mono text-xs font-semibold uppercase text-[#1a3c34] ring-1 ring-black/6">
                        {u.referralCode}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="px-5 py-3 text-sm tabular-nums text-foreground/80">
                      {u._count.referrals}
                    </Table.Cell>
                    <Table.Cell className="px-5 py-3 text-sm font-medium tabular-nums">
                      {formatCompactCount(u.pointBalance)}
                    </Table.Cell>
                    <Table.Cell className="px-5 py-3">
                      {u.phoneVerifiedAt ? (
                        <Chip
                          size="sm"
                          variant="soft"
                          className="border-0 bg-[color-mix(in_oklab,#71b394_18%,transparent)] font-semibold text-[#14532d]"
                        >
                          <Chip.Label>Đang hoạt động</Chip.Label>
                        </Chip>
                      ) : (
                        <Chip size="sm" variant="soft">
                          <Chip.Label>Chờ duyệt</Chip.Label>
                        </Chip>
                      )}
                    </Table.Cell>
                    <Table.Cell className="px-5 py-3 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-full font-semibold text-[#14532d]"
                        onPress={() =>
                          void showAlert(
                            "Xem hồ sơ khách trong trang Điểm UjCha (tab Người dùng) sẽ được tích hợp sau.",
                            "Chi tiết",
                          )
                        }
                      >
                        Chi tiết
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table.Root>

      {hidePagination && total > 0 ? (
        <div className="border-t border-black/[0.06] px-5 py-3">
          <Text className="text-xs text-foreground/50">
            Hiển thị {from} – {to} trong tổng số {total} người dùng
          </Text>
        </div>
      ) : null}

      {!hidePagination && total > 0 ? (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-black/[0.06] px-5 py-4 sm:flex-row">
          <Text className="text-xs text-foreground/50">
            Hiển thị {from} – {to} trong tổng số {total} người dùng
          </Text>
          <Pagination.Root className="w-full justify-end sm:w-auto">
            <Pagination.Content className="flex flex-wrap items-center justify-end gap-1">
              <Pagination.Item>
                <Pagination.Previous
                  isDisabled={safePage <= 1}
                  onPress={() => onPageChange(Math.max(1, safePage - 1))}
                >
                  <Pagination.PreviousIcon />
                </Pagination.Previous>
              </Pagination.Item>
              {pageWindow.map((n) => (
                <Pagination.Item key={n}>
                  <Pagination.Link
                    isActive={n === safePage}
                    onPress={() => onPageChange(n)}
                    className={
                      n === safePage
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
                  isDisabled={safePage >= totalPages}
                  onPress={() =>
                    onPageChange(Math.min(totalPages, safePage + 1))
                  }
                >
                  <Pagination.NextIcon />
                </Pagination.Next>
              </Pagination.Item>
            </Pagination.Content>
          </Pagination.Root>
        </div>
      ) : null}
    </Card>
  );
}
