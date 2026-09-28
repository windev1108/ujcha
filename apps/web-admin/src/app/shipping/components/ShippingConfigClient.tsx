"use client";

import { Button, Card, CardContent, Input, Switch } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bike, CheckCircle2, CloudRain, MapPin, Plus, RefreshCw, Trash2, Truck, Wind } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { adminFieldStack, adminInputClass, adminLabelClass } from "@/lib/admin-form-classes";
import { adminKeys } from "@/services/admin/keys";
import {
  fetchShippingConfig,
  refreshShippingWeather,
  updateShippingConfig,
  type WeatherTier,
} from "@/services/admin/shipping-api";

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + "đ";
}

type TierForm = { label: string; minValue: string; fee: string };

const toForm = (tiers: WeatherTier[] = []): TierForm[] =>
  tiers.map((t) => ({ label: t.label, minValue: String(t.minValue), fee: String(t.fee) }));

const fromForm = (rows: TierForm[]): WeatherTier[] =>
  rows
    .map((r) => ({
      label: r.label.trim() || "Mức",
      minValue: parseFloat(r.minValue),
      fee: parseInt(r.fee) || 0,
    }))
    .filter((t) => Number.isFinite(t.minValue) && t.minValue > 0)
    .sort((a, b) => a.minValue - b.minValue);

