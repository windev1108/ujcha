"use client";

import { Card, CardContent } from "@heroui/react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { formatVnd } from "@/lib/product-display";
import type { AdminOverviewDashboard } from "@/services/admin/types";

const COLORS = {
  point: "#14532d",
  voucher: "#5a8f7a",
};

type Props = {
  data: AdminOverviewDashboard | undefined;
  isLoading: boolean;
};

export function DiscountAppliedCard({ data, isLoading }: Props) {
  const d = data?.discountsApplied;
  const totalDiscount = (d?.pointDiscountTotal ?? 0) + (d?.voucherDiscountTotal ?? 0);
  const rate =
    d && d.paidOrdersInRange > 0 ? Math.round((d.ordersWithPointDiscount / d.paidOrdersInRange) * 100) : 0;

  const chartData = d
    ? [
        { name: "Điểm UjCha", value: d.pointDiscountTotal, color: COLORS.point },
        { name: "Voucher", value: d.voucherDiscountTotal, color: COLORS.voucher },
      ].filter((c) => c.value > 0)
    : [];

  return (
    <Card className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_12px_40px_-24px_rgba(0,0,0,0.15)]">
      <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/45">
            Giảm giá đã áp dụng
          </p>
          <p className="mt-1 text-sm text-foreground/60">7 ngày gần nhất — đơn đã thanh toán</p>
        </div>

        {isLoading || !d ? (
          <div className="h-[280px] animate-pulse rounded-xl bg-black/[0.04]" />
        ) : (
          <>
            <div className="relative h-[160px] w-full min-h-[160px]">
              {chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-foreground/40">
                  Chưa có giảm giá nào được áp dụng.
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius="58%"
                        outerRadius="82%"
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {chartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => [formatVnd(Number(value)), name]}
                        contentStyle={{ borderRadius: "12px", border: "1px solid rgba(0,0,0,0.06)", fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-lg font-bold tracking-tight text-foreground">{formatVnd(totalDiscount)}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/45">
                         Tổng giảm
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between rounded-xl border border-black/6 bg-[#fafafa] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: COLORS.point }} />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Điểm UjCha</p>
                    <p className="text-[11px] text-foreground/45">{d.ordersWithPointDiscount} đơn dùng điểm</p>
                  </div>
                </div>
                <p className="text-sm font-bold tabular-nums text-[#1a3c34]">{formatVnd(d.pointDiscountTotal)}</p>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-black/6 bg-[#fafafa] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: COLORS.voucher }} />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Voucher / giảm giá</p>
                    <p className="text-[11px] text-foreground/45">Trên {d.paidOrdersInRange} đơn đã TT</p>
                  </div>
                </div>
                <p className="text-sm font-bold tabular-nums text-[#1a3c34]">{formatVnd(d.voucherDiscountTotal)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-[#f0f6f4] px-3 py-2">
              <span className="text-xs font-semibold text-[#1a3c34]">{rate}% đơn có dùng điểm giảm giá</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}