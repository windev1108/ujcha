"use client";

import { Avatar, Card, Chip, Pagination, Table } from "@heroui/react";

import type { CustomerListResponse, CustomerRow } from "@/services/admin/types";

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

export function CustomersTable({
  customers,
  isLoading,
  page,
  totalPages,
  pageWindow,
  onPageChange,
}: {
  customers: CustomerListResponse | undefined;
  isLoading: boolean;
  page: number;
  totalPages: number;
  pageWindow: number[];
  onPageChange: (n: number) => void;
}) {
  return (
    <Card className="overflow-x-auto rounded-2xl border border-black/6 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.12)]">
      <Table.Root aria-label="Danh sách khách hàng">
        <Table.ScrollContainer>
          <Table.Content>
            <Table.Header>
              <Table.Column
                isRowHeader
                className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45"
              >
                Khách hàng
              </Table.Column>
              <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Liên hệ
              </Table.Column>
              <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Điểm UjCha
              </Table.Column>
              <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Trạng thái
              </Table.Column>
              <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Ngày tham gia
              </Table.Column>
            </Table.Header>
            <Table.Body>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                  <Table.Row key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <Table.Cell key={j} className="px-5 py-4">
                        <div className="h-4 animate-pulse rounded-md bg-black/5" />
                      </Table.Cell>
                    ))}
                  </Table.Row>
                ))
                : (customers?.items ?? []).map((customer: CustomerRow) => (
                  <Table.Row key={customer.id} id={customer.id}>
                    <Table.Cell className="px-5 py-4 align-middle">
                      <div className="flex items-center gap-3">
                        <Avatar className="shrink-0" size="sm" {...({} as any)}>
                          <Avatar.Image src={customer.avatar!} />
                          <Avatar.Fallback className="text-xs font-bold" {...({} as any)}>
                            {customer.name?.slice(0, 2).toUpperCase() ?? "N/A"}
                          </Avatar.Fallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground">
                            {customer.name ?? "—"}
                          </p>
                          <p className="font-mono text-xs text-foreground/45">
                            {customer.referralCode}
                          </p>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="px-5 py-4 align-middle text-sm">
                      <div className="flex flex-col gap-0.5">
                        {customer.phone && (
                          <span className="text-foreground/80">
                            {customer.phone}
                          </span>
                        )}
                        {customer.email && (
                          <span className="text-xs text-foreground/50">
                            {customer.email}
                          </span>
                        )}
                        {!customer.phone && !customer.email && (
                          <span className="text-foreground/35">—</span>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell className="px-5 py-4 align-middle font-semibold tabular-nums text-[#1a3c34]">
                      {customer.pointBalance.toLocaleString("vi-VN")}
                    </Table.Cell>
                    <Table.Cell className="px-5 py-4 align-middle">
                      {customer.suspiciousAt ? (
                        <Chip
                          size="sm"
                          variant="soft"
                          className="border-0 bg-red-50 font-semibold text-red-600"
                        >
                          <Chip.Label>Đáng ngờ</Chip.Label>
                        </Chip>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                          <span className="size-2 rounded-full bg-emerald-500" />
                          Hoạt động
                        </span>
                      )}
                    </Table.Cell>
                    <Table.Cell className="px-5 py-4 align-middle text-sm text-foreground/60">
                      {formatRelativeTime(customer.createdAt)}
                    </Table.Cell>
                  </Table.Row>
                ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table.Root>

      <div className="flex flex-col items-center justify-between gap-3 border-t border-black/6 px-5 py-4 sm:flex-row">
        <p className="text-xs text-foreground/50">
          Hiển thị {customers?.items.length ?? 0} trên {customers?.total ?? 0}{" "}
          khách hàng
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
