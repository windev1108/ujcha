"use client";

import { Card, CardContent } from "@heroui/react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AdminOverviewDashboard } from "@/services/admin/types";

const COLORS = {
  ok: "#14532d",
  low: "#d97706",
  out: "#dc2626",
};

const grid = "rgba(0,0,0,0.06)";

type Props = {
  data: AdminOverviewDashboard | undefined;
  isLoading: boolean;
};

export function InventoryStatusCard({ data, isLoading }: Props) {
  const router = useRouter();
  const status = data?.inventoryStatus;

  const okCount = status ? Math.max(0, status.totalActive - status.lowStockCount - status.outOfStockCount) : 0;

  // status.items is already the low/out-of-stock watchlist coming from the API,
  // so we only need to distinguish "hết hàng" (red) from "sắp hết" (amber) here.
  const chartData = status
    ? [...status.items]
        .sort((a, b) => a.stockQty - b.stockQty)
        .slice(0, 8)
        .map((it) => ({
          name: it.name,
          stock: it.stockQty,
          unit: it.unit,
          color: it.stockQty <= 0 ? COLORS.out : COLORS.low,
        }))
    : [];

  return (
    <Card className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_12px_40px_-24px_rgba(0,0,0,0.15)]">
      <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/45">
              Tình trạng tồn kho
            </p>
            <p className="mt-1 text-sm text-foreground/60">Nguyên liệu đang hoạt động</p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/inventory?tab=stats")}
            className="shrink-0 text-xs font-semibold text-[#1a3c34] underline-offset-4 hover:underline"
          >
            Xem chi tiết
          </button>
        </div>

        {isLoading || !status ? (
          <div className="h-[280px] animate-pulse rounded-xl bg-black/[0.04]" />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center gap-0.5 rounded-xl border border-black/6 bg-[#fafafa] p-2.5">
                <span className="size-2 rounded-full" style={{ background: COLORS.ok }} />
                <p className="text-sm font-bold tabular-nums text-[#1a3c34]">{okCount}</p>
                <p className="text-[10px] font-semibold text-foreground/50">Đủ hàng</p>
              </div>
              <div className="flex flex-col items-center gap-0.5 rounded-xl border border-amber-600/12 bg-amber-50/70 p-2.5">
                <span className="size-2 rounded-full" style={{ background: COLORS.low }} />
                <p className="text-sm font-bold tabular-nums text-amber-700">{status.lowStockCount}</p>
                <p className="text-[10px] font-semibold text-foreground/50">Sắp hết</p>
              </div>
              <div className="flex flex-col items-center gap-0.5 rounded-xl border border-red-600/12 bg-red-50/70 p-2.5">
                <span className="size-2 rounded-full" style={{ background: COLORS.out }} />
                <p className="text-sm font-bold tabular-nums text-red-700">{status.outOfStockCount}</p>
                <p className="text-[10px] font-semibold text-foreground/50">Đã hết</p>
              </div>
            </div>

            <div className="relative h-[220px] w-full min-h-[220px]">
              {chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center text-sm text-foreground/40">
                  Không có nguyên liệu nào sắp hết hoặc đã hết hàng.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={grid} horizontal={false} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      width={100}
                      tick={{ fill: "var(--muted)", fontSize: 11 }}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(0,0,0,0.03)" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload as { name: string; stock: number; unit: string };
                        return (
                          <div
                            style={{
                              borderRadius: 12,
                              border: "1px solid rgba(0,0,0,0.06)",
                              background: "#fff",
                              padding: "10px 14px",
                              boxShadow: "0 12px 40px -20px rgba(0,0,0,0.2)",
                            }}
                          >
                            <p style={{ fontSize: 12, fontWeight: 700, color: "#1a3c34" }}>{d.name}</p>
                            <p style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                              {d.stock} {d.unit}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="stock" radius={[0, 6, 6, 0]} barSize={14}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {status.items.length > 0 && (
              <div className="flex flex-col divide-y divide-black/[0.05] border-t border-black/[0.05] pt-1">
                {status.items.slice(0, 4).map((it) => {
                  const isOut = it.stockQty <= 0;
                  return (
                    <div key={it.id} className="flex items-center justify-between gap-2 py-2">
                      <p className="truncate text-sm font-medium text-foreground">{it.name}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                          isOut ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {it.stockQty} {it.unit}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}