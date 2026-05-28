"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import {
  fetchAttendanceToday,
  fetchMyFaceProfile,
  fetchShiftConfig,
  fetchStoreLocation,
  postCheckin,
  postCheckout,
} from "@/services/admin/hrm-api";
import { useAuthStore } from "@/store/auth-store";
import { AttendanceStatus } from "./AttendanceStatus";

const FaceCamera = dynamic(() => import("./FaceCamera").then((m) => m.FaceCamera), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center rounded-2xl bg-black/4 text-sm text-foreground/50">
      Đang tải camera…
    </div>
  ),
});

function axiosMsg(e: unknown) {
  const err = e as AxiosError<{ message?: string | string[] }>;
  const m = err.response?.data?.message;
  if (typeof m === "string") return m;
  if (Array.isArray(m)) return m.join(", ");
  return err.message || "Có lỗi xảy ra.";
}

type ActionType = "checkin" | "checkout";

export function AttendanceClient() {
  const admin = useAuthStore((s) => s.admin);
  const qc = useQueryClient();

  const [action, setAction] = useState<ActionType>("checkin");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const todayQ = useQuery({
    queryKey: ["admin", "hrm", "attendance", "today"],
    queryFn: fetchAttendanceToday,
    refetchInterval: 30_000,
  });

  const profileQ = useQuery({
    queryKey: ["admin", "hrm", "my-face-profile"],
    queryFn: fetchMyFaceProfile,
  });

  const locationQ = useQuery({
    queryKey: ["admin", "hrm", "store-location"],
    queryFn: fetchStoreLocation,
  });

  const shiftQ = useQuery({
    queryKey: ["admin", "hrm", "shift-config"],
    queryFn: fetchShiftConfig,
  });

  const today = todayQ.data;
  const lastType = today?.lastType ?? null;

  // canCheckin = not currently clocked in; canCheckout = currently clocked in
  const canCheckin = lastType !== "checkin";
  const canCheckout = lastType === "checkin";

  // Keep action toggle in sync with current state
  useEffect(() => {
    if (canCheckout) setAction("checkout");
    else setAction("checkin");
  }, [canCheckout]);

  const checkinMut = useMutation({
    mutationFn: postCheckin,
    onSuccess: async () => {
      setSuccess("Check-in thành công! ✓");
      setError(null);
      await qc.invalidateQueries({ queryKey: ["admin", "hrm", "attendance", "today"] });
    },
    onError: (e) => {
      setError(axiosMsg(e));
      setSuccess(null);
    },
  });

  const checkoutMut = useMutation({
    mutationFn: postCheckout,
    onSuccess: async () => {
      setSuccess("Check-out thành công! ✓");
      setError(null);
      await qc.invalidateQueries({ queryKey: ["admin", "hrm", "attendance", "today"] });
    },
    onError: (e) => {
      setError(axiosMsg(e));
      setSuccess(null);
    },
  });

  const isMutPending = checkinMut.isPending || checkoutMut.isPending;

  const hasFaceProfile = !!profileQ.data;
  const storeConfigured = !!locationQ.data && (locationQ.data.lat !== 0 || locationQ.data.lng !== 0);

  const handleCapture = (descriptor: number[]): Promise<void> => {
    setError(null);
    setSuccess(null);

    return new Promise<void>((resolve) => {
      const geoPromise = new Promise<GeolocationCoordinates | null>((res) => {
        if (!navigator.geolocation) { res(null); return; }
        navigator.geolocation.getCurrentPosition(
          (p) => res(p.coords),
          () => res(null),
          { enableHighAccuracy: true, timeout: 8000 },
        );
      });

      void geoPromise.then((coords) => {
        if (!coords) {
          setError("Không lấy được vị trí GPS. Hãy bật Location trên trình duyệt.");
          resolve();
          return;
        }

        const body = { lat: coords.latitude, lng: coords.longitude, descriptor };
        if (action === "checkin") {
          checkinMut.mutate(body, { onSettled: () => resolve() });
        } else {
          checkoutMut.mutate(body, { onSettled: () => resolve() });
        }
      });
    });
  };

  const displayName = admin?.name ?? admin?.email?.split("@")[0];

  return (
    <div className="flex flex-col gap-5 pb-16">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
          Nhân sự
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1a3c34] sm:text-3xl">
          Chấm công
        </h1>
        <p className="mt-1 text-sm text-foreground/55">
          Xin chào, <strong>{displayName}</strong>
        </p>
      </header>

      {/* Today sessions — always visible */}
      <AttendanceStatus
        today={today}
        isLoading={todayQ.isLoading}
        faceImageUrl={profileQ.data?.imageUrl}
        shiftConfig={shiftQ.data}
      />

      {/* Prerequisite warnings — informational only, do not block camera */}
      {!profileQ.isLoading && !hasFaceProfile && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          Nhận diện khuôn mặt của bạn chưa được đăng ký. Liên hệ Super Admin để cấu hình.
        </div>
      )}
      {!locationQ.isLoading && !storeConfigured && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          Vị trí cửa hàng chưa được cấu hình. Liên hệ Super Admin.
        </div>
      )}

      {/* Action toggle */}
      {!todayQ.isLoading && (
        <div className="flex gap-1 rounded-2xl border border-black/6 bg-white p-1">
          {(["checkin", "checkout"] as ActionType[]).map((a) => {
            const isDisabled = a === "checkin" ? !canCheckin : !canCheckout;
            return (
              <button
                key={a}
                onClick={() => { if (!isDisabled) { setAction(a); setError(null); setSuccess(null); } }}
                disabled={isDisabled}
                className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                  action === a && !isDisabled
                    ? "bg-[#1a3c34] text-white shadow"
                    : "text-foreground/60 hover:bg-black/4 hover:text-foreground"
                }`}
              >
                {a === "checkin" ? "Check-in" : "Check-out"}
              </button>
            );
          })}
        </div>
      )}

      {/* Camera — mounted immediately so browser requests permission right away */}
      <FaceCamera
        onCapture={handleCapture}
        isProcessing={isMutPending}
        actionLabel={action === "checkin" ? "Check-in ngay" : "Check-out ngay"}
      />

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800">
          {success}
        </div>
      )}
    </div>
  );
}
