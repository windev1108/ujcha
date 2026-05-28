"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { TrendingUp, Receipt, ShoppingCart, Scale, type LucideIcon } from "lucide-react";
import { Card, CardContent, Text } from "@heroui/react";

import { adminKeys } from "@/services/admin/keys";
import { fetchTaxOverview } from "@/services/admin/taxes-api";
import { formatVnd } from "@/lib/product-display";
import { OrderDateRangePicker } from "@/app/orders/components/OrderDateRangePicker";

function todayStr() {
  const d = new Date(Date.now() + 7 * 3600_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  iconBg: string;
}) {
  return (
    <Card className="rounded-2xl border border-black/6 shadow-sm">
      <CardContent className="flex items-start gap-4 p-5">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className="size-5 text-white" />
        </div>
        <div className="min-w-0">
          <Text className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
            {label}
          </Text>
          <p className="mt-1 text-xl font-bold tabular-nums text-[#1a3c34]">{value}</p>
          {sub && (
            <Text className="mt-0.5 text-xs text-foreground/50">{sub}</Text>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function TaxOverviewTab() {
  const today = todayStr();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  const { data, isLoading } = useQuery({
    queryKey: adminKeys.taxOverview(from, to),
    queryFn: () => fetchTaxOverview({ from, to }),
  });

  const reconcileOk = data ? Math.abs(data.reconciliationDiff) < 1 : true;

  return (
    <div className="flex flex-col gap-6">
      {/* Date range */}
      <Card className="rounded-2xl border border-black/6 shadow-sm">
        <CardContent className="flex flex-wrap items-end gap-4 p-4 sm:p-5">
          <div className="w-96">
            <OrderDateRangePicker
              label="Khoảng thời gian"
              from={from}
              to={to}
              onRangeChange={(f, t) => { setFrom(f); setTo(t); }}
              className="w-full"
            />
          </div>
          {isLoading && (
            <Text className="text-xs italic text-foreground/40">Đang tải…</Text>
          )}
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Doanh thu (đã TT)"
          value={data ? formatVnd(data.totalRevenue) : "—"}
          sub={data ? `${data.paidCount} / ${data.totalCount} đơn đã thanh toán` : undefined}
          icon={TrendingUp}
          iconBg="bg-emerald-600"
        />
        <StatCard
          label="Thuế GTGT thu được"
          value={data ? formatVnd(data.totalVat) : "—"}
          sub={
            data && data.avgVatRate > 0
              ? `Trung bình ${data.avgVatRate.toFixed(2)}%`
              : "Chưa cấu hình VAT"
          }
          icon={Receipt}
          iconBg="bg-blue-600"
        />
        <StatCard
          label="Tổng đơn trong kỳ"
          value={data ? String(data.totalCount) : "—"}
          sub={data ? `${data.paidCount} đã thanh toán` : undefined}
          icon={ShoppingCart}
          iconBg="bg-violet-600"
        />
        <StatCard
          label="Thanh toán ghi nhận"
          value={data ? formatVnd(data.paymentsTotal) : "—"}
          sub={
            data
              ? `Chênh lệch: ${data.reconciliationDiff >= 0 ? "+" : ""}${formatVnd(data.reconciliationDiff)}`
              : undefined
          }
          icon={Scale}
          iconBg={reconcileOk ? "bg-emerald-600" : "bg-amber-500"}
        />
      </div>

      {/* Reconciliation banner */}
      {data && (
        <Card
          className={`rounded-2xl border ${reconcileOk ? "border-emerald-200/80 bg-emerald-50" : "border-amber-200/80 bg-amber-50"} shadow-sm`}
        >
          <CardContent className="px-5 py-4">
            <Text className={`text-sm ${reconcileOk ? "text-emerald-900" : "text-amber-900"}`}>
              <strong>Đối soát:</strong>{" "}
              Doanh thu đơn paid{" "}
              <strong>{formatVnd(data.totalRevenue)}</strong>{" "}
              — Thanh toán ghi nhận{" "}
              <strong>{formatVnd(data.paymentsTotal)}</strong>{" "}
              — Chênh lệch{" "}
              <strong className={reconcileOk ? "text-emerald-700" : "text-amber-700"}>
                {data.reconciliationDiff >= 0 ? "+" : ""}
                {formatVnd(data.reconciliationDiff)}
              </strong>
              .{" "}
              {reconcileOk
                ? "Số liệu khớp."
                : "Kiểm tra giao dịch chưa khớp trong tab Báo cáo."}
            </Text>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
