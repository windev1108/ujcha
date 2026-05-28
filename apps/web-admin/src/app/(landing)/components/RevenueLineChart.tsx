"use client";

import { Card, CardContent } from "@heroui/react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatVnd } from "@/lib/product-display";
import type { AdminOverviewDashboard } from "@/services/admin/types";

const forest = "#14532d";
const grid = "rgba(0,0,0,0.06)";

type Props = {
  data: AdminOverviewDashboard | undefined;
  isLoading: boolean;
};

export function RevenueLineChart({ data, isLoading }: Props) {
  const chartData =
    data?.revenueByDay.map((d) => ({
      day: new Date(d.date + "T12:00:00.000Z").toLocaleDateString("vi-VN", {
        weekday: "short",
      }),
      revenue: d.revenue,
      systemRevenue: d.systemRevenue,
      platformRevenue: d.platformRevenue,
    })) ?? [];

  if (isLoading) {
    return (
      <Card className="h-full min-h-[320px] rounded-2xl border border-black/[0.06] bg-white shadow-[0_12px_40px_-24px_rgba(0,0,0,0.15)]">
        <CardContent className="h-[320px] animate-pulse p-6" />
      </Card>
    );
  }

  return (
    <Card className="h-full min-h-[320px] rounded-2xl border border-black/[0.06] bg-white shadow-[0_12px_40px_-24px_rgba(0,0,0,0.15)]">
      <CardContent className="flex h-full flex-col gap-4 p-5 sm:p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/45">
            Doanh thu theo ngày
          </p>
          <p className="mt-1 text-sm text-foreground/60">
            7 ngày gần nhất — đơn đã thanh toán + doanh thu đối tác (nếu đã sync)
          </p>
        </div>

        <div className="h-[240px] w-full min-h-[240px]">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke={grid} vertical={false} strokeDasharray="0" />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                tickFormatter={(v) => {
                  const n = Number(v);
                  if (!Number.isFinite(n)) return "—";
                  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
                  if (n >= 1000) return `${Math.round(n / 1000)}k`;
                  return String(n);
                }}
                width={44}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid rgba(0,0,0,0.06)",
                  boxShadow: "0 12px 40px -20px rgba(0,0,0,0.2)",
                  fontSize: 12,
                }}
                labelStyle={{ fontSize: 11, color: "var(--muted)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload as { revenue: number; systemRevenue?: number; platformRevenue?: number };
                  const hasPlatform = d.platformRevenue && d.platformRevenue > 0;
                  return (
                    <div style={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", background: "#fff", padding: "10px 14px", boxShadow: "0 12px 40px -20px rgba(0,0,0,0.2)" }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#1a3c34" }}>{formatVnd(d.revenue)}</p>
                      {hasPlatform && d.systemRevenue !== undefined && (
                        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
                          <p style={{ fontSize: 11, color: "#6b7280" }}>Quán: {formatVnd(d.systemRevenue)}</p>
                          <p style={{ fontSize: 11, color: "#15803d" }}>Đối tác: {formatVnd(d.platformRevenue!)}</p>
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke={forest}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: forest, stroke: "#fff", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
