"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { AxiosError } from "axios";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Check,
  CheckCircle2,
  Clock,
  Crown,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCw,
  Shield,
  ShoppingBag,
  Trash2,
  Users,
  Utensils,
} from "lucide-react";
import { Button, Card, CardContent } from "@heroui/react";
import Image from "next/image";

import { adminKeys } from "@/services/admin/keys";
import {
  fetchAdminGroupOrderDetail,
  adminUpdateGroupOrderStatus,
  adminDeleteGroupOrder,
  type GroupOrderDetail,
  type GroupOrderParticipant,
} from "@/services/admin/group-order-api";

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

function fmtVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
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

const STATUS_OPTIONS = [
  { value: "collecting", label: "Đang chọn món", cls: "bg-blue-50 text-blue-700 ring-blue-200" },
  { value: "locked", label: "Đã chốt", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  { value: "completed", label: "Hoàn thành", cls: "bg-green-50 text-green-700 ring-green-200" },
  { value: "cancelled", label: "Đã hủy", cls: "bg-red-50 text-red-600 ring-red-200" },
];

function statusStyle(status: string) {
  return STATUS_OPTIONS.find((s) => s.value === status) ?? { label: status, cls: "bg-gray-50 text-gray-700 ring-gray-200" };
}

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground/40">{label}</p>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-foreground/50">{sub}</p>}
    </div>
  );
}

// ── Participant card ─────────────────────────────────────────────────────────

