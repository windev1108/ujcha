"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Save } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchShiftConfig, updateShiftConfig } from "@/services/admin/hrm-api";
import { minutesToTimeStr, timeStrToMinutes } from "@/lib/shift-utils";

export function ShiftConfigTab() {
  const qc = useQueryClient();

  const configQ = useQuery({
    queryKey: ["admin", "hrm", "shift-config"],
    queryFn: fetchShiftConfig,
  });

  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("17:00");
  const [tolerance, setTolerance] = useState("0");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (configQ.data) {
      setStart(minutesToTimeStr(configQ.data.startMinutes));
      setEnd(minutesToTimeStr(configQ.data.endMinutes));
      setTolerance(String(configQ.data.toleranceMinutes));
    }
  }, [configQ.data]);

  const mut = useMutation({
    mutationFn: updateShiftConfig,
    onSuccess: async (data) => {
      qc.setQueryData(["admin", "hrm", "shift-config"], data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mut.mutate({
      startMinutes: timeStrToMinutes(start),
      endMinutes: timeStrToMinutes(end),
      toleranceMinutes: Math.max(0, parseInt(tolerance, 10) || 0),
    });
  };

  const startMins = timeStrToMinutes(start);
  const endMins = timeStrToMinutes(end);
  const durationMins = endMins > startMins ? endMins - startMins : 0;
  const durationH = Math.floor(durationMins / 60);
  const durationM = durationMins % 60;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <Clock className="size-5 text-[#1a3c34]" />
          <h2 className="text-base font-semibold text-[#1a3c34]">Cấu hình ca làm việc</h2>
        </div>

        {configQ.isLoading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-xl bg-black/5" />
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="grid gap-5 sm:grid-cols-3">
              {/* Start time */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                  Giờ vào làm
                </label>
                <input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="rounded-xl border border-black/10 bg-[#f8faf9] px-4 py-2.5 text-sm font-semibold text-foreground focus:border-[#1a3c34] focus:outline-none"
                />
              </div>

              {/* End time */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                  Giờ tan làm
                </label>
                <input
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="rounded-xl border border-black/10 bg-[#f8faf9] px-4 py-2.5 text-sm font-semibold text-foreground focus:border-[#1a3c34] focus:outline-none"
                />
              </div>

              {/* Tolerance */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                  Biên độ (phút)
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={tolerance}
                  onChange={(e) => setTolerance(e.target.value)}
                  placeholder="0"
                  className="rounded-xl border border-black/10 bg-[#f8faf9] px-4 py-2.5 text-sm font-semibold text-foreground focus:border-[#1a3c34] focus:outline-none"
                />
              </div>
            </div>

            {/* Summary */}
            {durationMins > 0 && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Ca làm <strong>{start}</strong> – <strong>{end}</strong>
                {" · "}
                {durationH > 0 && `${durationH} giờ `}{durationM > 0 && `${durationM} phút`}
                {parseInt(tolerance, 10) > 0 && ` · Biên độ ±${tolerance} phút`}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={mut.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1a3c34] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Save className="size-4" />
                {mut.isPending ? "Đang lưu…" : "Lưu cấu hình"}
              </button>
              {saved && (
                <span className="text-sm font-medium text-emerald-600">Đã lưu ✓</span>
              )}
              {mut.isError && (
                <span className="text-sm text-red-600">Lỗi lưu cấu hình.</span>
              )}
            </div>
          </form>
        )}
      </div>

      {/* Info card */}
      <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-foreground/70">Cách tính trạng thái</h3>
        <div className="flex flex-col gap-2 text-[13px] text-foreground/60">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">Trễ X phút</span>
            <span>Check-in sau giờ vào làm + biên độ</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Sớm X phút</span>
            <span>Check-in trước giờ vào làm</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Đúng giờ</span>
            <span>Check-in trong biên độ cho phép</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Về sớm X phút</span>
            <span>Check-out trước giờ tan làm - biên độ</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">OT +X phút</span>
            <span>Check-out sau giờ tan làm</span>
          </div>
        </div>
      </div>
    </div>
  );
}
