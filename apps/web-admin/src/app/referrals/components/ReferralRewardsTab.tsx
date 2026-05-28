"use client";

import { Card, CardContent, Chip, Table, Text } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";

import { orderStatusLabelVi } from "@/app/(landing)/components/dashboard-utils";
import { formatVnd } from "@/lib/product-display";
import { adminKeys } from "@/services/admin/keys";
import { fetchReferralRewards } from "@/services/admin/referral-api";
import type { AdminReferralRewardRow, ReferralRewardStatus } from "@/services/admin/types";

function statusLabelVi(s: ReferralRewardStatus): string {
  switch (s) {
    case "pending":
      return "Chờ xử lý";
    case "credited":
      return "Đã cộng điểm";
    case "void":
      return "Đã huỷ";
    default:
      return s;
  }
}

function statusChipClass(s: ReferralRewardStatus): string {
  switch (s) {
    case "credited":
      return "bg-emerald-100 text-emerald-900";
    case "pending":
      return "bg-amber-100 text-amber-900";
    case "void":
      return "bg-black/[0.06] text-foreground/60";
    default:
      return "";
  }
}

export function ReferralRewardsTab() {
  const rewardsQuery = useQuery({
    queryKey: adminKeys.referralRewards({ skip: 0, limit: 100 }),
    queryFn: () => fetchReferralRewards({ limit: 100, skip: 0 }),
  });

  const rows = rewardsQuery.data?.items ?? [];
  const total = rewardsQuery.data?.total ?? 0;

  return (
    <Card className="overflow-x-auto rounded-2xl border border-black/[0.06] shadow-[0_12px_40px_-24px_rgba(0,0,0,0.12)]">
      <CardContent className="border-b border-black/[0.06] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[#1a3c34]">
              Phần thưởng giới thiệu
            </p>
            <p className="text-xs text-foreground/50">
              Ghi nhận từ đơn đủ điều kiện — tối đa 100 dòng gần nhất
            </p>
          </div>
          <Text className="text-xs text-foreground/45">
            {rewardsQuery.isLoading ? "Đang tải…" : `${rows.length} / ${total} bản ghi`}
          </Text>
        </div>
      </CardContent>

      {!rewardsQuery.isLoading && rows.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-foreground/50">
          Chưa có phần thưởng nào.
        </div>
      ) : (
      <Table.Root className="min-w-[1020px]" aria-label="Phần thưởng giới thiệu">
        <Table.ScrollContainer>
          <Table.Content>
            <Table.Header>
              <Table.Column isRowHeader className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Người nhận thưởng
              </Table.Column>
              <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Người được mời
              </Table.Column>
              <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Giá trị
              </Table.Column>
              <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Điểm referrer
              </Table.Column>
              <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Trạng thái
              </Table.Column>
              <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Đơn liên quan
              </Table.Column>
            </Table.Header>
            <Table.Body>
              {rewardsQuery.isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <Table.Row key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <Table.Cell key={j} className="px-5 py-4">
                          <div className="h-4 animate-pulse rounded-md bg-black/5" />
                        </Table.Cell>
                      ))}
                    </Table.Row>
                  ))
                : (
                    rows.map((r: AdminReferralRewardRow) => (
                      <Table.Row key={r.id}>
                        <Table.Cell className="max-w-[200px] px-5 py-3">
                          <p className="truncate font-semibold text-foreground">
                            {r.beneficiary.name}
                          </p>
                          <p className="truncate font-mono text-xs text-foreground/50">
                            {r.beneficiary.referralCode}
                          </p>
                        </Table.Cell>
                        <Table.Cell className="max-w-[180px] px-5 py-3">
                          <p className="truncate text-sm">{r.referredUser.name}</p>
                          <p className="truncate text-xs text-foreground/50">
                            {r.referredUser.phone ?? "—"}
                          </p>
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3 text-sm font-medium tabular-nums">
                          {formatVnd(Number.parseFloat(r.amount))}
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3 text-sm tabular-nums">
                          {r.referrerPointsGranted != null
                            ? `${r.referrerPointsGranted} điểm`
                            : "—"}
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3">
                          <Chip
                            size="sm"
                            variant="soft"
                            className={`border-0 font-semibold ${statusChipClass(r.status)}`}
                          >
                            <Chip.Label>{statusLabelVi(r.status)}</Chip.Label>
                          </Chip>
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3 text-sm">
                          {r.order ? (
                            <div>
                              <p className="font-mono text-xs font-semibold text-[#1a3c34]">
                                {r.order.paymentCode}
                              </p>
                              <p className="text-xs text-foreground/50">
                                {orderStatusLabelVi(r.order.status)}
                              </p>
                            </div>
                          ) : (
                            "—"
                          )}
                        </Table.Cell>
                      </Table.Row>
                    ))
                  )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table.Root>
      )}
    </Card>
  );
}
