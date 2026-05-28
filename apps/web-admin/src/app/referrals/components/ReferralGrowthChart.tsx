"use client";

import { Card, CardContent, ListBox, Select } from "@heroui/react";
import { useMemo, useState } from "react";
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

import {
  adminSelectTriggerCompactClass,
  adminSelectValueCompactClass,
} from "@/lib/admin-form-classes";
import type { AdminReferralDashboard } from "@/services/admin/types";

const WD_VI = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const forest = "#14532d";
const grid = "rgba(0,0,0,0.06)";

type Period = "7d" | "30d";

type Props = {
  data: AdminReferralDashboard | undefined;
  isLoading: boolean;
};

export function ReferralGrowthChart({ data, isLoading }: Props) {
  const [period, setPeriod] = useState<Period>("30d");

  const chartData = useMemo(() => {
    const series = data?.referralSignupsByDay ?? [];
    const slice = period === "7d" ? series.slice(-7) : series;
    const maxCount = slice.reduce((m, d) => Math.max(m, d.count), 0);
    return slice.map((d, i) => {
      const dt = new Date(`${d.date}T12:00:00.000Z`);
      const label =
        period === "7d"
          ? WD_VI[dt.getUTCDay()]
          : dt.toLocaleDateString("vi-VN", {
              day: "2-digit",
              month: "2-digit",
            });
      const isPeak = maxCount > 0 && d.count === maxCount;
      return {
        label,
        count: d.count,
        fill: isPeak ? forest : "rgba(0,0,0,0.08)",
        key: `${d.date}-${i}`,
      };
    });
  }, [data?.referralSignupsByDay, period]);

  if (isLoading) {
    return (
      <Card className="min-h-[320px] rounded-2xl border border-black/[0.06] bg-white shadow-[0_12px_40px_-24px_rgba(0,0,0,0.15)]">
        <CardContent className="h-[320px] animate-pulse p-6" />
      </Card>
    );
  }

  return (
    <Card className="min-h-[320px] rounded-2xl border border-black/[0.06] bg-white shadow-[0_12px_40px_-24px_rgba(0,0,0,0.15)]">
      <CardContent className="flex h-full flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/45">
              Biểu đồ tăng trưởng
            </p>
            <p className="mt-1 text-sm text-foreground/60">
              Lượt đăng ký có mã giới thiệu —{" "}
              {period === "7d" ? "7 ngày gần nhất" : "30 ngày gần nhất"} (UTC)
            </p>
          </div>
          <Select
            className="w-[200px]"
            aria-label="Khoảng thời gian biểu đồ"
            value={period}
            onChange={(key) => {
              if (key === "7d" || key === "30d") setPeriod(key);
            }}
            variant="secondary"
          >
            <Select.Trigger className={adminSelectTriggerCompactClass}>
              <Select.Value className={adminSelectValueCompactClass} />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover placement="bottom end">
              <ListBox className="min-w-(--trigger-width) outline-none">
                <ListBox.Item
                  id="30d"
                  textValue="30 ngày"
                  className="rounded-lg text-sm"
                >
                  Tháng này (30 ngày)
                </ListBox.Item>
                <ListBox.Item
                  id="7d"
                  textValue="7 ngày"
                  className="rounded-lg text-sm"
                >
                  7 ngày
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        <div className="h-[240px] w-full min-h-[240px]">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke={grid} vertical={false} strokeDasharray="0" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                dy={8}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                width={36}
              />
              <Tooltip
                cursor={{ fill: "rgba(0,0,0,0.03)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0]?.payload as {
                    label: string;
                    count: number;
                  };
                  return (
                    <div className="rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-xs shadow-md">
                      <p className="font-semibold text-foreground">{p.label}</p>
                      <p className="text-foreground/70">{p.count} lượt</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={36}>
                {chartData.map((entry) => (
                  <Cell key={entry.key} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