function TierEditor({
  title,
  icon,
  unit,
  rows,
  onChange,
  disabled,
}: {
  title: string;
  icon: ReactNode;
  unit: string;
  rows: TierForm[];
  onChange: (rows: TierForm[]) => void;
  disabled?: boolean;
}) {
  const update = (i: number, patch: Partial<TierForm>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground/70">
          {icon}
          {title}
        </p>
        <Button
          className="flex h-8 items-center gap-1 rounded-full border border-black/10 bg-white px-3 text-xs font-medium text-foreground"
          isDisabled={disabled}
          onPress={() => onChange([...rows, { label: "", minValue: "", fee: "" }])}
        >
          <Plus className="size-3.5" />
          Thêm mốc
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-[11px] text-foreground/45">Chưa có mốc — không tính phụ phí theo mục này.</p>
      ) : (
        <>
          <div className="grid grid-cols-[1fr_88px_96px_32px] gap-2 text-[10px] font-semibold uppercase tracking-wide text-foreground/45">
            <span>Tên mốc</span>
            <span>Từ ({unit})</span>
            <span>Phụ phí (đ)</span>
            <span />
          </div>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_88px_96px_32px] items-center gap-2">
              <Input
                value={r.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Mưa to"
                className={adminInputClass}
                disabled={disabled}
              />
              <Input
                type="number"
                min={0}
                step={0.1}
                value={r.minValue}
                onChange={(e) => update(i, { minValue: e.target.value })}
                className={adminInputClass}
                disabled={disabled}
              />
              <Input
                type="number"
                min={0}
                step={500}
                value={r.fee}
                onChange={(e) => update(i, { fee: e.target.value })}
                className={adminInputClass}
                disabled={disabled}
              />
              <Button
                variant='danger-soft'
                aria-label="Xoá mốc"
                className="flex size-8 items-center justify-center rounded-full"
                isDisabled={disabled}
                onPress={() => onChange(rows.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export function ShippingConfigClient() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: adminKeys.shippingConfig,
    queryFn: fetchShippingConfig,
    // Đang ở chế độ tự động → làm mới trạng thái thời tiết mỗi phút.
    refetchInterval: (q) =>
      q.state.data?.weatherSurchargeActive && q.state.data?.weatherAutoMode ? 60_000 : false,
  });

  const [isActive, setIsActive] = useState(true);
  const [baseFee, setBaseFee] = useState("15000");
  const [baseKm, setBaseKm] = useState("2");
  const [feePerKm, setFeePerKm] = useState("5000");
  const [maxDistanceKm, setMaxDistanceKm] = useState("15");
  const [freeThreshold, setFreeThreshold] = useState("200000");
  const [freeShipDistanceKm, setFreeShipDistanceKm] = useState("1");
  const [weatherSurchargeActive, setWeatherSurchargeActive] = useState(false);
  const [weatherSurchargeFee, setWeatherSurchargeFee] = useState("0");
  const [weatherAutoMode, setWeatherAutoMode] = useState(false);
  const [rainRows, setRainRows] = useState<TierForm[]>([]);
  const [windRows, setWindRows] = useState<TierForm[]>([]);
  const [thunderFee, setThunderFee] = useState("8000");
  const [staleMinutes, setStaleMinutes] = useState("45");
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Chỉ nạp form 1 lần khi dữ liệu về lần đầu: cronjob/refetchInterval sẽ đổi `data` liên tục,
  // không được ghi đè những gì admin đang gõ dở.
  useEffect(() => {
    if (data && !hydrated) {
      setHydrated(true);
      setIsActive(data.isActive);
      setBaseFee(String(data.baseFee));
      setBaseKm(String(data.baseKm));
      setFeePerKm(String(data.feePerKm));
      setMaxDistanceKm(String(data.maxDistanceKm));
      setFreeThreshold(String(data.freeThreshold));
      setFreeShipDistanceKm(String(data.freeShipDistanceKm ?? 1));
      setWeatherSurchargeActive(data.weatherSurchargeActive ?? false);
      setWeatherSurchargeFee(String(data.weatherSurchargeFee ?? 0));
      setWeatherAutoMode(data.weatherAutoMode ?? false);
      setRainRows(toForm(data.weatherRainTiersJson));
      setWindRows(toForm(data.weatherWindTiersJson));
      setThunderFee(String(data.weatherThunderstormFee ?? 8000));
      setStaleMinutes(String(data.weatherStaleMinutes ?? 45));
    }
  }, [data, hydrated]);

  const mutation = useMutation({
    mutationFn: async (body: Parameters<typeof updateShippingConfig>[0]) => {
      const updated = await updateShippingConfig(body);
      // Đang ở chế độ tự động → tính lại ngay theo mốc mới, khỏi chờ cron.
      if (body.weatherSurchargeActive && body.weatherAutoMode) {
        try {
          return await refreshShippingWeather();
        } catch {
          return updated;
        }
      }
      return updated;
    },
    onSuccess: (updated) => {
      qc.setQueryData(adminKeys.shippingConfig, updated);
      setRainRows(toForm(updated.weatherRainTiersJson));
      setWindRows(toForm(updated.weatherWindTiersJson));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const refreshMutation = useMutation({
    mutationFn: refreshShippingWeather,
    onSuccess: (updated) => qc.setQueryData(adminKeys.shippingConfig, updated),
  });

  function handleSave() {
    mutation.mutate({
      isActive,
      baseFee: parseInt(baseFee) || 0,
      baseKm: parseFloat(baseKm) || 0,
      feePerKm: parseInt(feePerKm) || 0,
      maxDistanceKm: parseFloat(maxDistanceKm) || 1,
      freeThreshold: parseInt(freeThreshold) || 0,
      freeShipDistanceKm: parseFloat(freeShipDistanceKm) || 0,
      weatherSurchargeActive,
      weatherSurchargeFee: parseInt(weatherSurchargeFee) || 0,
      weatherAutoMode,
      weatherRainTiersJson: fromForm(rainRows),
      weatherWindTiersJson: fromForm(windRows),
      weatherThunderstormFee: parseInt(thunderFee) || 0,
      weatherStaleMinutes: Math.min(1440, Math.max(15, parseInt(staleMinutes) || 45)),
    });
  }

  const busy = isLoading || mutation.isPending;

  // ── Trạng thái auto (do cronjob ghi) ──
  const snapshot = data?.weatherSnapshotJson ?? null;
  const checkedAt = data?.weatherCheckedAt ? new Date(data.weatherCheckedAt) : null;
  const staleLimitMs = (data?.weatherStaleMinutes ?? 45) * 60_000;
  const isStale = !checkedAt || Date.now() - checkedAt.getTime() > staleLimitMs;
  const autoFeeNow = weatherAutoMode && !isStale ? (data?.weatherAutoFee ?? 0) : 0;

  // ── Preview (khớp server: Math.round cho km vượt) ──
  const previewFeeBase = parseInt(baseFee) || 0;
  const previewFeePerKm = parseInt(feePerKm) || 0;
  const previewBaseKm = parseFloat(baseKm) || 0;
  const previewWeatherFee = !weatherSurchargeActive
    ? 0
    : weatherAutoMode
      ? autoFeeNow
      : parseInt(weatherSurchargeFee) || 0;
  const feeAt = (km: number) =>
    previewFeeBase + Math.round(Math.max(0, km - previewBaseKm)) * previewFeePerKm + previewWeatherFee;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Cấu hình</p>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <Bike className="size-6 text-[#1a3c34]" />
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
            <Switch isSelected={isActive} onChange={setIsActive} isDisabled={busy}>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className={adminFieldStack}>
              <label className={adminLabelClass}>Phí cơ bản (đ)</label>
              <Input type="number" min={0} value={baseFee} onChange={(e) => setBaseFee(e.target.value)} placeholder="15000" className={adminInputClass} disabled={busy} />
              <p className="text-[11px] text-foreground/45">Phí áp dụng trong phạm vi baseKm đầu tiên</p>
            </div>

            <div className={adminFieldStack}>
              <label className={adminLabelClass}>Km cơ bản (km)</label>
              <Input type="number" min={0} step={0.5} value={baseKm} onChange={(e) => setBaseKm(e.target.value)} placeholder="2" className={adminInputClass} disabled={busy} />
              <p className="text-[11px] text-foreground/45">Không tính thêm trong phạm vi này</p>
            </div>

            <div className={adminFieldStack}>
              <label className={adminLabelClass}>Phí mỗi km thêm (đ/km)</label>
              <Input type="number" min={0} value={feePerKm} onChange={(e) => setFeePerKm(e.target.value)} placeholder="5000" className={adminInputClass} disabled={busy} />
              <p className="text-[11px] text-foreground/45">Phí cộng thêm cho mỗi km vượt baseKm</p>
            </div>

            <div className={adminFieldStack}>
              <label className={adminLabelClass}>Khoảng cách tối đa (km)</label>
              <Input type="number" min={1} step={0.5} value={maxDistanceKm} onChange={(e) => setMaxDistanceKm(e.target.value)} placeholder="15" className={adminInputClass} disabled={busy} />
              <p className="text-[11px] text-foreground/45">
                Đơn vượt quá khoảng cách này sẽ từ chối giao và không tính phụ phí thời tiết
              </p>
            </div>

            <div className={adminFieldStack}>
              <label className={adminLabelClass}>Miễn phí từ (đ)</label>
              <Input type="number" min={0} value={freeThreshold} onChange={(e) => setFreeThreshold(e.target.value)} placeholder="200000" className={adminInputClass} disabled={busy} />
              <p className="text-[11px] text-foreground/45">Đặt 0 để không có miễn phí. Đơn hàng ≥ mức này được miễn phí ship.</p>
            </div>

            <div className={adminFieldStack}>
              <label className={adminLabelClass}>Freeship trong bán kính (km)</label>
              <Input type="number" min={0} step={0.1} value={freeShipDistanceKm} onChange={(e) => setFreeShipDistanceKm(e.target.value)} placeholder="1" className={adminInputClass} disabled={busy} />
              <p className="text-[11px] text-foreground/45">Đặt 0 để tắt. Đơn hàng trong bán kính này được miễn phí ship bất kể giá trị đơn.</p>
            </div>
          </div>

          {/* Weather surcharge */}
          <div className="space-y-4 rounded-2xl border border-sky-600/12 bg-sky-50/50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <CloudRain className="mt-0.5 size-4 shrink-0 text-sky-700" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Phụ phí thời tiết xấu</p>
                  <p className="text-xs text-foreground/55">
                    Cộng thêm vào mọi đơn giao hàng trong bán kính giao, kể cả đơn được miễn phí ship
                  </p>
                </div>
              </div>
              <Switch isSelected={weatherSurchargeActive} onChange={setWeatherSurchargeActive} isDisabled={busy}>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>

            {weatherSurchargeActive && (
              <>
                {/* Chọn chế độ */}
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/70 p-1">
                  {[
                    { auto: false, label: "Thủ công" },
                    { auto: true, label: "Tự động (Open-Meteo)" },
                  ].map((m) => (
                    <Button
                      key={m.label}
                      isDisabled={busy}
                      onPress={() => setWeatherAutoMode(m.auto)}
                      className={`h-9 rounded-lg text-xs font-semibold transition ${weatherAutoMode === m.auto
                          ? "bg-sky-700 text-white shadow-sm"
                          : "bg-transparent text-foreground/60 hover:bg-white"
                        }`}
                    >
                      {m.label}
                    </Button>
                  ))}
                </div>

                {!weatherAutoMode ? (
                  <div className={adminFieldStack}>
                    <label className={adminLabelClass}>Số tiền phụ phí (đ)</label>
                    <Input type="number" min={0} value={weatherSurchargeFee} onChange={(e) => setWeatherSurchargeFee(e.target.value)} placeholder="4000" className={adminInputClass} disabled={busy} />
                    <p className="text-[11px] text-foreground/45">Áp dụng cố định cho đến khi bạn tắt.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Trạng thái hiện tại */}
                    <div className="space-y-2 rounded-xl border border-sky-600/15 bg-white p-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Hiện tại</p>
                          <p className="text-lg font-bold tabular-nums text-sky-800">
                            {autoFeeNow > 0 ? `+${formatVnd(autoFeeNow)}` : "Không phụ phí"}
                            {autoFeeNow > 0 && data?.weatherLabel ? (
                              <span className="ml-2 text-xs font-medium text-foreground/60">{data.weatherLabel}</span>
                            ) : null}
                          </p>
                        </div>
                        <Button
                          className="flex h-9 items-center gap-1.5 rounded-full border border-sky-700/25 bg-white px-3.5 text-xs font-semibold text-sky-800 disabled:opacity-60"
                          isDisabled={refreshMutation.isPending || busy}
                          onPress={() => refreshMutation.mutate()}
                        >
                          <RefreshCw className={`size-3.5 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
                          Cập nhật ngay
                        </Button>
                      </div>

                      {snapshot ? (
                        <p className="text-[11px] text-foreground/55">
                          Mưa {snapshot.precipitation} mm/h · Gió {snapshot.windSpeed} km/h · Gió giật {snapshot.windGusts} km/h
                          {" · "}Cập nhật {checkedAt?.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      ) : (
                        <p className="text-[11px] text-foreground/45">Chưa có dữ liệu — cronjob chạy mỗi 15 phút, hoặc bấm “Cập nhật ngay”.</p>
                      )}
                      {isStale && snapshot && (
                        <p className="text-[11px] font-medium text-amber-700">
                          Dữ liệu đã quá {data?.weatherStaleMinutes ?? 45} phút — phụ phí tự động đang tạm tắt.
                        </p>
                      )}
                    </div>

                    <TierEditor title="Mốc mưa" icon={<CloudRain className="size-3.5 text-sky-700" />} unit="mm/h" rows={rainRows} onChange={setRainRows} disabled={busy} />
                    <TierEditor title="Mốc gió giật / bão" icon={<Wind className="size-3.5 text-sky-700" />} unit="km/h" rows={windRows} onChange={setWindRows} disabled={busy} />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className={adminFieldStack}>
                        <label className={adminLabelClass}>Phụ phí tối thiểu khi có dông (đ)</label>
                        <Input type="number" min={0} value={thunderFee} onChange={(e) => setThunderFee(e.target.value)} className={adminInputClass} disabled={busy} />
                      </div>
                      <div className={adminFieldStack}>
                        <label className={adminLabelClass}>Bỏ qua dữ liệu cũ hơn (phút)</label>
                        <Input type="number" min={15} max={1440} value={staleMinutes} onChange={(e) => setStaleMinutes(e.target.value)} className={adminInputClass} disabled={busy} />
                      </div>
                    </div>

                    <p className="text-[11px] leading-relaxed text-foreground/50">
                      Hệ thống lấy mức <b>cao nhất</b> giữa mưa, gió và dông (không cộng dồn). Phụ phí tăng ngay khi thời tiết xấu đi,
                      nhưng chỉ hạ sau 2 lần kiểm tra liên tiếp (~15–30 phút) để tránh nhảy giá liên tục.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Live preview */}
          <div className="space-y-2 rounded-2xl border border-dashed border-black/10 bg-neutral-50 p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/55">
              <MapPin className="size-3.5" />
              Xem trước phí
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[5, 10, 15].map((km) => (
                <div key={km} className="rounded-xl border border-black/6 bg-white px-2 py-2.5">
                  <p className="text-[11px] text-foreground/55">{km} km</p>
                  <p className="text-sm font-bold tabular-nums text-[#1a3c34]">{formatVnd(feeAt(km))}</p>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              {parseFloat(freeShipDistanceKm) > 0 && (
                <p className="flex items-center gap-1 text-[11px] text-emerald-700">
                  <Truck className="size-3 shrink-0" />
                  Freeship trong {freeShipDistanceKm} km đầu
                </p>
              )}
              {parseInt(freeThreshold) > 0 && (
                <p className="text-[11px] text-foreground/55">Freeship với đơn ≥ {formatVnd(parseInt(freeThreshold) || 0)}</p>
              )}
              {weatherSurchargeActive && previewWeatherFee > 0 && (
                <p className="flex items-center gap-1 text-[11px] text-sky-700">
                  <CloudRain className="size-3 shrink-0" />
                  Đã bao gồm phụ phí thời tiết xấu +{formatVnd(previewWeatherFee)}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button
              className="flex h-11 items-center gap-2 rounded-full bg-[#1a3c34] px-6 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              isDisabled={busy}
              onPress={handleSave}
            >
              {mutation.isPending ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : saved ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <Bike className="size-4" />
              )}
              {mutation.isPending ? "Đang lưu..." : saved ? "Đã lưu!" : "Lưu cấu hình"}
            </Button>
            {mutation.isError && <p className="text-sm text-red-600">Lưu thất bại. Vui lòng thử lại.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}