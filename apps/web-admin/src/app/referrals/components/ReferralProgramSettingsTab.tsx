"use client";

import {
  Button,
  Card,
  CardContent,
  Description,
  Input,
  Label,
  Switch,
  Text,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { useEffect, useState } from "react";

import {
  adminFieldStackLoose,
  adminInputClass,
  adminLabelClass,
} from "@/lib/admin-form-classes";
import { adminKeys } from "@/services/admin/keys";
import {
  fetchReferralProgramConfig,
  updateReferralProgramConfig,
} from "@/services/admin/referral-api";
import { fetchAdminVouchers } from "@/services/admin/vouchers-api";
import { DEFAULT_MILESTONE_TIERS } from "./ReferralMilestoneSection";

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

export function ReferralProgramSettingsTab() {
  const qc = useQueryClient();
  const cfgQuery = useQuery({
    queryKey: adminKeys.referralProgramConfig,
    queryFn: fetchReferralProgramConfig,
  });
  const vouchersQuery = useQuery({
    queryKey: adminKeys.vouchers,
    queryFn: fetchAdminVouchers,
  });

  const [minOrderAmount, setMinOrderAmount] = useState("");
  const [referrerCommissionPercent, setReferrerCommissionPercent] = useState("5");
  const [welcomeVoucherId, setWelcomeVoucherId] = useState<string>("");
  const [maxReferrerRewardsPerDay, setMaxReferrerRewardsPerDay] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [blockSameIp, setBlockSameIp] = useState(true);
  const [blockSameDevice, setBlockSameDevice] = useState(true);
  const [bronzeThreshold, setBronzeThreshold] = useState("5");
  const [bronzePoints, setBronzePoints] = useState("100");
  const [silverThreshold, setSilverThreshold] = useState("10");
  const [silverPoints, setSilverPoints] = useState("250");
  const [goldThreshold, setGoldThreshold] = useState("50");
  const [goldPoints, setGoldPoints] = useState("1000");
  const [diamondThreshold, setDiamondThreshold] = useState("100");
  const [diamondPoints, setDiamondPoints] = useState("3000");

  const cfg = cfgQuery.data;
  const vouchers = vouchersQuery.data ?? [];

  useEffect(() => {
    if (!cfg) return;
    setMinOrderAmount(String(Number.parseFloat(cfg.minOrderAmount) || 0));
    setReferrerCommissionPercent(String(cfg.referrerCommissionPercent));
    setWelcomeVoucherId(cfg.welcomeVoucherId ?? "");
    setMaxReferrerRewardsPerDay(String(cfg.maxReferrerRewardsPerDay));
    setIsActive(cfg.isActive);
    setBlockSameIp(cfg.blockSameIpAsReferrer);
    setBlockSameDevice(cfg.blockSameDeviceAsReferrer);
    setBronzeThreshold(String(cfg.bronzeThreshold));
    setBronzePoints(String(cfg.bronzePoints));
    setSilverThreshold(String(cfg.silverThreshold));
    setSilverPoints(String(cfg.silverPoints));
    setGoldThreshold(String(cfg.goldThreshold));
    setGoldPoints(String(cfg.goldPoints));
    setDiamondThreshold(String(cfg.diamondThreshold));
    setDiamondPoints(String(cfg.diamondPoints));
  }, [cfg]);

  const saveMut = useMutation({
    mutationFn: () =>
      updateReferralProgramConfig({
        isActive,
        minOrderAmount: Number.parseFloat(minOrderAmount) || 0,
        referrerCommissionPercent: Number.parseFloat(referrerCommissionPercent) || 0,
        welcomeVoucherId: welcomeVoucherId || null,
        maxReferrerRewardsPerDay:
          Number.parseInt(maxReferrerRewardsPerDay, 10) || 1,
        blockSameIpAsReferrer: blockSameIp,
        blockSameDeviceAsReferrer: blockSameDevice,
        bronzeThreshold: Number.parseInt(bronzeThreshold, 10) || 5,
        bronzePoints: Number.parseInt(bronzePoints, 10) || 0,
        silverThreshold: Number.parseInt(silverThreshold, 10) || 10,
        silverPoints: Number.parseInt(silverPoints, 10) || 0,
        goldThreshold: Number.parseInt(goldThreshold, 10) || 50,
        goldPoints: Number.parseInt(goldPoints, 10) || 0,
        diamondThreshold: Number.parseInt(diamondThreshold, 10) || 100,
        diamondPoints: Number.parseInt(diamondPoints, 10) || 0,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.referralProgramConfig });
    },
  });

  if (cfgQuery.isLoading) {
    return (
      <Card className="rounded-2xl border border-black/[0.06]">
        <CardContent className="h-48 animate-pulse p-6" />
      </Card>
    );
  }

  if (!cfg) {
    return (
      <p className="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Chưa có bản ghi <strong>ReferralProgramConfig</strong> trong database.
        Chạy seed hoặc tạo cấu hình từ migration trước khi chỉnh sửa.
      </p>
    );
  }

  return (
    <Card className="rounded-2xl border border-black/[0.06] shadow-sm">
      <CardContent className="space-y-6 p-6">
        <div>
          <p className="text-sm font-semibold text-[#1a3c34]">
            Cài đặt chương trình giới thiệu
          </p>
          <Description className="text-xs text-foreground/55">
            Điều kiện đơn tối thiểu, % hoa hồng cho người mời và voucher chào mừng cho người đăng ký mới.
          </Description>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#f9fafb] px-4 py-3 ring-1 ring-black/[0.06]">
          <div>
            <Text className="text-sm font-semibold">Chương trình đang bật</Text>
            <Description className="text-xs">
              Tắt sẽ không tạo phần thưởng mới (logic nghiệp vụ phía server).
            </Description>
          </div>
          <Switch isSelected={isActive} onChange={setIsActive}>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>
        </div>

        <div className={`grid gap-5 sm:grid-cols-2 ${adminFieldStackLoose}`}>
          <div className={adminFieldStackLoose}>
            <Label className={adminLabelClass}>Đơn tối thiểu (VND)</Label>
            <Input
              className={adminInputClass}
              value={minOrderAmount}
              onChange={(e) => setMinOrderAmount(e.target.value)}
              inputMode="decimal"
            />
          </div>
          <div className={adminFieldStackLoose}>
            <Label className={adminLabelClass}>% Hoa hồng người mời (đơn đầu tiên)</Label>
            <div className="relative">
              <Input
                className={adminInputClass}
                value={referrerCommissionPercent}
                onChange={(e) => setReferrerCommissionPercent(e.target.value)}
                inputMode="decimal"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-foreground/40">%</span>
            </div>
            <p className="text-[11px] text-foreground/45">
              Người mời nhận {Number.parseFloat(referrerCommissionPercent) || 0}% giá trị đơn đầu tiên của người được mời quy thành điểm UjCha.
            </p>
          </div>
          <div className={`sm:col-span-2 ${adminFieldStackLoose}`}>
            <Label className={adminLabelClass}>Voucher chào mừng cho người đăng ký mới</Label>
            <select
              className="w-full rounded-lg border border-black/[0.1] bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#1a3c34]/30"
              value={welcomeVoucherId}
              onChange={(e) => setWelcomeVoucherId(e.target.value)}
            >
              <option value="">— Dùng voucher có cờ isWelcome —</option>
              {vouchers
                .filter((v) => v.isActive)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.code}) — {v.discountType === "percent" ? `${v.discountValue}%` : `${Number(v.discountValue).toLocaleString("vi-VN")}đ`}
                  </option>
                ))}
            </select>
            <p className="text-[11px] text-foreground/45">
              Voucher này sẽ được tặng tự động cho tất cả người dùng mới khi đăng ký.
            </p>
          </div>
          <div className={adminFieldStackLoose}>
            <Label className={adminLabelClass}>Giới hạn thưởng / ngày / referrer</Label>
            <Input
              className={adminInputClass}
              value={maxReferrerRewardsPerDay}
              onChange={(e) => setMaxReferrerRewardsPerDay(e.target.value)}
              inputMode="numeric"
            />
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-black/[0.06] bg-white px-4 py-4">
          <div>
            <p className="text-xs font-semibold text-[#1a3c34]">Mốc thưởng affiliate</p>
            <p className="mt-0.5 text-[11px] text-foreground/50">Mỗi mốc gồm số lượt giới thiệu hợp lệ tối thiểu và điểm UjCha thưởng một lần khi đạt ngưỡng.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { meta: DEFAULT_MILESTONE_TIERS[0], threshold: bronzeThreshold, setThreshold: setBronzeThreshold, points: bronzePoints, setPoints: setBronzePoints },
              { meta: DEFAULT_MILESTONE_TIERS[1], threshold: silverThreshold, setThreshold: setSilverThreshold, points: silverPoints, setPoints: setSilverPoints },
              { meta: DEFAULT_MILESTONE_TIERS[2], threshold: goldThreshold, setThreshold: setGoldThreshold, points: goldPoints, setPoints: setGoldPoints },
              { meta: DEFAULT_MILESTONE_TIERS[3], threshold: diamondThreshold, setThreshold: setDiamondThreshold, points: diamondPoints, setPoints: setDiamondPoints },
            ].map(({ meta, threshold, setThreshold, points, setPoints }) => {
              const Icon = meta.icon;
              return (
                <div
                  key={meta.id}
                  className={`rounded-xl bg-gradient-to-br ${meta.gradient} p-4 ring-1 ${meta.ring}`}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <div className={`flex size-7 items-center justify-center rounded-lg ${meta.iconBg}`}>
                      <Icon className="size-4" />
                    </div>
                    <span className={`text-sm font-semibold ${meta.text}`}>{meta.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className={adminFieldStackLoose}>
                      <Label className={adminLabelClass}>Lượt tối thiểu</Label>
                      <Input
                        className={adminInputClass}
                        value={threshold}
                        onChange={(e) => setThreshold(e.target.value)}
                        inputMode="numeric"
                      />
                    </div>
                    <div className={adminFieldStackLoose}>
                      <Label className={adminLabelClass}>Điểm thưởng</Label>
                      <Input
                        className={adminInputClass}
                        value={points}
                        onChange={(e) => setPoints(e.target.value)}
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                  <p className={`mt-2 text-[10px] ${meta.text} opacity-70`}>
                    Đạt {threshold || "?"} lượt → nhận {Number(points || 0).toLocaleString("vi-VN")} điểm
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-black/[0.06] bg-white px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Text className="text-sm font-semibold">Chặn cùng IP với referrer</Text>
              <Description className="text-xs">Giảm gian lận tự giới thiệu (chỉ ảnh hưởng thưởng hoa hồng, không ảnh hưởng voucher đăng ký).</Description>
            </div>
            <Switch isSelected={blockSameIp} onChange={setBlockSameIp}>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Text className="text-sm font-semibold">Chặn cùng thiết bị với referrer</Text>
              <Description className="text-xs">Theo deviceId đăng ký.</Description>
            </div>
            <Switch isSelected={blockSameDevice} onChange={setBlockSameDevice}>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch>
          </div>
        </div>

        {saveMut.isError ? (
          <p className="text-sm text-red-700">{axiosMessage(saveMut.error)}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            className="rounded-full bg-[#1a3c34] px-6 font-semibold text-white"
            onPress={() => saveMut.mutate()}
            isDisabled={saveMut.isPending}
          >
            {saveMut.isPending ? "Đang lưu…" : "Lưu cấu hình"}
          </Button>
          <Text className="text-xs text-foreground/45">
            Cập nhật lần cuối:{" "}
            {new Date(cfg.updatedAt).toLocaleString("vi-VN")}
          </Text>
        </div>
      </CardContent>
    </Card>
  );
}
