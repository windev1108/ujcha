"use client";

import { Button, Input, Label } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { ExternalLink, MapPin, Save } from "lucide-react";
import { useEffect, useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import {
  adminFieldStack,
  adminLabelClass,
} from "@/lib/admin-form-classes";
import { fetchStoreLocation, updateStoreLocation } from "@/services/admin/hrm-api";

function axiosMsg(e: unknown) {
  const err = e as AxiosError<{ message?: string | string[] }>;
  const m = err.response?.data?.message;
  if (typeof m === "string") return m;
  if (Array.isArray(m)) return m.join(", ");
  return err.message || "Có lỗi xảy ra.";
}

export function StoreLocationTab() {
  const qc = useQueryClient();
  const { showAlert } = useAppDialog();

  const locQ = useQuery({
    queryKey: ["admin", "hrm", "store-location"],
    queryFn: fetchStoreLocation,
  });

  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radius, setRadius] = useState("100");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (locQ.data) {
      setLat(String(locQ.data.lat));
      setLng(String(locQ.data.lng));
      setRadius(String(locQ.data.radiusMeters));
      setAddress(locQ.data.address ?? "");
      setPhone(locQ.data.phone ?? "");
    }
  }, [locQ.data]);

  const mut = useMutation({
    mutationFn: () =>
      updateStoreLocation({
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        radiusMeters: parseInt(radius, 10),
        address: address.trim(),
        phone: phone.trim() || undefined,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "hrm", "store-location"] });
      void showAlert("Đã lưu thông tin cửa hàng.", "Thành công");
    },
    onError: (e) => showAlert(axiosMsg(e), "Lỗi"),
  });

  const tryGetMyLocation = () => {
    if (!navigator.geolocation) {
      void showAlert("Trình duyệt không hỗ trợ Geolocation.", "Lỗi");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude));
        setLng(String(pos.coords.longitude));
      },
      () => void showAlert("Không lấy được vị trí.", "Lỗi"),
    );
  };

  const mapsPreviewUrl =
    lat && lng && parseFloat(lat) !== 0
      ? `https://www.google.com/maps?q=${lat},${lng}`
      : null;

  return (
    <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-[#1a3c34]/8">
          <MapPin className="size-5 text-[#1a3c34]" />
        </span>
        <div>
          <p className="font-semibold text-foreground">Vị trí & địa chỉ cửa hàng</p>
          <p className="text-xs text-foreground/55">
            Dùng để chấm công và hiển thị địa chỉ nhận hàng cho khách.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Địa chỉ văn bản */}
        <div className={adminFieldStack}>
          <Label className={adminLabelClass}>Địa chỉ cửa hàng</Label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="VD: 42 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh"
            rows={2}
            className="w-full rounded-xl border border-black/10 bg-[#fafafa] px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-[#1a3c34]/20"
          />
          <p className="text-[11px] text-foreground/45">
            Địa chỉ này hiển thị trên trang thanh toán (tab Nhận tại quán).
          </p>
        </div>

        {/* Số điện thoại cửa hàng */}
        <div className={adminFieldStack}>
          <Label className={adminLabelClass}>Số điện thoại cửa hàng</Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="VD: +84 969 782 408"
            type="tel"
            className="w-full rounded-xl border border-black/10 bg-[#fafafa] px-3 py-2 text-sm"
          />
          <p className="text-[11px] text-foreground/45">
            Hiển thị ở footer trang web và trang liên hệ.
          </p>
        </div>

        {/* Tọa độ + bán kính */}
        <div className="grid gap-5 sm:grid-cols-3">
          <div className={adminFieldStack}>
            <Label className={adminLabelClass}>Vĩ độ (Latitude)</Label>
            <Input
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="10.776530"
              className="w-full rounded-xl border border-black/10 bg-[#fafafa] px-3 py-2 text-sm"
            />
          </div>
          <div className={adminFieldStack}>
            <Label className={adminLabelClass}>Kinh độ (Longitude)</Label>
            <Input
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="106.700981"
              className="w-full rounded-xl border border-black/10 bg-[#fafafa] px-3 py-2 text-sm"
            />
          </div>
          <div className={adminFieldStack}>
            <Label className={adminLabelClass}>Bán kính (mét)</Label>
            <Input
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              placeholder="100"
              type="number"
              min={10}
              max={5000}
              className="w-full rounded-xl border border-black/10 bg-[#fafafa] px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="rounded-xl border-black/15 text-sm"
          onPress={tryGetMyLocation}
        >
          <MapPin className="mr-2 size-4" />
          Dùng vị trí hiện tại của tôi
        </Button>

        {mapsPreviewUrl && (
          <a
            href={mapsPreviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-black/15 bg-white px-4 py-2 text-sm font-medium text-foreground/70 hover:bg-surface-secondary"
          >
            <ExternalLink className="size-4" />
            Xem trên bản đồ
          </a>
        )}

        <Button
          className="rounded-xl bg-[#1a3c34] font-semibold text-white"
          onPress={() => mut.mutate()}
          isDisabled={mut.isPending || !lat || !lng}
        >
          <Save className="mr-2 size-4" />
          {mut.isPending ? "Đang lưu…" : "Lưu"}
        </Button>
      </div>

      {locQ.data && locQ.data.lat !== 0 && (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-2 text-xs text-emerald-800">
          Tọa độ: <strong>{locQ.data.lat}, {locQ.data.lng}</strong> · Bán kính{" "}
          <strong>{locQ.data.radiusMeters}m</strong>
          {locQ.data.address && (
            <> · <strong>{locQ.data.address}</strong></>
          )}
        </p>
      )}
    </div>
  );
}
