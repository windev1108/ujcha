"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import {
  CheckCircle2,
  Clock,
  Crown,
  ExternalLink,
  Loader2,
  Minus,
  Percent,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
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
  fetchActiveGroupOrders,
  type GroupDiscountTier,
  type ActiveGroupOrder,
} from "@/services/admin/group-order-api";
import { adminInputClass, adminLabelClass } from "@/lib/admin-form-classes";

type TabId = "active" | "config";

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

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeLeft(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Hết hạn";
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}g ${m % 60}p` : `${m}p`;
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  collecting: { label: "Đang chọn món", cls: "bg-blue-50 text-blue-700 ring-blue-200" },
  locked: { label: "Đã chốt", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
};

// ── Active Orders Tab ──────────────────────────────────────────────────────────

function ActiveGroupOrdersTab() {
  const { data = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: adminKeys.activeGroupOrders,
    queryFn: fetchActiveGroupOrders,
    refetchInterval: 30_000,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground/55">
          {isLoading ? "Đang tải..." : `${data.length} đơn nhóm đang hoạt động`}
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 rounded-full text-foreground/70"
          onPress={() => void refetch()}
          isDisabled={isFetching}
        >
          <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-[#1a3c34]" />
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-black/10 py-16 text-center">
          <Users className="size-10 text-foreground/20" />
          <div>
            <p className="text-sm font-semibold text-foreground/50">Không có đơn nhóm nào đang mở</p>
            <p className="mt-1 text-xs text-foreground/35">Các đơn nhóm đang chọn món hoặc đã chốt sẽ hiển thị ở đây</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((go) => (
            <ActiveGroupOrderCard key={go.id} go={go} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActiveGroupOrderCard({ go }: { go: ActiveGroupOrder }) {
  const status = STATUS_MAP[go.status] ?? { label: go.status, cls: "bg-gray-50 text-gray-700 ring-gray-200" };
  const diff = new Date(go.expiresAt).getTime() - Date.now();
  const expiringSoon = diff > 0 && diff < 15 * 60_000;

  return (
    <Link href={`/group-orders/${go.token}`} className="block">
      <Card className="rounded-2xl border border-black/[0.06] shadow-sm transition hover:border-[#1a3c34]/20 hover:shadow-md">
        <CardContent className="space-y-3 p-4">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-mono text-xs font-bold tracking-wider text-foreground/50">
                {go.token}
              </p>
              {go.hostName && (
                <p className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-foreground">
                  <Crown className="size-3 text-amber-500" />
                  {go.hostName}
                </p>
              )}
            </div>
            <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${status.cls}`}>
              {status.label}
            </span>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-2 text-[12px] text-foreground/60">
            <span className="flex items-center gap-1">
              <Users className="size-3.5" />
              {go.participantCount} thành viên
            </span>
            <span className="flex items-center gap-1">
              {go.paymentMode === "host_pays" ? "Chủ trả" : "Chia tiền"}
            </span>
            <span className="flex items-center gap-1">
              {go.type === "delivery" ? "Giao hàng" : go.type === "pickup" ? "Mang về" : "Tại bàn"}
            </span>
          </div>

          {/* Expiry */}
          <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium ${expiringSoon ? "bg-red-50 text-red-600" : "bg-[#f9fafb] text-foreground/55"}`}>
            <Clock className="size-3.5 shrink-0" />
            <span>Hết hạn {timeLeft(go.expiresAt)} · {fmtTime(go.expiresAt)}</span>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-0.5">
            <p className="text-[11px] text-foreground/40">Tạo {fmtTime(go.createdAt)}</p>
            <button
              type="button"
              onClick={(e) => {
                document.location.href = `/group-orders/${go.token}`;
              }}
              className="flex items-center gap-1 rounded-full border border-black/8 px-2.5 py-1 text-[11px] font-semibold text-foreground/60 transition hover:border-[#1a3c34]/30 hover:text-[#1a3c34]"
            >
              <ExternalLink className="size-3" />
              Xem đơn KH
            </button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Config Tab ─────────────────────────────────────────────────────────────────

function DiscountPreview({ tiers }: { tiers: GroupDiscountTier[] }) {
  const sorted = [...tiers].sort((a, b) => a.minParticipants - b.minParticipants);
  if (sorted.length === 0) return null;

  return (
    <div className="rounded-xl border border-black/[0.06] bg-[#f9fafb] px-4 py-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/45">
        Xem trước bậc giảm giá
      </p>
      <div className="flex flex-wrap gap-2">
        {sorted.map((tier, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-full bg-[#1a3c34]/8 px-3 py-1.5 text-[13px] font-semibold text-[#1a3c34]"
          >
            <Users className="size-3.5" />
            {tier.minParticipants}+ người
            <span className="text-xs text-[#1a3c34]/70">→</span>
            <Percent className="size-3" />
            -{tier.discountPercent}%
          </div>
        ))}
      </div>
    </div>
  );
}

function GroupOrderConfigTab() {
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsEnabled(cfg.isEnabled);
    setExpiryMinutes(cfg.expiryMinutes ?? 120);
    setTiers(cfg.discountTiers ?? []);
  }, [cfg]);

  const saveMut = useMutation({
    mutationFn: () => updateGroupOrderConfig({ isEnabled, expiryMinutes, discountTiers: tiers }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: adminKeys.groupOrderConfig }); },
  });

  const addTier = () => {
    const last = tiers[tiers.length - 1];
    setTiers([...tiers, {
      minParticipants: last ? last.minParticipants + 2 : 2,
      discountPercent: last ? Math.min(last.discountPercent + 5, 50) : 5,
    }]);
  };

  const removeTier = (i: number) => setTiers(tiers.filter((_, idx) => idx !== i));
  const updateTier = (i: number, field: keyof GroupDiscountTier, value: number) =>
    setTiers(tiers.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)));

  if (cfgQuery.isLoading) {
    return <Card className="rounded-2xl border border-black/[0.06]"><CardContent className="h-48 animate-pulse p-6" /></Card>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2 rounded-2xl border border-black/[0.06] shadow-sm">
        <CardContent className="space-y-6 p-6">
          {/* Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#f9fafb] px-4 py-3 ring-1 ring-black/[0.06]">
            <div>
              <Text className="text-sm font-semibold">Bật chức năng đặt hàng nhóm</Text>
              <Description className="text-xs">Tắt sẽ không cho phép tạo đơn hàng nhóm mới.</Description>
            </div>
            <Switch isSelected={isEnabled} onChange={setIsEnabled}>
              <Switch.Control><Switch.Thumb /></Switch.Control>
            </Switch>
          </div>

          {/* Expiry */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-[#1a3c34]" />
              <p className="text-sm font-semibold text-[#1a3c34]">Thời gian hết hạn</p>
            </div>
            <p className="text-[11px] text-foreground/50">Đơn nhóm chưa chốt sẽ tự xóa sau khoảng thời gian này. Tối thiểu 5 phút.</p>
            <div className="flex items-center gap-2">
              <div className="flex items-center overflow-hidden rounded-lg border border-black/[0.1] bg-white">
                <button type="button" className="flex size-9 items-center justify-center border-r border-black/[0.08] text-foreground/60 hover:bg-black/4"
                  onClick={() => setExpiryMinutes((v) => Math.max(5, v - 30))}>
                  <Minus className="size-3.5" />
                </button>
                <input type="number" className="w-20 bg-transparent px-3 py-2 text-center text-sm font-semibold text-foreground focus:outline-none"
                  value={expiryMinutes} min={5}
                  onChange={(e) => setExpiryMinutes(Math.max(5, parseInt(e.target.value, 10) || 5))} />
                <button type="button" className="flex size-9 items-center justify-center border-l border-black/[0.08] text-foreground/60 hover:bg-black/4"
                  onClick={() => setExpiryMinutes((v) => v + 30)}>
                  <Plus className="size-3.5" />
                </button>
              </div>
              <span className="text-sm text-foreground/60">phút</span>
              <span className="text-xs text-foreground/40">({expiryMinutes >= 60 ? `${expiryMinutes / 60} giờ` : `${expiryMinutes} phút`})</span>
            </div>
          </div>

          {/* Discount tiers */}
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[#1a3c34]">Bậc giảm giá</p>
                <p className="mt-0.5 text-[11px] text-foreground/50">Mời càng nhiều người → giảm càng nhiều.</p>
              </div>
              <Button type="button" size="sm" className="gap-1.5 rounded-full border border-black/10 bg-white px-3 font-semibold text-foreground/70 hover:bg-black/4" onPress={addTier}>
                <Plus className="size-3.5" /> Thêm bậc
              </Button>
            </div>

            {tiers.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-black/10 py-8 text-center">
                <Zap className="size-8 text-foreground/20" />
                <p className="text-sm text-foreground/45">Chưa có bậc giảm giá nào</p>
                <Button type="button" size="sm" className="mt-1 rounded-full bg-[#1a3c34] px-4 font-semibold text-white" onPress={addTier}>
                  Thêm bậc đầu tiên
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {tiers.map((tier, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3 rounded-xl border border-black/[0.06] bg-white p-4">
                    <div className="space-y-1.5">
                      <Label className={adminLabelClass}>Số người tối thiểu</Label>
                      <div className="flex items-center rounded-lg border border-black/[0.1] bg-white overflow-hidden">
                        <button type="button" className="flex size-9 items-center justify-center border-r border-black/[0.08] text-foreground/60 hover:bg-black/4"
                          onClick={() => updateTier(i, "minParticipants", Math.max(2, tier.minParticipants - 1))}>
                          <Minus className="size-3.5" />
                        </button>
                        <input type="number" className="w-full min-w-0 bg-transparent px-3 py-2 text-center text-sm font-semibold text-foreground focus:outline-none"
                          value={tier.minParticipants} min={2}
                          onChange={(e) => updateTier(i, "minParticipants", Math.max(2, parseInt(e.target.value, 10) || 2))} />
                        <button type="button" className="flex size-9 items-center justify-center border-l border-black/[0.08] text-foreground/60 hover:bg-black/4"
                          onClick={() => updateTier(i, "minParticipants", tier.minParticipants + 1)}>
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className={adminLabelClass}>Phần trăm giảm giá</Label>
                      <div className="relative">
                        <input type="number" className={`${adminInputClass} pr-8`}
                          value={tier.discountPercent} min={0} max={100}
                          onChange={(e) => updateTier(i, "discountPercent", Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))} />
                        <Percent className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-foreground/40" />
                      </div>
                    </div>
                    <button type="button" className="flex size-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-50" onClick={() => removeTier(i)}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DiscountPreview tiers={tiers} />

          {saveMut.isError && <p className="text-sm text-red-700">{axiosMessage(saveMut.error)}</p>}
          {saveMut.isSuccess && (
            <p className="flex items-center gap-1.5 text-sm text-emerald-700">
              <CheckCircle2 className="size-4" /> Đã lưu cấu hình thành công.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button type="button" className="gap-2 rounded-full bg-[#1a3c34] px-6 font-semibold text-white"
              onPress={() => saveMut.mutate()} isDisabled={saveMut.isPending}>
              <Save className="size-4" />
              {saveMut.isPending ? "Đang lưu..." : "Lưu cấu hình"}
            </Button>
            {cfg?.discountTiers != null && (
              <Text className="text-xs text-foreground/45">{`${tiers.length} bậc đang cấu hình`}</Text>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit rounded-2xl border border-black/[0.06] bg-gradient-to-br from-[#f9fafb] to-white shadow-sm">
        <CardContent className="space-y-4 p-5">
          <p className="text-sm font-semibold text-[#1a3c34]">Cách sử dụng</p>
          <ol className="space-y-3 text-xs text-foreground/60">
            {(["Người dùng tạo đơn nhóm từ trang giỏ hàng", "Chia sẻ link cho bạn bè tham gia", "Mỗi người chọn món và xác nhận", "Host chốt đơn khi đủ thành viên", "Thanh toán theo phương thức đã chọn"] as const).map((txt, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#1a3c34]/10 text-[10px] font-bold text-[#1a3c34]">{i + 1}</span>
                {txt}
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
  );
}

// ── Page shell ─────────────────────────────────────────────────────────────────

export function GroupOrdersPageClient() {
  const [tab, setTab] = useState<TabId>("active");

  const tabs: { id: TabId; label: string }[] = [
    { id: "active", label: "Đơn nhóm đang mở" },
    { id: "config", label: "Cấu hình" },
  ];

  return (
    <div className="flex flex-col gap-8 pb-24">
      <header className="relative overflow-hidden rounded-2xl border border-[#1a3c34]/10 bg-gradient-to-br from-[#1a3c34] to-[#2d4a43] px-6 py-6 shadow-[0_12px_40px_-16px_rgba(26,60,52,0.4)]">
        <div className="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full bg-white/[0.04]" aria-hidden />
        <div className="relative flex flex-col gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/50">Group Order</p>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Đơn hàng nhóm</h1>
          <p className="max-w-lg text-sm text-white/60">
            Theo dõi đơn nhóm đang mở và cấu hình bậc giảm giá theo số lượng thành viên.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-black/8 pb-1">
        {tabs.map((t) => (
          <Button
            key={t.id}
            type="button"
            size="sm"
            variant={tab === t.id ? "primary" : "ghost"}
            className={tab === t.id ? "rounded-full bg-[#1a3c34] font-semibold text-white" : "rounded-full text-foreground/75"}
            onPress={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "active" && <ActiveGroupOrdersTab />}
      {tab === "config" && <GroupOrderConfigTab />}
    </div>
  );
}
