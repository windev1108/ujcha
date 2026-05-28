"use client";

import {
  Button,
  Card,
  CardContent,
  Chip,
  Label,
  ListBox,
  Select,
  Table,
  Text,
} from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  adminFieldStack,
  adminLabelClassProduct,
  adminSelectTriggerCompactClass,
  adminSelectValueCompactClass,
} from "@/lib/admin-form-classes";
import { adminKeys } from "@/services/admin/keys";
import { fetchPointTransactionsGlobal } from "@/services/admin/points-api";

const PAGE = 30;

const typeLabel: Record<string, string> = {
  earn: "Tích",
  spend: "Dùng",
  expire: "Hết hạn",
};

const sourceLabel: Record<string, string> = {
  order: "Đơn hàng",
  referral: "Giới thiệu",
  admin: "Admin",
  promotion: "Khuyến mãi",
};

export function PointTransactionsTab() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  const typeParam =
    typeFilter === "all"
      ? undefined
      : (typeFilter as "earn" | "spend" | "expire");

  const q = useQuery({
    queryKey: adminKeys.pointTransactions({
      skip: page * PAGE,
      type: typeParam,
    }),
    queryFn: () =>
      fetchPointTransactionsGlobal({
        limit: PAGE,
        skip: page * PAGE,
        type: typeParam,
      }),
  });

  const totalPages = useMemo(() => {
    const t = q.data?.total ?? 0;
    return Math.max(1, Math.ceil(t / PAGE));
  }, [q.data?.total]);

  const items = q.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
          Giao dịch
        </p>
        <h2 className="mt-1 text-lg font-bold text-[#1a3c34]">
          Lịch sử toàn hệ thống
        </h2>
      </div>

      <Card className="rounded-2xl border border-black/6 shadow-sm">
        <CardContent className="flex flex-wrap items-end gap-4 p-5">
          <div className={`min-w-[180px] ${adminFieldStack}`}>
            <Label className={adminLabelClassProduct}>Loại</Label>
            <Select
              className="w-full"
              value={typeFilter}
              onChange={(k) => {
                if (k != null) {
                  setTypeFilter(String(k));
                  setPage(0);
                }
              }}
              variant="secondary"
            >
              <Select.Trigger className={adminSelectTriggerCompactClass}>
                <Select.Value className={adminSelectValueCompactClass} />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover placement="bottom start">
                <ListBox className="min-w-(--trigger-width) outline-none">
                  <ListBox.Item id="all" textValue="Tất cả" className="rounded-lg text-sm">
                    Tất cả
                  </ListBox.Item>
                  <ListBox.Item id="earn" textValue="Tích" className="rounded-lg text-sm">
                    Tích (earn)
                  </ListBox.Item>
                  <ListBox.Item id="spend" textValue="Dùng" className="rounded-lg text-sm">
                    Dùng (spend)
                  </ListBox.Item>
                  <ListBox.Item id="expire" textValue="Hết hạn" className="rounded-lg text-sm">
                    Hết hạn (expire)
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
          <Text className="text-xs text-foreground/45">
            Tổng bản ghi: {q.data?.total ?? "—"}
          </Text>
        </CardContent>
      </Card>

      <Card className="overflow-x-auto rounded-2xl border border-black/6 shadow-sm">
        <Table.Root className="min-w-[960px]" aria-label="Giao dịch điểm">
          <Table.ScrollContainer>
            <Table.Content>
              <Table.Header>
                <Table.Column
                  isRowHeader
                  textValue="Thời gian"
                  className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45"
                >
                  Thời gian
                </Table.Column>
                <Table.Column className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Khách
                </Table.Column>
                <Table.Column className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Loại
                </Table.Column>
                <Table.Column className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Số điểm
                </Table.Column>
                <Table.Column className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Nguồn
                </Table.Column>
              </Table.Header>
              <Table.Body>
                {q.isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <Table.Row key={i}>
                        {Array.from({ length: 5 }).map((__, j) => (
                          <Table.Cell key={j} className="px-4 py-3">
                            <div className="h-4 animate-pulse rounded-md bg-black/5" />
                          </Table.Cell>
                        ))}
                      </Table.Row>
                    ))
                  : items.map((tx) => (
                      <Table.Row key={tx.id}>
                        <Table.Cell className="whitespace-nowrap px-4 py-3 text-xs text-foreground/70">
                          {new Date(tx.createdAt).toLocaleString("vi-VN")}
                        </Table.Cell>
                        <Table.Cell className="max-w-[200px] px-4 py-3 text-sm">
                          <span className="font-medium">{tx.user.name}</span>
                          <span className="block truncate text-xs text-foreground/50">
                            {tx.user.phone ?? tx.user.email ?? "—"}
                          </span>
                        </Table.Cell>
                        <Table.Cell className="px-4 py-3">
                          <Chip
                            size="sm"
                            variant="soft"
                            className={
                              tx.type === "earn"
                                ? "border-0 bg-emerald-500/15 text-emerald-900"
                                : tx.type === "spend"
                                  ? "border-0 bg-violet-500/15 text-violet-900"
                                  : "border-0 bg-zinc-400/15 text-zinc-800"
                            }
                          >
                            {typeLabel[tx.type] ?? tx.type}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell
                          className={`px-4 py-3 font-mono text-sm tabular-nums ${tx.type === "earn" ? "text-emerald-800" : "text-foreground"}`}
                        >
                          {tx.type === "earn" ? "+" : "−"}
                          {tx.amount}
                        </Table.Cell>
                        <Table.Cell className="px-4 py-3 text-xs text-foreground/70">
                          {sourceLabel[tx.source] ?? tx.source}
                        </Table.Cell>
                      </Table.Row>
                    ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table.Root>
        {!q.isLoading && items.length === 0 ? (
          <p className="p-8 text-center text-sm text-foreground/45">
            Không có giao dịch.
          </p>
        ) : null}
      </Card>

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            isDisabled={page <= 0}
            onPress={() => setPage((p) => Math.max(0, p - 1))}
          >
            Trước
          </Button>
          <Text className="text-sm text-foreground/55">
            Trang {page + 1} / {totalPages}
          </Text>
          <Button
            size="sm"
            variant="ghost"
            isDisabled={page >= totalPages - 1}
            onPress={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            Sau
          </Button>
        </div>
      ) : null}
    </div>
  );
}
