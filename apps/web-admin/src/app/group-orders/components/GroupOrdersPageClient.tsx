"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import {
  CheckCircle2,
  Clock,
  Minus,
  Percent,
  Plus,
  Save,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Description,
  Label,
  Switch,
  Text,
} from "@heroui/react";

import { adminKeys } from "@/services/admin/keys";
import {
  fetchGroupOrderConfig,
  updateGroupOrderConfig,
  type GroupDiscountTier,
} from "@/services/admin/group-order-api";
import { adminInputClass, adminLabelClass } from "@/lib/admin-form-classes";

function axiosMessage(e: unknown): string {
  const err = e as AxiosError<{ message?: string | string[] }>;
  const d = err.response?.data;
  if (d && typeof d === "object") {
    const m = d.message;
    if (typeof m === "string") return m;
    if (Array.isArray(m)) return m.join(", ");
  }
  return (err as Error).message || "Có lỗi xảy ra.";
}

function DiscountPreview({ tiers }: { tiers: GroupDiscountTier[] }) {
  const sorted = [...tiers].sort((a, b) => a.minParticipants - b.minParticipants);
  if (sorted.length === 0) return null;

  return (
    <div className="rounded-xl border border-black/[0.06] bg-[#f9fafb] px-4 py-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/45">
        Xem trước bậc giảm giá
      </p>
      <div className="flex flex-wrap gap-2">
        {sorted.map((t, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-full bg-[#1a3c34]/8 px-3 py-1.5 text-[13px] font-semibold text-[#1a3c34]"
          >
            <Users className="size-3.5" />
            {t.minParticipants}+ người
            <span className="text-xs text-[#1a3c34]/70">→</span>
            <Percent className="size-3" />
            -{t.discountPercent}%
          </div>
        ))}
      </div>
    </div>
  );
}

export function GroupOrdersPageClient() {
  const qc = useQueryClient();
  const cfgQuery = useQuery({
    queryKey: adminKeys.groupOrderConfig,
    queryFn: fetchGroupOrderConfig,
  });

  const [isEnabled, setIsEnabled] = useState(true);
  const [expiryMinutes, setExpiryMinutes] = useState(120);
  const [tiers, setTiers] = useState<GroupDiscountTier[]>([]);

  const cfg = cfgQuery.data;

  useEffect(() => {
    if (!cfg) return;
    setIsEnabled(cfg.isEnabled);
    setExpiryMinutes(cfg.expiryMinutes ?? 120);
    setTiers(cfg.discountTiers ?? []);
  }, [cfg]);

  const saveMut = useMutation({
    mutationFn: () =>
      updateGroupOrderConfig({
        isEnabled,
        expiryMinutes,
        discountTiers: tiers,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.groupOrderConfig });
    },
  });

  const addTier = () => {
    const last = tiers[tiers.length - 1];
    setTiers([
      ...tiers,
      {
        minParticipants: last ? last.minParticipants + 2 : 2,
        discountPercent: last ? Math.min(last.discountPercent + 5, 50) : 5,
      },
    ]);
  };

  const removeTier = (i: number) => {
    setTiers(tiers.filter((_, idx) => idx !== i));
  };

  const updateTier = (i: number, field: keyof GroupDiscountTier, value: number) => {
    setTiers(tiers.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)));
  };

  if (cfgQuery.isLoading) {
    return (
      <Card className="rounded-2xl border border-black/[0.06]">
        <CardContent className="h-48 animate-pulse p-6" />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-24">
      {/* Header */}
      <header className="relative overflow-hidden rounded-2xl border border-[#1a3c34]/10 bg-gradient-to-br from-[#1a3c34] to-[#2d4a43] px-6 py-6 shadow-[0_12px_40px_-16px_rgba(26,60,52,0.4)]">
        <div className="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full bg-white/[0.04]" aria-hidden />
        <div className="relative flex flex-col gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/50">
            Group Order
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Cấu hình đơn hàng nhóm
          </h1>
          <p className="max-w-lg text-sm text-white/60">
            Bật chức năng đặt hàng nhóm và cấu hình bậc giảm giá theo số lượng thành viên tham gia.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Config card */}
        <Card className="xl:col-span-2 rounded-2xl border border-black/[0.06] shadow-sm">
          <CardContent className="space-y-6 p-6">
            {/* Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#f9fafb] px-4 py-3 ring-1 ring-black/[0.06]">
              <div>
                <Text className="text-sm font-semibold">Bật tính năng đơn nhóm</Text>
                <Description className="text-xs">
                  Tắt sẽ không cho phép tạo đơn hàng nhóm mới.
                </Description>
              </div>
              <Switch isSelected={isEnabled} onChange={setIsEnabled}>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>

            {/* Expiry time */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-[#1a3c34]" />
                <p className="text-sm font-semibold text-[#1a3c34]">Thời gian hết hạn đơn nhóm</p>
              </div>
              <p className="text-[11px] text-foreground/50">
                Đơn nhóm chưa chốt sẽ tự xóa sau khoảng thời gian này. Tối thiểu 5 phút.
              </p>
              <div className="flex items-center gap-2">
                <div className="flex items-center overflow-hidden rounded-lg border border-black/[0.1] bg-white">
                  <button
                    type="button"
                    className="flex size-9 items-center justify-center border-r border-black/[0.08] text-foreground/60 hover:bg-black/4"
                    onClick={() => setExpiryMinutes((v) => Math.max(5, v - 30))}
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <input
                    type="number"
                    className="w-20 bg-transparent px-3 py-2 text-center text-sm font-semibold text-foreground focus:outline-none"
                    value={expiryMinutes}
                    min={5}
                    onChange={(e) => setExpiryMinutes(Math.max(5, parseInt(e.target.value, 10) || 5))}
                  />
                  <button
                    type="button"
                    className="flex size-9 items-center justify-center border-l border-black/[0.08] text-foreground/60 hover:bg-black/4"
                    onClick={() => setExpiryMinutes((v) => v + 30)}
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <span className="text-sm text-foreground/60">phút</span>
                <span className="text-xs text-foreground/40">
                  ({expiryMinutes >= 60 ? `${(expiryMinutes / 60).toFixed(1).replace(/\.0$/, '')} giờ` : `${expiryMinutes} phút`})
                </span>
              </div>
            </div>

            {/* Discount tiers */}
            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[#1a3c34]">Bậc giảm giá nhóm</p>
                  <p className="mt-0.5 text-[11px] text-foreground/50">
                    Mời càng nhiều người → giảm càng nhiều. Các bậc sẽ được sắp xếp tự động theo số người tối thiểu.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5 rounded-full border border-black/10 bg-white px-3 font-semibold text-foreground/70 hover:bg-black/4"
                  onPress={addTier}
                >
                  <Plus className="size-3.5" />
                  Thêm bậc
                </Button>
              </div>

              {tiers.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-black/10 py-8 text-center">
                  <Zap className="size-8 text-foreground/20" />
                  <p className="text-sm text-foreground/45">Chưa có bậc giảm giá</p>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-1 rounded-full bg-[#1a3c34] px-4 font-semibold text-white"
                    onPress={addTier}
                  >
                    Thêm bậc đầu tiên
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {tiers.map((tier, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[1fr_1fr_auto] items-end gap-3 rounded-xl border border-black/[0.06] bg-white p-4"
                    >
                      <div className="space-y-1.5">
                        <Label className={adminLabelClass}>Số người tối thiểu</Label>
                        <div className="flex items-center rounded-lg border border-black/[0.1] bg-white overflow-hidden">
                          <button
                            type="button"
                            className="flex size-9 items-center justify-center border-r border-black/[0.08] text-foreground/60 hover:bg-black/4"
                            onClick={() => updateTier(i, "minParticipants", Math.max(2, tier.minParticipants - 1))}
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <input
                            type="number"
                            className="w-full min-w-0 bg-transparent px-3 py-2 text-center text-sm font-semibold text-foreground focus:outline-none"
                            value={tier.minParticipants}
                            min={2}
                            onChange={(e) => updateTier(i, "minParticipants", Math.max(2, parseInt(e.target.value, 10) || 2))}
                          />
                          <button
                            type="button"
                            className="flex size-9 items-center justify-center border-l border-black/[0.08] text-foreground/60 hover:bg-black/4"
                            onClick={() => updateTier(i, "minParticipants", tier.minParticipants + 1)}
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className={adminLabelClass}>Giảm giá (%)</Label>
                        <div className="relative">
                          <input
                            type="number"
                            className={`${adminInputClass} pr-8`}
                            value={tier.discountPercent}
                            min={0}
                            max={100}
                            onChange={(e) => updateTier(i, "discountPercent", Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                          />
                          <Percent className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-foreground/40" />
                        </div>
                      </div>

                      <button
                        type="button"
                        className="flex size-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                        onClick={() => removeTier(i)}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Preview */}
            <DiscountPreview tiers={tiers} />

            {saveMut.isError && (
              <p className="text-sm text-red-700">{axiosMessage(saveMut.error)}</p>
            )}

            {saveMut.isSuccess && (
              <p className="flex items-center gap-1.5 text-sm text-emerald-700">
                <CheckCircle2 className="size-4" />
                Đã lưu cấu hình thành công.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                type="button"
                className="gap-2 rounded-full bg-[#1a3c34] px-6 font-semibold text-white"
                onPress={() => saveMut.mutate()}
                isDisabled={saveMut.isPending}
              >
                <Save className="size-4" />
                {saveMut.isPending ? "Đang lưu…" : "Lưu cấu hình"}
              </Button>
              {cfg?.discountTiers != null && (
                <Text className="text-xs text-foreground/45">
                  {tiers.length} bậc đang cấu hình
                </Text>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Info card */}
        <Card className="h-fit rounded-2xl border border-black/[0.06] bg-gradient-to-br from-[#f9fafb] to-white shadow-sm">
          <CardContent className="space-y-4 p-5">
            <p className="text-sm font-semibold text-[#1a3c34]">Cách hoạt động</p>
            <ol className="space-y-3 text-xs text-foreground/60">
              {[
                "Người dùng tạo đơn nhóm từ trang giỏ hàng",
                "Link được chia sẻ — bạn bè join mà không cần đăng ký",
                "Mỗi người chọn món của riêng mình",
                "Khi đủ người, hệ thống tự áp dụng % giảm theo bậc bạn cấu hình",
                "Host khóa đơn và chọn thanh toán chung hoặc từng người thanh toán riêng",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#1a3c34]/10 text-[10px] font-bold text-[#1a3c34]">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>

            <div className="rounded-xl border border-[#1a3c34]/10 bg-[#1a3c34]/5 px-4 py-3">
              <p className="text-xs font-semibold text-[#1a3c34]">Ví dụ bậc giảm giá</p>
              <div className="mt-2 space-y-1 text-[11px] text-[#1a3c34]/70">
                <p>2–3 người → -5%</p>
                <p>4–5 người → -8%</p>
                <p>6+ người → -12%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
