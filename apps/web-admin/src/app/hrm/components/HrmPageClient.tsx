"use client";

import { useState } from "react";
import { ClipboardList, Clock, LucideIcon, MapPin, Users2 } from "lucide-react";

import { AttendanceTab } from "./AttendanceTab";
import { ShiftConfigTab } from "./ShiftConfigTab";
import { StoreLocationTab } from "./StoreLocationTab";
import { StaffTab } from "./StaffTab";

type Tab = "staff" | "attendance" | "shift" | "location";

type TabItem = {
  id: Tab;
  label: string;
  icon: LucideIcon;
};

const TABS: TabItem[] = [
  { id: "staff", label: "Nhân viên", icon: Users2 },
  { id: "attendance", label: "Chấm công", icon: ClipboardList },
  { id: "shift", label: "Ca làm việc", icon: Clock },
  { id: "location", label: "Vị trí cửa hàng", icon: MapPin },
];

export function HrmPageClient() {
  const [tab, setTab] = useState<Tab>("staff");

  return (
    <div className="flex flex-col gap-6 pb-16">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
          Vận hành
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1a3c34] sm:text-3xl">
          Quản lý nhân sự (HRM)
        </h1>
        <p className="mt-2 text-sm text-foreground/55">
          Quản lý tài khoản, nhận diện khuôn mặt, chấm công và vị trí cửa hàng.
        </p>
      </header>

      <div className="flex gap-1 rounded-2xl border border-black/6 bg-white p-1 shadow-sm">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${tab === id
              ? "bg-[#1a3c34] text-white shadow"
              : "text-foreground/60 hover:bg-black/4 hover:text-foreground"
              }`}
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {tab === "staff" && <StaffTab />}
      {tab === "attendance" && <AttendanceTab />}
      {tab === "shift" && <ShiftConfigTab />}
      {tab === "location" && <StoreLocationTab />}
    </div>
  );
}
