// @/app/admin/store/components/StoreHoursTab.tsx — thay toàn bộ nội dung (bỏ toggle isManuallyClosed cũ)
"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { AlarmClock, Ban, CheckCircle2, Flame, Save } from "lucide-react";
import { Button, Input, Label, TextArea } from "@heroui/react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import { adminFieldStack, adminLabelClass } from "@/lib/admin-form-classes";
import {
  fetchStoreStatusConfig,
  updateStoreStatusConfig,
  type StoreOperationStatus,
} from "@/services/admin/store-api";

function axiosMsg(e: unknown) {
  const err = e as AxiosError<{ message?: string | string[] }>;
  const m = err.response?.data?.message;
  if (typeof m === "string") return m;
  if (Array.isArray(m)) return m.join(", ");
  return (err as Error).message || "Có lỗi xảy ra.";
}

const STATUS_KEY = ["admin", "store", "status"];

const STATUS_OPTIONS: {
  id: StoreOperationStatus;
  label: string;
  desc: string;
  icon: typeof CheckCircle2;
  activeCls: string;
}[] = [
  {
    id: "opening",
    label: "Mở cửa bình thường",
    desc: "Chạy theo khung giờ tự động bên dưới.",
    icon: CheckCircle2,
    activeCls: "border-emerald-400 bg-emerald-50 text-emerald-700",
  },
  {
    id: "busy",
    label: "Đông khách",
    desc: "Vẫn nhận đơn, chỉ cảnh báo khách đơn có thể chậm.",
    icon: Flame,
    activeCls: "border-amber-400 bg-amber-50 text-amber-700",
  },
  {
    id: "closed",
    label: "Tạm ngừng nhận đơn",
    desc: "Chặn đặt hàng ngay lập tức, bất kể giờ giấc.",
    icon: Ban,
    activeCls: "border-red-400 bg-red-50 text-red-700",
  },
];

function toHHmm(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function fromHHmm(value: string) {
  const [h, m] = value.split(":").map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}

export function StoreHoursTab() {
  const qc = useQueryClient();
  const { showAlert } = useAppDialog();

  const { data, isLoading } = useQuery({ queryKey: STATUS_KEY, queryFn: fetchStoreStatusConfig });

  const [openTime, setOpenTime] = useState("07:00");
  const [closeTime, setCloseTime] = useState("22:00");
  const [status, setStatus] = useState<StoreOperationStatus>("opening");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!data) return;
    setOpenTime(toHHmm(data.openMinutes));
    setCloseTime(toHHmm(data.closeMinutes));
    setStatus(data.status);
    setReason(data.statusReason ?? "");
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () =>
      updateStoreStatusConfig({
        openMinutes: fromHHmm(openTime),
        closeMinutes: fromHHmm(closeTime),
        status,
        statusReason: reason.trim(),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: STATUS_KEY });
      await qc.invalidateQueries({ queryKey: ["store", "location"] });
      await qc.invalidateQueries({ queryKey: ["store", "status"] }); // đồng bộ modal FE user ngay
    },
    onError: (e) => void showAlert(axiosMsg(e), "Lỗi"),
  });

  return (
    <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-[#1a3c34]/8">
          <AlarmClock className="size-5 text-[#1a3c34]" />
        </span>
        <div>
          <p className="font-semibold text-foreground">Giờ mở cửa & trạng thái quán</p>
          <p className="text-xs text-foreground/55">
            Áp dụng riêng cho web đặt hàng — độc lập với lịch ca làm HRM.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-foreground/40">Đang tải…</div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={adminFieldStack}>
              <Label className={adminLabelClass}>Giờ mở cửa</Label>
              <Input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} />
            </div>
            <div className={adminFieldStack}>
              <Label className={adminLabelClass}>Giờ đóng cửa</Label>
              <Input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
            </div>
          </div>
          <p className="-mt-3 text-xs text-foreground/45">
            Hỗ trợ khung giờ qua đêm (VD: mở 18:00, đóng 02:00). Mở = đóng nghĩa là mở 24/24.
          </p>

          <div className={adminFieldStack}>
            <Label className={adminLabelClass}>Trạng thái vận hành</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {STATUS_OPTIONS.map(({ id, label, desc, icon: Icon, activeCls }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setStatus(id)}
                  className={`flex flex-col items-start gap-1.5 rounded-2xl border-2 px-4 py-3 text-left transition-colors ${
                    status === id ? activeCls : "border-black/10 bg-white text-foreground/60 hover:bg-black/4"
                  }`}
                >
                  <Icon className="size-4" />
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="text-xs opacity-70">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {status !== "opening" && (
            <div className={adminFieldStack}>
              <Label className={adminLabelClass}>
                Lý do hiển thị cho khách {status === "busy" ? "(khuyến khích)" : "(tuỳ chọn)"}
              </Label>
              <TextArea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={300}
                placeholder={
                  status === "busy"
                    ? "VD: Quán đang đông, đơn có thể chậm khoảng 20-30 phút."
                    : "VD: Quán tạm nghỉ lễ, mở lại vào 8h sáng mai."
                }
                rows={3}
              />
            </div>
          )}

          <Button
            className="rounded-xl bg-[#1a3c34] font-semibold text-white"
            onPress={() => saveMut.mutate()}
            isDisabled={saveMut.isPending}
          >
            <Save className="mr-2 size-4" />
            Lưu cấu hình
          </Button>
        </div>
      )}
    </div>
  );
}