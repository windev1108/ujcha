"use client";

import { Button, Card, CardContent, Input, Switch } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, MapPin, RefreshCw, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { adminFieldStack, adminInputClass, adminLabelClass } from "@/lib/admin-form-classes";
import { adminKeys } from "@/services/admin/keys";
import { fetchShippingConfig, updateShippingConfig } from "@/services/admin/shipping-api";

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + "đ";
}

export function ShippingConfigClient() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: adminKeys.shippingConfig,
    queryFn: fetchShippingConfig,
  });

  const [isActive, setIsActive] = useState(true);
  const [baseFee, setBaseFee] = useState("15000");
  const [baseKm, setBaseKm] = useState("2");
  const [feePerKm, setFeePerKm] = useState("5000");
  const [maxDistanceKm, setMaxDistanceKm] = useState("15");
  const [freeThreshold, setFreeThreshold] = useState("200000");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) {
      setIsActive(data.isActive);
      setBaseFee(String(data.baseFee));
      setBaseKm(String(data.baseKm));
      setFeePerKm(String(data.feePerKm));
      setMaxDistanceKm(String(data.maxDistanceKm));
      setFreeThreshold(String(data.freeThreshold));
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: updateShippingConfig,
    onSuccess: (updated) => {
      qc.setQueryData(adminKeys.shippingConfig, updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  function handleSave() {
    mutation.mutate({
      isActive,
      baseFee: parseInt(baseFee) || 0,
      baseKm: parseFloat(baseKm) || 0,
      feePerKm: parseInt(feePerKm) || 0,
      maxDistanceKm: parseFloat(maxDistanceKm) || 1,
      freeThreshold: parseInt(freeThreshold) || 0,
    });
  }

  const previewFeeBase = parseInt(baseFee) || 0;
  const previewFeePerKm = parseInt(feePerKm) || 0;
  const previewBaseKm = parseFloat(baseKm) || 0;
  const previewFeeAt5km = previewFeeBase + Math.ceil(Math.max(0, 5 - previewBaseKm)) * previewFeePerKm;
  const previewFeeAt10km = previewFeeBase + Math.ceil(Math.max(0, 10 - previewBaseKm)) * previewFeePerKm;
  const previewFeeAt15km = previewFeeBase + Math.ceil(Math.max(0, 15 - previewBaseKm)) * previewFeePerKm;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          Cấu hình
        </p>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <Truck className="size-6 text-[#1a3c34]" />
          Phí vận chuyển
        </h1>
        <p className="text-sm text-foreground/55">
          Tính phí theo khoảng cách Haversine từ GPS khách hàng đến toạ độ quán (cấu hình trong HRM).
        </p>
      </div>

      <Card className="rounded-3xl border border-black/6 bg-white shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)]">
        <CardContent className="space-y-6 p-5 sm:p-6">

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-black/6 bg-neutral-50 px-4 py-3.5">
            <div>
              <p className="text-sm font-semibold text-foreground">Bật giao hàng</p>
              <p className="text-xs text-foreground/55">Tắt để tạm dừng dịch vụ giao hàng toàn bộ</p>
            </div>
            <Switch
              isSelected={isActive}
              onChange={setIsActive}
              isDisabled={isLoading || mutation.isPending}
            >
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className={adminFieldStack}>
              <label className={adminLabelClass}>Phí cơ bản (đ)</label>
              <Input
                type="number"
                min={0}
                value={baseFee}
                onChange={(e) => setBaseFee(e.target.value)}
                placeholder="15000"
                className={adminInputClass}
                disabled={isLoading || mutation.isPending}
              />
              <p className="text-[11px] text-foreground/45">Phí áp dụng trong phạm vi baseKm đầu tiên</p>
            </div>

            <div className={adminFieldStack}>
              <label className={adminLabelClass}>Km cơ bản (km)</label>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={baseKm}
                onChange={(e) => setBaseKm(e.target.value)}
                placeholder="2"
                className={adminInputClass}
                disabled={isLoading || mutation.isPending}
              />
              <p className="text-[11px] text-foreground/45">Không tính thêm trong phạm vi này</p>
            </div>

            <div className={adminFieldStack}>
              <label className={adminLabelClass}>Phí mỗi km thêm (đ/km)</label>
              <Input
                type="number"
                min={0}
                value={feePerKm}
                onChange={(e) => setFeePerKm(e.target.value)}
                placeholder="5000"
                className={adminInputClass}
                disabled={isLoading || mutation.isPending}
              />
              <p className="text-[11px] text-foreground/45">Phí cộng thêm cho mỗi km vượt baseKm</p>
            </div>

            <div className={adminFieldStack}>
              <label className={adminLabelClass}>Khoảng cách tối đa (km)</label>
              <Input
                type="number"
                min={1}
                step={0.5}
                value={maxDistanceKm}
                onChange={(e) => setMaxDistanceKm(e.target.value)}
                placeholder="15"
                className={adminInputClass}
                disabled={isLoading || mutation.isPending}
              />
              <p className="text-[11px] text-foreground/45">Đơn vượt quá khoảng cách này sẽ từ chối giao</p>
            </div>

            <div className={`${adminFieldStack} sm:col-span-2`}>
              <label className={adminLabelClass}>Miễn phí từ (đ)</label>
              <Input
                type="number"
                min={0}
                value={freeThreshold}
                onChange={(e) => setFreeThreshold(e.target.value)}
                placeholder="200000"
                className={adminInputClass}
                disabled={isLoading || mutation.isPending}
              />
              <p className="text-[11px] text-foreground/45">
                Đặt 0 để không có miễn phí. Đơn hàng ≥ mức này được miễn phí ship.
              </p>
            </div>
          </div>

          {/* Live preview */}
          <div className="rounded-2xl border border-dashed border-black/10 bg-neutral-50 p-4 space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground/55 uppercase tracking-wide">
              <MapPin className="size-3.5" />
              Xem trước phí
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "5 km", fee: previewFeeAt5km },
                { label: "10 km", fee: previewFeeAt10km },
                { label: "15 km", fee: previewFeeAt15km },
              ].map(({ label, fee }) => (
                <div key={label} className="rounded-xl border border-black/6 bg-white px-2 py-2.5">
                  <p className="text-[11px] text-foreground/55">{label}</p>
                  <p className="text-sm font-bold tabular-nums text-[#1a3c34]">{formatVnd(fee)}</p>
                </div>
              ))}
            </div>
            {parseInt(freeThreshold) > 0 && (
              <p className="text-[11px] text-foreground/55">
                Miễn phí với đơn ≥ {formatVnd(parseInt(freeThreshold) || 0)}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button
              className="flex h-11 items-center gap-2 rounded-full bg-[#1a3c34] px-6 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              isDisabled={mutation.isPending || isLoading}
              onPress={handleSave}
            >
              {mutation.isPending ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : saved ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <Truck className="size-4" />
              )}
              {mutation.isPending ? "Đang lưu..." : saved ? "Đã lưu!" : "Lưu cấu hình"}
            </Button>
            {mutation.isError && (
              <p className="text-sm text-red-600">Lưu thất bại. Vui lòng thử lại.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
