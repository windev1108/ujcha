"use client";

import { Fragment } from "react";
import { Card, CardContent } from "@heroui/react";
import { CheckCircle2, ChevronRight, Crown, Gem, Medal, Shield, Star, Trophy, Users } from "lucide-react";
import type { AdminReferralDashboard } from "@/services/admin/types";

export type MilestoneTier = {
  id: string;
  label: string;
  threshold: number;
  reward: string;
  rewardShort: string;
  icon: React.ElementType;
  gradient: string;
  ring: string;
  badge: string;
  text: string;
  iconBg: string;
};

export const DEFAULT_MILESTONE_TIERS: MilestoneTier[] = [
  {
    id: "bronze",
    label: "Đồng",
    threshold: 5,
    reward: "+100 điểm UjCha + badge Đồng",
    rewardShort: "+100 điểm",
    icon: Shield,
    gradient: "from-amber-50 to-orange-50",
    ring: "ring-amber-200/80",
    badge: "bg-amber-100 text-amber-800",
    text: "text-amber-700",
    iconBg: "bg-amber-100 text-amber-600",
  },
  {
    id: "silver",
    label: "Bạc",
    threshold: 10,
    reward: "+250 điểm + voucher 10% ưu đãi",
    rewardShort: "+250 điểm",
    icon: Medal,
    gradient: "from-slate-50 to-zinc-50",
    ring: "ring-slate-200/80",
    badge: "bg-slate-100 text-slate-700",
    text: "text-slate-600",
    iconBg: "bg-slate-100 text-slate-500",
  },
  {
    id: "gold",
    label: "Vàng",
    threshold: 50,
    reward: "+1000 điểm + voucher 20% + danh hiệu Ambassador",
    rewardShort: "+1000 điểm",
    icon: Star,
    gradient: "from-yellow-50 to-amber-50",
    ring: "ring-yellow-300/80",
    badge: "bg-yellow-100 text-yellow-800",
    text: "text-yellow-700",
    iconBg: "bg-yellow-100 text-yellow-600",
  },
  {
    id: "diamond",
    label: "Kim cương",
    threshold: 100,
    reward: "+3000 điểm + voucher 30% + hoa hồng đặc biệt",
    rewardShort: "+3000 điểm",
    icon: Gem,
    gradient: "from-violet-50 to-indigo-50",
    ring: "ring-violet-200/80",
    badge: "bg-violet-100 text-violet-800",
    text: "text-violet-700",
    iconBg: "bg-violet-100 text-violet-600",
  },
];

export function getTierForCount(count: number, tiers = DEFAULT_MILESTONE_TIERS): MilestoneTier | null {
  const earned = [...tiers].reverse().find((t) => count >= t.threshold);
  return earned ?? null;
}

export function getNextTier(count: number, tiers = DEFAULT_MILESTONE_TIERS): MilestoneTier | null {
  return tiers.find((t) => count < t.threshold) ?? null;
}

