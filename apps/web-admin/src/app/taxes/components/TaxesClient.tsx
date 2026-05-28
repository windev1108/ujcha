"use client";

import { Button } from "@heroui/react";
import { useState } from "react";

import { useAuthStore } from "@/store/auth-store";

import { TaxOverviewTab } from "./TaxOverviewTab";
import { TaxTransactionsTab } from "./TaxTransactionsTab";
import { VatSettingsTab } from "./VatSettingsTab";
import { TaxReportsTab } from "./TaxReportsTab";
import { TaxExportTab } from "./TaxExportTab";

export type TaxTabId = "overview" | "transactions" | "vat-settings" | "reports" | "export";

export function TaxesClient() {
  const role = useAuthStore((s) => s.admin?.role);
  const isSuper = role === "super_admin";

  const [tab, setTab] = useState<TaxTabId>("overview");

  const tabs: { id: TaxTabId; label: string; superOnly?: boolean }[] = [
    { id: "overview", label: "Tổng quan" },
    { id: "transactions", label: "Giao dịch" },
    { id: "vat-settings", label: "Cấu hình VAT", superOnly: true },
    { id: "reports", label: "Báo cáo" },
    { id: "export", label: "Xuất dữ liệu" },
  ];

  const visibleTabs = tabs.filter((t) => !t.superOnly || isSuper);

  return (
    <div className="flex flex-col gap-8 pb-24">
      <header className="flex flex-col gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
          Kế toán &amp; Thuế
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-[#1a3c34] sm:text-3xl">
          Quản lý thuế GTGT
        </h1>
        <p className="max-w-2xl text-sm text-foreground/55">
          Theo dõi thuế GTGT theo cấu hình VAT; giá trị lưu tại thời điểm tạo đơn — không tính lại.
          Xuất CSV cho kế toán và chuẩn bị hoá đơn điện tử.
        </p>
      </header>

      {!isSuper && (
        <p className="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Bạn đang xem với quyền <strong>Staff</strong>: chỉ xem báo cáo &amp; xuất dữ liệu.
          Cấu hình VAT cần <strong>Super Admin</strong>.
        </p>
      )}

      <div className="flex flex-wrap gap-2 border-b border-black/8 pb-1">
        {visibleTabs.map((t) => (
          <Button
            key={t.id}
            type="button"
            size="sm"
            variant={tab === t.id ? "primary" : "ghost"}
            className={
              tab === t.id
                ? "rounded-full bg-[#1a3c34] font-semibold text-white"
                : "rounded-full text-foreground/75"
            }
            onPress={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "overview" && <TaxOverviewTab />}
      {tab === "transactions" && <TaxTransactionsTab />}
      {tab === "vat-settings" && isSuper && <VatSettingsTab />}
      {tab === "reports" && <TaxReportsTab />}
      {tab === "export" && <TaxExportTab />}
    </div>
  );
}
