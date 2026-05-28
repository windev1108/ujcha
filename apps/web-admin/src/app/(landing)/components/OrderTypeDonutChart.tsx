"use client";

import { Card, CardContent } from "@heroui/react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { formatCompactCount } from "./dashboard-utils";
import type { AdminOverviewDashboard } from "@/services/admin/types";

const COLORS = {
  delivery: "#14532d",
  pickup: "#5a8f7a",
  table: "#d1d5db",
};

type Props = {
  data: AdminOverviewDashboard | undefined;
  isLoading: boolean;
};

export function OrderTypeDonutChart({ data, isLoading }: Props) {
  const share = data?.orderTypeShare;
  const chartData = share
    ? [
        { name: "Giao hàng", value: share.delivery.percent, color: COLORS.delivery },
        { name: "Mang đi", value: share.pickup.percent, color: COLORS.pickup },
        { name: "Tại bàn", value: share.table.percent, color: COLORS.table },
      ]
    : [];

  const total = share?.totalInRange ?? 0;

  if (isLoading) {
    return (
      <Card className="h-full min-h-[320px] rounded-2xl border border-black/[0.06] bg-white shadow-[0_12px_40px_-24px_rgba(0,0,0,0.15)]">
        <CardContent className="h-[300px] animate-pulse p-6" />
      </Card>
    );
  }

  return (
    <Card className="h-full min-h-[320px] rounded-2xl border border-black/[0.06] bg-white shadow-[0_12px_40px_-24px_rgba(0,0,0,0.15)]">
      <CardContent className="flex h-full flex-col gap-2 p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/45">
          Phân bổ loại đơn
        </p>
        <p className="text-xs text-foreground/50">30 ngày gần nhất (mọi trạng thái)</p>
        <div className="relative h-[220px] w-full min-h-[220px]">
          <ResponsiveContainer width="100%" height={220}>
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
                formatter={(value, name) => {
                  const n = typeof value === "number" ? value : Number(value);
                  const label = typeof name === "string" ? name : String(name ?? "");
                  return [`${Number.isFinite(n) ? n.toFixed(1) : "—"}%`, label];
                }}
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid rgba(0,0,0,0.06)",
                }}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                formatter={(value) => (
                  <span className="text-xs text-foreground/80">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-8">
            <div className="text-center">
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {formatCompactCount(total)}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/45">
                Đơn
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
