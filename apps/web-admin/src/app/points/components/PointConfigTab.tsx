"use client";

import {
  Button,
  Card,
  CardContent,
  Chip,
  Description,
  Input,
  Label,
  Switch,
  Text,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import {
  AlertTriangle,
  ArrowRight,
  History,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import {
  adminFieldStackLoose,
  adminInputClass,
  adminLabelClass,
} from "@/lib/admin-form-classes";
import { formatVnd } from "@/lib/product-display";
import { adminKeys } from "@/services/admin/keys";
import {
  fetchPointConfigCurrent,
  fetchPointSystemStats,
  updatePointConfig,
} from "@/services/admin/points-api";
import type { PointConfigSerialized } from "@/services/admin/types";

function axiosMessage(e: unknown): string {
  const err = e as AxiosError<{ message?: string | string[] }>;
  const d = err.response?.data;
  if (d && typeof d === "object") {
    const m = d.message;
    if (typeof m === "string") return m;
    if (Array.isArray(m)) return m.join(", ");
  }
  return err.message || "Có lỗi xảy ra.";
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

/** Điểm nhận ≈ ⌊(giá trị đơn × % tích) / pointRate⌋ — cùng logic quy đổi khi đổi điểm. */
function simulateEarnPoints(
  orderVnd: number,
  earnPercent: number,
  pointRate: number,
): { points: number; equivalentVnd: number } {
  if (pointRate < 1 || !Number.isFinite(pointRate)) {
    return { points: 0, equivalentVnd: 0 };
  }
  const rawVnd = (orderVnd * earnPercent) / 100;
  const points = Math.round((rawVnd / pointRate) * 10) / 10;
  return { points, equivalentVnd: points * pointRate };
}

type Props = {
  onGoCampaigns: () => void;
  onGoUsers: () => void;
  onGoHistory: () => void;
};

export function PointConfigTab({
  onGoCampaigns,
  onGoUsers,
  onGoHistory,
}: Props) {
  const qc = useQueryClient();
  const { showAlert } = useAppDialog();

  const configQuery = useQuery({
    queryKey: adminKeys.pointConfig,
    queryFn: fetchPointConfigCurrent,
  });

  const statsQuery = useQuery({
    queryKey: adminKeys.pointStats,
    queryFn: fetchPointSystemStats,
  });

  const cfg = configQuery.data?.config;

  const [pointRate, setPointRate] = useState("");
  const [earnPercent, setEarnPercent] = useState("");
  const [maxUsagePercent, setMaxUsagePercent] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("");
  const [delayHours, setDelayHours] = useState("");
  const [expireDays, setExpireDays] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [demoOrderVnd, setDemoOrderVnd] = useState("100000");
  const [snapshot, setSnapshot] = useState<Partial<PointConfigSerialized> | null>(
    null,
  );

  useEffect(() => {
    if (!cfg) return;
    setPointRate(String(cfg.pointRate));
    setEarnPercent(String(Number.parseFloat(cfg.earnPercent) || 0));
    setMaxUsagePercent(String(Number.parseFloat(cfg.maxUsagePercent) || 0));
    setMinOrderAmount(String(Number.parseFloat(cfg.minOrderAmount) || 0));
    setDelayHours(String(cfg.delayHours));
    setExpireDays(String(cfg.expireDays));
    setIsActive(cfg.isActive);
    setSnapshot({
      pointRate: cfg.pointRate,
      earnPercent: cfg.earnPercent,
      maxUsagePercent: cfg.maxUsagePercent,
      minOrderAmount: cfg.minOrderAmount,
      delayHours: cfg.delayHours,
      expireDays: cfg.expireDays,
      isActive: cfg.isActive,
    });
  }, [cfg]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!cfg) throw new Error("no config");
      const pr = Number.parseInt(pointRate, 10);
      const ep = Number.parseFloat(earnPercent.replace(",", "."));
      const minO = Number.parseFloat(minOrderAmount.replace(",", "."));
      const dh = Number.parseInt(delayHours, 10);
      const ed = Number.parseInt(expireDays, 10);
      return updatePointConfig(cfg.id, {
        pointRate: pr,
        earnPercent: ep,
        minOrderAmount: minO,
        delayHours: dh,
        expireDays: ed,
        isActive,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: adminKeys.pointConfig });
      await qc.invalidateQueries({ queryKey: adminKeys.pointStats });
      await qc.invalidateQueries({ queryKey: adminKeys.pointCampaigns });
    },
    onError: async (e) => showAlert(axiosMessage(e), "Lỗi"),
  });

  const simulation = useMemo(() => {
    const order = Number.parseFloat(demoOrderVnd.replace(/\s/g, "")) || 0;
    const pr = Number.parseInt(pointRate, 10) || 100;
    const ep = Number.parseFloat(earnPercent.replace(",", ".")) || 0;
    return simulateEarnPoints(order, ep, pr);
  }, [demoOrderVnd, pointRate, earnPercent]);

  const lossWarning = useMemo(() => {
    const ep = Number.parseFloat(earnPercent.replace(",", ".")) || 0;
    return ep > 20;
  }, [earnPercent]);

  const resetToServer = () => {
    if (!snapshot || !cfg) return;
    setPointRate(String(snapshot.pointRate ?? cfg.pointRate));
    setEarnPercent(String(Number.parseFloat(String(snapshot.earnPercent ?? cfg.earnPercent)) || 0));
    setMaxUsagePercent(String(Number.parseFloat(String(snapshot.maxUsagePercent ?? cfg.maxUsagePercent)) || 0));
    setMinOrderAmount(String(Number.parseFloat(String(snapshot.minOrderAmount ?? cfg.minOrderAmount)) || 0));
    setDelayHours(String(snapshot.delayHours ?? cfg.delayHours));
    setExpireDays(String(snapshot.expireDays ?? cfg.expireDays));
    setIsActive(snapshot.isActive ?? cfg.isActive);
  };

  const applyPreset = (pct: number) => {
    setEarnPercent(String(pct));
  };

  if (configQuery.isError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-800">
        {axiosMessage(configQuery.error)} — không tải được cấu hình điểm.
      </div>
    );
  }

  if (configQuery.isLoading || !cfg) {
    return (
      <div className="space-y-4">
        <div className="h-40 animate-pulse rounded-2xl bg-black/5" />
        <div className="h-64 animate-pulse rounded-2xl bg-black/5" />
      </div>
    );
  }

  const effective = configQuery.data?.effectiveEarnPercent;
  const earnSrc = configQuery.data?.earnPercentSource;

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_min(360px,1fr)]">
      <div className="space-y-6">
        <Card className="rounded-2xl border border-black/6 shadow-sm">
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Cấu hình hệ thống
                </p>
                <p className="mt-1 text-sm text-foreground/55">
                  Tích điểm theo % giá trị đơn hoàn thành; khách dùng điểm
                  để đổi voucher tại trang{" "}
                  <span className="font-mono font-semibold">Đổi điểm</span>.
                </p>
              </div>
              <Chip
                size="sm"
                variant="soft"
                className={`border-0 font-bold uppercase ${isActive ? "bg-emerald-500/15 text-emerald-900" : "bg-zinc-400/15 text-zinc-700"}`}
              >
                {isActive ? "Hoạt động" : "Tắt"}
              </Chip>
            </div>

            {lossWarning ? (
              <div className="flex gap-3 rounded-xl border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
                <p>
                  % tích điểm cao (&gt;20%) có thể gây lệch P&amp;L khi cộng với
                  các khuyến mãi khác — kiểm tra trước khi lưu.
                </p>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className={`${adminFieldStackLoose}`}>
                <Label className={adminLabelClass}>
                  1 điểm = bao nhiêu VNĐ (pointRate)
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={pointRate}
                  onChange={(e) => setPointRate(e.target.value)}
                  className={adminInputClass}
                />
              </div>
              <div className={`${adminFieldStackLoose}`}>
                <Label className={adminLabelClass}>% tích điểm mỗi đơn</Label>
                <Input
                  type="number"
                  min={0}
                  max={20}
                  step="0.1"
                  value={earnPercent}
                  onChange={(e) => setEarnPercent(e.target.value)}
                  className={adminInputClass}
                />
              </div>
              <div className={`${adminFieldStackLoose}`}>
                <Label className={adminLabelClass}>
                  Đơn tối thiểu để tích điểm (VNĐ)
                </Label>
                <Input
                  type="number"
                  min={0}
                  step="1000"
                  value={minOrderAmount}
                  onChange={(e) => setMinOrderAmount(e.target.value)}
                  className={adminInputClass}
                />
              </div>
              <div className={`${adminFieldStackLoose}`}>
                <Label className={adminLabelClass}>Thời gian chờ (giờ)</Label>
                <Description className="text-xs text-foreground/50">
                  Sau hoàn thành đơn, điểm khả dụng sau số giờ này.
                </Description>
                <Input
                  type="number"
                  min={0}
                  value={delayHours}
                  onChange={(e) => setDelayHours(e.target.value)}
                  className={adminInputClass}
                />
              </div>
              <div className={`${adminFieldStackLoose}`}>
                <Label className={adminLabelClass}>Thời hạn point (ngày)</Label>
                <Input
                  type="number"
                  min={0}
                  value={expireDays}
                  onChange={(e) => setExpireDays(e.target.value)}
                  className={adminInputClass}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-black/8 bg-[#fafafa] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Bật chương trình điểm</p>
                <p className="text-xs text-foreground/50">
                  Tắt để không tích / không áp dụng đổi điểm (theo policy server).
                </p>
              </div>
              <Switch
                isSelected={isActive}
                onChange={setIsActive}
                className="shrink-0"
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-black/6 pt-4">
              <Button variant="ghost" onPress={resetToServer}>
                Đặt lại
              </Button>
              <Button
                className="bg-[#1a3c34] font-semibold text-white"
                onPress={() => saveMut.mutate()}
                isDisabled={saveMut.isPending}
              >
                {saveMut.isPending ? "Đang lưu…" : "Lưu cấu hình"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          <button
            type="button"
            onClick={onGoUsers}
            className="group flex flex-col rounded-2xl border border-black/6 bg-white p-5 text-left shadow-sm transition hover:border-[#71b394]/50 hover:shadow-md"
          >
            <Users className="size-8 text-[#1a3c34]" aria-hidden />
            <p className="mt-3 font-semibold text-[#1a3c34]">Quản lý user</p>
            <p className="mt-1 text-xs text-foreground/55">
              Tìm khách, xem số dư, điều chỉnh điểm thủ công.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#1a3c34]">
              Mở tab <ArrowRight className="size-3.5" />
            </span>
          </button>
          <button
            type="button"
            onClick={onGoHistory}
            className="group flex flex-col rounded-2xl border border-black/6 bg-white p-5 text-left shadow-sm transition hover:border-[#71b394]/50 hover:shadow-md"
          >
            <History className="size-8 text-[#1a3c34]" aria-hidden />
            <p className="mt-3 font-semibold text-[#1a3c34]">Đối soát lịch sử</p>
            <p className="mt-1 text-xs text-foreground/55">
              earn / spend / expire trên toàn hệ thống.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#1a3c34]">
              Mở tab <ArrowRight className="size-3.5" />
            </span>
          </button>
          <button
            type="button"
            onClick={onGoCampaigns}
            className="group flex flex-col rounded-2xl border border-black/6 bg-white p-5 text-left shadow-sm transition hover:border-[#71b394]/50 hover:shadow-md"
          >
            <Sparkles className="size-8 text-[#1a3c34]" aria-hidden />
            <p className="mt-3 font-semibold text-[#1a3c34]">Campaign tích điểm</p>
            <p className="mt-1 text-xs text-foreground/55">
              Tạo đợt tăng % tích trong khung thời gian.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#1a3c34]">
              Mở tab <ArrowRight className="size-3.5" />
            </span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <Card className="overflow-hidden rounded-2xl border border-[#71b394]/30 bg-[color-mix(in_oklab,#ecfdf5_50%,white)]">
          <CardContent className="space-y-3 p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#1a3c34]">
              Mô phỏng tích lũy
            </p>
            <div className={`${adminFieldStackLoose}`}>
              <Label className={adminLabelClass}>Giá trị đơn mẫu (VNĐ)</Label>
              <Input
                type="number"
                min={0}
                step="1000"
                value={demoOrderVnd}
                onChange={(e) => setDemoOrderVnd(e.target.value)}
                className={adminInputClass}
              />
            </div>
            <p className="text-sm leading-relaxed text-[#1a3c34]">
              Nếu đơn{" "}
              <span className="font-semibold tabular-nums">
                {formatVnd(Number.parseFloat(demoOrderVnd.replace(/\s/g, "")) || 0)}
              </span>{" "}
              → khoảng{" "}
              <span className="font-bold tabular-nums">
                {simulation.points} điểm
              </span>
              . Tương đương giá trị đổi tối đa ~{" "}
              <span className="font-semibold tabular-nums">
                {formatVnd(simulation.equivalentVnd)}
              </span>{" "}
              (theo pointRate hiện tại).
            </p>
            <Text className="text-xs text-foreground/50">
              % tích hiệu lực trên server:{" "}
              <span className="font-mono font-semibold">
                {effective != null ? `${Number.parseFloat(effective).toFixed(2)}%` : "—"}
              </span>{" "}
              ({earnSrc === "campaign" ? "campaign" : "cấu hình"}).
            </Text>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-black/6 shadow-sm">
          <CardContent className="space-y-3 p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
              Cài đặt nhanh % tích
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  [5, "An toàn"],
                  [7, "Vừa"],
                  [10, "Mạnh"],
                ] as const
              ).map(([pct, label]) => (
                <Button
                  key={pct}
                  type="button"
                  size="sm"
                  variant={Number(earnPercent) === pct ? "primary" : "secondary"}
                  className={
                    Number(earnPercent) === pct
                      ? "rounded-xl bg-[#1a3c34] font-semibold text-white"
                      : "rounded-xl"
                  }
                  onPress={() => applyPreset(pct)}
                >
                  {label}
                  <span className="ml-1 tabular-nums">{pct}%</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card className="rounded-2xl border border-black/6 shadow-sm">
            <CardContent className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Tổng point lưu hành
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-[#1a3c34]">
                {statsQuery.isLoading
                  ? "—"
                  : formatCompact(statsQuery.data?.totalPointsInCirculation ?? 0)}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-black/6 shadow-sm">
            <CardContent className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                User có điểm / TV đã xác minh
              </p>
              <p className="mt-2 text-sm font-semibold text-[#1a3c34]">
                {statsQuery.isLoading ? (
                  "—"
                ) : (
                  <>
                    <span className="tabular-nums text-2xl font-bold">
                      {formatCompact(statsQuery.data?.usersWithPoints ?? 0)}
                    </span>
                    <span className="text-foreground/45"> / </span>
                    <span className="tabular-nums text-lg">
                      {formatCompact(statsQuery.data?.membersVerified ?? 0)}
                    </span>
                  </>
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