function ParticipantCard({ p }: { p: GroupOrderParticipant }) {
  const payStatus = p.paymentStatus === "paid"
    ? { label: "Đã thanh toán", cls: "bg-green-50 text-green-700 ring-green-200" }
    : { label: "Chờ thanh toán", cls: "bg-gray-50 text-gray-600 ring-gray-200" };

  return (
    <Card className="rounded-2xl border border-black/[0.06] shadow-sm">
      <CardContent className="p-4 space-y-3">
        {/* Participant header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {p.avatar ? (
              <Image src={p.avatar} alt={p.name} width={32} height={32} className="size-8 rounded-full object-cover ring-1 ring-black/6" />
            ) : (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1a3c34]/10 text-xs font-bold text-[#1a3c34]">
                {p.name[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                {p.name}
                {p.isHost && <Crown className="size-3.5 text-amber-500" />}
              </p>
              <p className="text-[11px] text-foreground/45">Tham gia {fmtTime(p.joinedAt)}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {p.isReady ? (
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                <CheckCircle2 className="size-3" /> Đã xác nhận
              </span>
            ) : (
              <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-500 ring-1 ring-gray-200">
                Chưa xác nhận
              </span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${payStatus.cls}`}>
              {payStatus.label}
            </span>
          </div>
        </div>

        {/* Items */}
        {p.items.length === 0 ? (
          <p className="text-xs text-foreground/40 italic">Chưa chọn món</p>
        ) : (
          <div className="space-y-2">
            {p.items.map((item) => {
              const thumb = item.product?.imageUrls?.[0];
              const name = item.product?.name ?? "Sản phẩm";
              const toppingTotal = (item.toppings ?? []).reduce((s, t) => s + t.price, 0);
              const lineTotal = (item.unitPrice + toppingTotal) * item.quantity;
              return (
                <div key={item.id} className="flex items-start gap-3 rounded-xl bg-[#f9fafb] px-3 py-2.5">
                  <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-black/5 ring-1 ring-black/6">
                    {thumb ? (
                      <Image src={thumb} alt={name} fill className="object-cover" sizes="40px" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ShoppingBag className="size-4 text-foreground/20" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-semibold text-foreground leading-snug">{name}</p>
                      <p className="shrink-0 text-[13px] font-bold tabular-nums text-[#1a3c34]">{fmtVnd(lineTotal)}</p>
                    </div>
                    <p className="text-[11px] text-foreground/50">
                      {item.quantity} × {fmtVnd(item.unitPrice + toppingTotal)}
                    </p>
                    {Object.keys(item.selectedOptions ?? {}).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {Object.entries(item.selectedOptions).map(([g, v]) => (
                          <span key={g} className="rounded-full bg-surface-card px-2 py-0.5 text-[10px] font-medium text-foreground/60">
                            {g}: {v}
                          </span>
                        ))}
                        {(item.toppings ?? []).map((t) => (
                          <span key={t.toppingId} className="rounded-full bg-[#e6f4ee] px-2 py-0.5 text-[10px] font-medium text-[#1a3c34]/70">
                            + {t.name} +{fmtVnd(t.price)}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.note && (
                      <p className="mt-1 text-[11px] italic text-foreground/45">"{item.note}"</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Subtotal */}
        <div className="flex items-center justify-between border-t border-black/[0.05] pt-2">
          <p className="text-xs text-foreground/50">{p.items.length} món · {p.items.reduce((s, i) => s + i.quantity, 0)} phần</p>
          <p className="text-sm font-bold tabular-nums text-[#1a3c34]">{fmtVnd(p.subtotal)}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Admin actions panel ──────────────────────────────────────────────────────

function AdminActionsPanel({ go, onUpdated, onDeleted }: {
  go: GroupOrderDetail;
  onUpdated: (updated: GroupOrderDetail) => void;
  onDeleted: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState(go.status);

  const updateMut = useMutation({
    mutationFn: (status: string) => adminUpdateGroupOrderStatus(go.token, status),
    onSuccess: (data) => { onUpdated(data); setStatusError(null); },
    onError: (e) => setStatusError(axiosMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: () => adminDeleteGroupOrder(go.token),
    onSuccess: onDeleted,
  });

  const isDirty = selectedStatus !== go.status;

  return (
    <Card className="rounded-2xl border border-black/[0.06] shadow-sm">
      <CardContent className="space-y-5 p-5">
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-[#1a3c34]" />
          <p className="text-sm font-semibold text-[#1a3c34]">Hành động admin</p>
        </div>

        {/* Status override */}
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground/45">Cập nhật trạng thái</p>
          <div className="grid grid-cols-2 gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelectedStatus(opt.value)}
                className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-semibold ring-1 transition ${
                  selectedStatus === opt.value
                    ? opt.cls + " ring-2"
                    : "border-black/8 bg-white text-foreground/70 ring-transparent hover:border-black/15"
                }`}
              >
                {selectedStatus === opt.value && <Check className="size-3.5" />}
                {opt.label}
              </button>
            ))}
          </div>
          {statusError && <p className="text-xs text-red-600">{statusError}</p>}
          <button
            type="button"
            disabled={!isDirty || updateMut.isPending}
            onClick={() => updateMut.mutate(selectedStatus)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#1a3c34] px-3 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#2d4a43] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {updateMut.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Lưu trạng thái
          </button>
        </div>

        <div className="h-px bg-black/[0.05]" />

        {/* Delete */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground/45">Xóa đơn nhóm</p>
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] font-semibold text-red-600 transition hover:bg-red-100"
            >
              <Trash2 className="size-4" />
              Xóa đơn nhóm này
            </button>
          ) : (
            <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-red-700">
                <AlertTriangle className="size-4 shrink-0" />
                Xóa vĩnh viễn, không khôi phục được. Tiếp tục?
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 rounded-lg border border-black/10 bg-white py-1.5 text-xs font-semibold text-foreground/70 hover:bg-black/4"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={deleteMut.isPending}
                  onClick={() => deleteMut.mutate()}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {deleteMut.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  Xóa
                </button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function GroupOrderDetailClient({ token }: { token: string }) {
  const router = useRouter();
  const qc = useQueryClient();

  const { data: go, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: adminKeys.groupOrderDetail(token),
    queryFn: () => fetchAdminGroupOrderDetail(token),
  });

  const handleUpdated = (updated: GroupOrderDetail) => {
    qc.setQueryData(adminKeys.groupOrderDetail(token), updated);
    void qc.invalidateQueries({ queryKey: adminKeys.activeGroupOrders });
  };

  const handleDeleted = () => {
    void qc.invalidateQueries({ queryKey: adminKeys.activeGroupOrders });
    router.push("/group-orders");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[#1a3c34]" />
      </div>
    );
  }

  if (error || !go) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <AlertTriangle className="size-10 text-red-400" />
        <p className="text-sm text-foreground/60">Không tìm thấy đơn nhóm</p>
        <Button size="sm" className="rounded-full bg-[#1a3c34] text-white" onPress={() => router.push("/group-orders")}>
          Quay lại
        </Button>
      </div>
    );
  }

  const totalSubtotal = go.participants.reduce((s, p) => s + p.subtotal, 0);
  const grandTotal = totalSubtotal + go.shippingFee;
  const paidCount = go.participants.filter((p) => p.paymentStatus === "paid").length;
  const st = statusStyle(go.status);

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Back + title */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 rounded-full text-foreground/60"
            onPress={() => router.push("/group-orders")}
          >
            <ArrowLeft className="size-4" />
            Đơn nhóm
          </Button>
          <div className="h-5 w-px bg-black/10" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold tracking-wider text-foreground">{go.token}</span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${st.cls}`}>
                {st.label}
              </span>
            </div>
            <p className="text-xs text-foreground/45">Tạo {fmtTime(go.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="gap-1.5 rounded-full text-foreground/60" onPress={() => void refetch()} isDisabled={isFetching}>
            <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
          {go.order && (
            <a
              href={`/orders/${go.order.id}`}
              className="flex items-center gap-1.5 rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs font-semibold text-foreground/70 transition hover:border-[#1a3c34]/25 hover:text-[#1a3c34]"
            >
              <ExternalLink className="size-3.5" />
              Xem đơn hàng
            </a>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Thành viên" value={String(go.participants.length)} sub={`${paidCount} đã thanh toán`} />
        <StatCard label="Tổng tiền món" value={fmtVnd(totalSubtotal)} />
        <StatCard label="Phí ship" value={fmtVnd(go.shippingFee)} sub={go.shippingFeeMode === "host_pays" ? "Chủ trả" : "Chia đều"} />
        <StatCard label="Tổng cộng" value={fmtVnd(grandTotal)} />
      </div>

      {/* Order info row */}
      <Card className="rounded-2xl border border-black/[0.06] shadow-sm">
        <CardContent className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground/40">Hình thức</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
              {go.type === "delivery" ? <><MapPin className="size-3.5 text-[#1a3c34]" />Giao hàng</> :
                go.type === "pickup" ? <><ShoppingBag className="size-3.5 text-[#1a3c34]" />Mang về</> :
                  <><Utensils className="size-3.5 text-[#1a3c34]" />Tại bàn</>}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground/40">Thanh toán</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
              <Banknote className="size-3.5 text-[#1a3c34]" />
              {go.paymentMode === "host_pays" ? "Chủ trả" : "Chia tiền"}
              {go.paymentType && go.paymentType !== "cash" && (
                <span className="text-foreground/50">· {go.paymentType === 'bank_transfer' ? 'Chuyển khoản' : "Tiền mặt"}</span>
              )}
            </p>
          </div>
          {go.address && (
            <div className="sm:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground/40">Địa chỉ giao</p>
              <p className="mt-1 text-sm text-foreground/80">{go.address.fullAddress}</p>
            </div>
          )}
          {go.table && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground/40">Bàn</p>
              <p className="mt-1 text-sm font-semibold">{go.table.name} · {go.table.area}</p>
            </div>
          )}
          {go.note && (
            <div className="sm:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground/40">Ghi chú</p>
              <p className="mt-1 text-sm italic text-foreground/70">"{go.note}"</p>
            </div>
          )}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground/40">Hết hạn</p>
            <p className="mt-1 text-sm text-foreground/70">{fmtTime(go.expiresAt)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Main content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        {/* Participants */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
              <Users className="size-4 text-[#1a3c34]" />
              Thành viên ({go.participants.length})
            </h2>
          </div>
          {go.participants.map((p) => (
            <ParticipantCard key={p.id} p={p} />
          ))}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <AdminActionsPanel go={go} onUpdated={handleUpdated} onDeleted={handleDeleted} />

          {/* Order info if linked */}
          {go.order && (
            <Card className="rounded-2xl border border-black/[0.06] shadow-sm">
              <CardContent className="space-y-3 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground/40">Đơn hàng liên kết</p>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-sm font-bold text-foreground">{go.order.paymentCode}</p>
                    <p className="text-xs text-foreground/50">{go.order.status}</p>
                  </div>
                  <a
                    href={`/orders/${go.order.id}`}
                    className="flex items-center gap-1.5 rounded-full border border-[#1a3c34]/20 bg-[#f0faf6] px-3 py-1.5 text-xs font-semibold text-[#1a3c34] transition hover:bg-[#e0f5ec]"
                  >
                    <ExternalLink className="size-3" />
                    Xem
                  </a>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