function JourneyPath({ tiers }: { tiers: MilestoneTier[] }) {
  return (
    <div className="mb-4 overflow-x-auto rounded-xl border border-black/[0.06] bg-gradient-to-r from-[#f9fafb] to-white px-5 py-4">
      <div className="flex min-w-max items-center">
        <div className="flex shrink-0 flex-col items-center gap-1">
          <div className="flex size-8 items-center justify-center rounded-full bg-black/[0.06] ring-1 ring-black/[0.08]">
            <span className="text-[9px] font-bold text-foreground/40">0</span>
          </div>
          <span className="text-[9px] text-foreground/35">Khởi đầu</span>
        </div>

        {tiers.map((tier) => {
          const Icon = tier.icon;
          return (
            <Fragment key={tier.id}>
              <div className="flex shrink-0 items-center">
                <div className="h-px w-8 bg-black/[0.10] sm:w-14" />
                <ChevronRight className="size-3 shrink-0 text-foreground/20" />
                <div className="h-px w-2 bg-black/[0.10]" />
              </div>
              <div className="flex shrink-0 flex-col items-center gap-1">
                <div className={`flex size-10 items-center justify-center rounded-full ${tier.iconBg} ring-1 ring-black/[0.06]`}>
                  <Icon className="size-5" />
                </div>
                <span className={`text-[9px] font-bold ${tier.text}`}>{tier.label}</span>
                <span className="text-[8px] text-foreground/35 tabular-nums">{tier.threshold}+ lượt</span>
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

type Props = {
  data: AdminReferralDashboard | undefined;
  isLoading: boolean;
};

export function ReferralMilestoneSection({ data, isLoading }: Props) {
  const topReferrers = data?.topReferrers ?? [];
  const claims = data?.milestoneClaims;
  const mc = data?.milestoneConfig;

  const activeTiers: MilestoneTier[] = DEFAULT_MILESTONE_TIERS.map((t) => ({
    ...t,
    threshold: mc ? mc[`${t.id}Threshold` as keyof typeof mc] as number : t.threshold,
    reward: t.reward,
    rewardShort: mc ? `+${(mc[`${t.id}Points` as keyof typeof mc] as number).toLocaleString("vi-VN")} điểm` : t.rewardShort,
  }));

  const tierStats = activeTiers.map((tier) => ({
    tier,
    usersReached: topReferrers.filter((r) => r.inviteCount >= tier.threshold).length,
    claimCount: claims ? claims[tier.id as keyof typeof claims] : null,
  }));

  if (isLoading) {
    return (
      <Card className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_12px_40px_-24px_rgba(0,0,0,0.15)]">
        <CardContent className="h-[340px] animate-pulse p-5" />
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_12px_40px_-24px_rgba(0,0,0,0.15)]">
      <CardContent className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/45">
              Affiliate
            </p>
            <p className="mt-0.5 text-base font-semibold text-[#1a3c34]">
              Mốc thưởng chương trình giới thiệu
            </p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-[#1a3c34]/8 px-3 py-1 text-xs font-semibold text-[#1a3c34]">
            <Trophy className="size-3.5" />
            Càng mời càng nhận
          </span>
        </div>

        <JourneyPath tiers={activeTiers} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tierStats.map(({ tier, usersReached, claimCount }) => {
            const Icon = tier.icon;

            return (
              <div
                key={tier.id}
                className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${tier.gradient} p-5 ring-1 ${tier.ring}`}
              >
                <div className="pointer-events-none absolute -right-3 -top-3 size-16 rounded-full opacity-[0.15] blur-xl"
                  style={{ background: "currentColor" }} aria-hidden />

                <div className="flex items-start justify-between gap-2">
                  <div className={`flex size-10 items-center justify-center rounded-xl ${tier.iconBg}`}>
                    <Icon className="size-5" />
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tier.badge}`}>
                    {tier.label}
                  </span>
                </div>

                <div className="mt-4">
                  <p className={`text-2xl font-bold tabular-nums ${tier.text}`}>
                    {tier.threshold}+
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-foreground/60">
                    lượt giới thiệu
                  </p>
                </div>

                <div className="mt-3 border-t border-black/[0.06] pt-3">
                  <p className={`text-xs font-semibold ${tier.text}`}>
                    {tier.rewardShort}
                  </p>
                  <p className="mt-0.5 text-[11px] text-foreground/55 leading-relaxed">
                    {tier.reward}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-black/[0.04] px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <Users className="size-3 text-foreground/40" />
                    <p className="text-[11px] text-foreground/55">
                      <span className="font-bold text-foreground/80">{usersReached}</span>
                      {" "}/ top 5
                    </p>
                  </div>
                  {claimCount !== null && (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="size-3 text-emerald-500" />
                      <p className="text-[11px] text-foreground/55">
                        <span className="font-bold text-emerald-700">{claimCount}</span>
                        {" "}claim
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function TierBadge({ count }: { count: number }) {
  const tier = getTierForCount(count);
  if (!tier) {
    return (
      <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-semibold text-foreground/50">
        Mới
      </span>
    );
  }
  const Icon = tier.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tier.badge}`}>
      <Icon className="size-3" />
      {tier.label}
    </span>
  );
}

export function MilestoneProgressBar({ count }: { count: number }) {
  const next = getNextTier(count);
  const current = getTierForCount(count);

  if (!next) {
    return (
      <div className="flex items-center gap-2">
        <Crown className="size-3.5 text-violet-500" />
        <span className="text-[11px] font-semibold text-violet-600">
          Đỉnh cao — Kim cương
        </span>
      </div>
    );
  }

  const prevThreshold = current?.threshold ?? 0;
  const range = next.threshold - prevThreshold;
  const progress = Math.min(1, (count - prevThreshold) / range);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-foreground/50">
        <span>
          Còn{" "}
          <span className="font-semibold text-foreground/80">
            {next.threshold - count}
          </span>{" "}
          lượt → {next.label}
        </span>
        <span>{Math.round(progress * 100)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
        <div
          className="h-full rounded-full bg-[#1a3c34] transition-all"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}
