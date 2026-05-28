"use client";

import { Card, CardContent } from "@heroui/react";
import { Crown, Gem, Medal, Star, Trophy } from "lucide-react";
import Link from "next/link";

import { ROUTES } from "@/lib/routes";
import { formatCompactCount } from "@/app/(landing)/components/dashboard-utils";
import type { AdminReferralDashboard } from "@/services/admin/types";
import {
  TierBadge,
  MilestoneProgressBar,
  getTierForCount,
  DEFAULT_MILESTONE_TIERS,
} from "./ReferralMilestoneSection";

type Props = {
  data: AdminReferralDashboard | undefined;
  isLoading: boolean;
};

type RankConfig = {
  bg: string;
  ring: string;
  text: string;
  icon: React.ElementType | null;
  iconColor: string;
};

function getRankConfig(rank: number): RankConfig {
  switch (rank) {
    case 1:
      return {
        bg: "bg-gradient-to-br from-amber-50 to-yellow-100",
        ring: "ring-yellow-300",
        text: "text-amber-700",
        icon: Crown,
        iconColor: "text-amber-500",
      };
    case 2:
      return {
        bg: "bg-gradient-to-br from-slate-50 to-zinc-100",
        ring: "ring-slate-300",
        text: "text-slate-600",
        icon: Medal,
        iconColor: "text-slate-400",
      };
    case 3:
      return {
        bg: "bg-gradient-to-br from-orange-50 to-amber-100",
        ring: "ring-orange-200",
        text: "text-orange-700",
        icon: Medal,
        iconColor: "text-orange-400",
      };
    default:
      return {
        bg: "bg-[#fafafa]",
        ring: "ring-black/[0.06]",
        text: "text-foreground/60",
        icon: null,
        iconColor: "",
      };
  }
}

function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return `${p[0][0] ?? ""}${p[p.length - 1]?.[0] ?? ""}`.toUpperCase();
}

export function ReferralTopFive({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_12px_40px_-24px_rgba(0,0,0,0.15)]">
        <CardContent className="h-[340px] animate-pulse p-5" />
      </Card>
    );
  }

  const rows = data?.topReferrers ?? [];
  const totalInvites = rows.reduce((s, r) => s + r.inviteCount, 0);
  const max = rows[0]?.inviteCount ?? 1;

  return (
    <Card className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_12px_40px_-24px_rgba(0,0,0,0.15)]">
      <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
        {/* header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/45">
              Bảng xếp hạng
            </p>
            <p className="mt-0.5 text-base font-semibold text-[#1a3c34]">
              Top người giới thiệu
            </p>
          </div>
          <div className="flex items-center gap-2">
            {totalInvites > 0 && (
              <span className="rounded-full bg-[#1a3c34]/8 px-2.5 py-1 text-[11px] font-semibold text-[#1a3c34]">
                {totalInvites} lượt
              </span>
            )}
            <Link
              href={`${ROUTES.REFERRALS}?tab=list`}
              className="text-xs font-semibold text-[#14532d] hover:underline"
            >
              Xem tất cả
            </Link>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-[#f3f4f6]">
              <Trophy className="size-6 text-foreground/30" />
            </div>
            <p className="text-sm text-foreground/50">
              Chưa có dữ liệu bảng xếp hạng.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {rows.map((r) => {
              const cfg = getRankConfig(r.rank);
              const RankIcon = cfg.icon;
              const barWidth = max > 0 ? (r.inviteCount / max) * 100 : 0;
              const tier = getTierForCount(r.inviteCount);

              return (
                <li
                  key={r.userId}
                  className={`relative overflow-hidden rounded-xl px-3 py-3 ring-1 ${cfg.bg} ${cfg.ring}`}
                >
                  {/* progress bar bg */}
                  <div
                    className="pointer-events-none absolute inset-y-0 left-0 rounded-xl opacity-[0.07] bg-[#1a3c34] transition-all"
                    style={{ width: `${barWidth}%` }}
                    aria-hidden
                  />

                  <div className="relative flex items-center gap-3">
                    {/* rank badge */}
                    <div
                      className={`relative flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ${cfg.ring} ${r.rank <= 3 ? cfg.bg : "bg-black/[0.04]"
                        } ${cfg.text}`}
                    >
                      {r.rank <= 3 && RankIcon ? (
                        <RankIcon className={`size-4 ${cfg.iconColor}`} />
                      ) : (
                        r.rank
                      )}
                    </div>

                    {/* avatar initials */}
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1a3c34]/10 text-[11px] font-bold text-[#1a3c34]">
                      {initials(r.name)}
                    </div>

                    {/* info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {r.name}
                        </p>
                        {tier && <TierBadge count={r.inviteCount} />}
                      </div>
                      <div className="mt-0.5">
                        <MilestoneProgressBar count={r.inviteCount} />
                      </div>
                    </div>

                    {/* stats */}
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold tabular-nums text-[#1a3c34]">
                        {r.inviteCount}
                      </p>
                      <p className="text-[10px] text-foreground/45">lượt</p>
                      <p className="mt-0.5 text-[10px] font-medium tabular-nums text-foreground/60">
                        {formatCompactCount(r.pointsFromReferral)} điểm
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* tier legend */}
        <div className="flex flex-wrap gap-1.5 border-t border-black/[0.05] pt-3">
          {DEFAULT_MILESTONE_TIERS.map((t) => {
            const Icon = t.icon;
            return (
              <span
                key={t.id}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.badge}`}
              >
                <Icon className="size-3" />
                {t.label} ≥{t.threshold}
              </span>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
