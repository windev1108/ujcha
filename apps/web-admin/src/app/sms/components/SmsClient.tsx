"use client";

import { Pagination, Table } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { MessageSquareDot } from "lucide-react";
import { useMemo, useState } from "react";

import { adminKeys } from "@/services/admin/keys";
import { fetchSmsLogs } from "@/services/admin/sms-api";

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  sent: { label: "Đã gửi", cls: "bg-green-50 text-green-700" },
  mock: { label: "Mock", cls: "bg-blue-50 text-blue-700" },
  pending: { label: "Đang xử lý", cls: "bg-amber-50 text-amber-700" },
  failed: { label: "Thất bại", cls: "bg-red-50 text-red-700" },
};

const PAGE_LIMIT = 20;

function usePaginationWindow(current: number, totalPages: number, max = 5): number[] {
  return useMemo(() => {
    if (totalPages <= 0) return [];
    const half = Math.floor(max / 2);
    let start = Math.max(1, current - half);
    let end = Math.min(totalPages, start + max - 1);
    start = Math.max(1, end - max + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [current, totalPages, max]);
}

export function SmsClient() {
  const [page, setPage] = useState(1);
  const [phoneFilter, setPhoneFilter] = useState("");
  const [phoneSearch, setPhoneSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: adminKeys.smsLogs({ page, limit: PAGE_LIMIT, phone: phoneSearch || undefined }),
    queryFn: () => fetchSmsLogs({ page, limit: PAGE_LIMIT, phone: phoneSearch || undefined }),
    placeholderData: (prev) => prev,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_LIMIT)) : 1;
  const pageWindow = usePaginationWindow(page, totalPages, 5);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneSearch(phoneFilter.trim());
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-8 pb-16">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
          Hệ thống
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1a3c34] sm:text-3xl">
          Nhật ký SMS
        </h1>
        <p className="mt-2 text-sm text-foreground/55">
          Lịch sử gửi OTP qua TextBee. Trạng thái Mock = chưa cấu hình API key.
        </p>
      </header>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="tel"
          placeholder="Lọc theo SĐT…"
          value={phoneFilter}
          onChange={(e) => setPhoneFilter(e.target.value)}
          className="min-h-10 w-full max-w-xs rounded-full border-0 bg-[#f3f4f6] px-4 text-sm ring-1 ring-black/8 placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-[#1a3c34]/20"
        />
        <button
          type="submit"
          className="rounded-full bg-[#1a3c34] px-5 text-sm font-semibold text-white hover:opacity-90"
        >
          Tìm
        </button>
        {phoneSearch && (
          <button
            type="button"
            onClick={() => { setPhoneFilter(""); setPhoneSearch(""); setPage(1); }}
            className="rounded-full border border-black/10 px-4 text-sm text-foreground/60 hover:bg-black/4"
          >
            Xoá lọc
          </button>
        )}
      </form>

      <div className="overflow-hidden rounded-2xl border border-black/6 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center text-sm text-foreground/40">
            Đang tải…
          </div>
        ) : !data?.items.length ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-foreground/35">
            <MessageSquareDot className="size-10" />
            <p className="text-sm">Chưa có nhật ký SMS nào.</p>
          </div>
        ) : (
          <Table.Root aria-label="Nhật ký SMS">
            <Table.ScrollContainer>
              <Table.Content>
                <Table.Header>
                  <Table.Column isRowHeader className="w-36 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Số điện thoại
                  </Table.Column>
                  <Table.Column className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Nội dung
                  </Table.Column>
                  <Table.Column className="w-28 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Trạng thái
                  </Table.Column>
                  <Table.Column className="w-36 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    TextBee ID
                  </Table.Column>
                  <Table.Column className="w-40 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Thời gian
                  </Table.Column>
                </Table.Header>
                <Table.Body>
                  {data.items.map((item) => {
                    const st = STATUS_CONFIG[item.status] ?? { label: item.status, cls: "bg-gray-50 text-gray-600" };
                    return (
                      <Table.Row key={item.id} className="border-t border-black/4 hover:bg-black/[0.02]">
                        <Table.Cell className="px-4 py-3 font-mono text-sm text-foreground">
                          {item.phone}
                        </Table.Cell>
                        <Table.Cell className="max-w-sm px-4 py-3">
                          <p className="line-clamp-2 text-sm text-foreground/70">{item.message}</p>
                          {item.error && (
                            <p className="mt-0.5 text-xs text-red-500">{item.error}</p>
                          )}
                        </Table.Cell>
                        <Table.Cell className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${st.cls}`}>
                            {st.label}
                          </span>
                        </Table.Cell>
                        <Table.Cell className="px-4 py-3 font-mono text-xs text-foreground/40">
                          {item.textbeeId ?? "—"}
                        </Table.Cell>
                        <Table.Cell className="px-4 py-3 text-xs text-foreground/50">
                          {new Date(item.createdAt).toLocaleString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table.Root>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-foreground/50">
            {(page - 1) * PAGE_LIMIT + 1}–{Math.min(page * PAGE_LIMIT, data?.total ?? 0)} / {data?.total ?? 0} bản ghi
          </p>
          <Pagination.Root className="w-full justify-end sm:w-auto">
            <Pagination.Content className="flex flex-wrap items-center justify-end gap-1">
              <Pagination.Item>
                <Pagination.Previous
                  isDisabled={page <= 1}
                  onPress={() => setPage((n) => Math.max(1, n - 1))}
                >
                  <Pagination.PreviousIcon />
                </Pagination.Previous>
              </Pagination.Item>
              {pageWindow.map((n) => (
                <Pagination.Item key={n}>
                  <Pagination.Link
                    isActive={n === page}
                    onPress={() => setPage(n)}
                    className={
                      n === page
                        ? "min-w-9 rounded-full bg-[#1a3c34] font-semibold text-white"
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
                  onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <Pagination.NextIcon />
                </Pagination.Next>
              </Pagination.Item>
            </Pagination.Content>
          </Pagination.Root>
        </div>
      )}
    </div>
  );
}
