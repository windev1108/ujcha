"use client";

import { useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { formatVnd } from "@/lib/product-display";
import type { FinanceDayPoint, FinanceHourRow } from "@/services/admin/types";
import { Empty, Panel, Segmented, Skeleton } from "@/components/common/FinanceModule";
import { fmtDay, shortVnd } from "@/lib/finance-utils";

const grid = "rgba(0,0,0,0.06)";
const tick = { fill: "var(--muted)", fontSize: 11 };
const tipBox = {
  borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", background: "#fff",
  padding: "10px 14px", boxShadow: "0 12px 40px -20px rgba(0,0,0,0.2)",
} as const;

export function DailyTrendChart({ daily }: { daily?: FinanceDayPoint[] }) {
  return (
    <Panel
      eyebrow="Diễn biến theo ngày"
      hint="Tổng thu (cột) và lợi nhuận gộp trên phần đã có giá vốn (đường)"
      right={
        <div className="flex items-center gap-3 text-[11px] text-foreground/55">
          <span className="flex items-center gap-1"><i className="size-2 rounded-sm bg-[#5a8f7a]" />Tổng thu</span>
          <span className="flex items-center gap-1"><i className="size-2 rounded-sm bg-[#d97706]" />Lợi nhuận</span>
        </div>
      }
    >
      {!daily ? <Skeleton h={300} /> : daily.every((d) => d.orders === 0) ? (
        <Empty h={200}>Chưa có đơn đã thanh toán trong khoảng thời gian này.</Empty>
      ) : (
        <div className="h-[300px] w-full min-h-[300px]">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={grid} vertical={false} />
              <XAxis dataKey="date" tickFormatter={fmtDay} axisLine={false} tickLine={false} tick={tick} minTickGap={24} />
              <YAxis axisLine={false} tickLine={false} tick={tick} width={48} tickFormatter={shortVnd} />
              <Tooltip
                cursor={{ fill: "rgba(0,0,0,0.03)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as FinanceDayPoint;
                  return (
                    <div style={tipBox}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#1a3c34" }}>{fmtDay(d.date)} · {d.orders} đơn</p>
                      <p style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Tổng thu: {formatVnd(d.totalCollected)}</p>
                      <p style={{ fontSize: 11, color: "#6b7280" }}>Giá vốn: {formatVnd(d.cogs)}</p>
                      <p style={{ fontSize: 11, color: d.grossProfit < 0 ? "#dc2626" : "#047857" }}>Lợi nhuận: {formatVnd(d.grossProfit)}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="totalCollected" fill="#5a8f7a" radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Line dataKey="grossProfit" type="monotone" stroke="#d97706" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

export function HourlyChart({ byHour }: { byHour?: FinanceHourRow[] }) {
  const [metric, setMetric] = useState<"orders" | "totalCollected">("orders");
  const peak = byHour ? Math.max(...byHour.map((h) => h[metric]), 0) : 0;

  return (
    <Panel
      eyebrow="Khung giờ cao điểm"
      hint="Giờ Việt Nam (UTC+7)"
      right={<Segmented value={metric} onChange={setMetric} options={[["orders", "Số đơn"], ["totalCollected", "Doanh thu"]]} />}
    >
      {!byHour ? <Skeleton h={220} /> : peak === 0 ? (
        <Empty h={160}>Chưa có dữ liệu.</Empty>
      ) : (
        <div className="h-[220px] w-full min-h-[220px]">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byHour} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={grid} vertical={false} />
              <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} axisLine={false} tickLine={false} tick={tick} interval={1} />
              <YAxis axisLine={false} tickLine={false} tick={tick} width={40}
                tickFormatter={(v) => (metric === "orders" ? String(v) : shortVnd(v))} />
              <Tooltip
                cursor={{ fill: "rgba(0,0,0,0.03)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as FinanceHourRow;
                  return (
                    <div style={tipBox}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#1a3c34" }}>{d.hour}h – {d.hour + 1}h</p>
                      <p style={{ fontSize: 12, color: "#6b7280" }}>{d.orders} đơn · {formatVnd(d.totalCollected)}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey={metric} radius={[4, 4, 0, 0]} maxBarSize={18}>
                {byHour.map((h) => (
                  <Cell key={h.hour} fill={h[metric] === peak ? "#d97706" : "#1a3c34"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}