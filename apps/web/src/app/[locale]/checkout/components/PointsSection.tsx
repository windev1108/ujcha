"use client";

import { Coins } from "lucide-react";

type Props = {
  pointBalance: number;
  pointRate: number;
  usePoints: boolean;
  pointDiscount: number;
  onToggle: (use: boolean) => void;
};

function formatVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}

export function PointsSection({ pointBalance, pointRate, usePoints, pointDiscount, onToggle }: Props) {
  if (pointBalance < 1) return null;

  const estimatedDiscount = pointBalance * pointRate;

  return (
    <button
      type="button"
      onClick={() => onToggle(!usePoints)}
      className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${usePoints
          ? "border-kun-primary/25 bg-kun-primary/5"
          : "border-black/8 bg-white hover:border-black/15"
        }`}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-full ${usePoints ? "bg-kun-primary text-white" : "bg-surface-card text-foreground/50"
            }`}
        >
          <Coins className="size-4" />
        </div>
        <div>
          <p className={`text-sm font-semibold ${usePoints ? "text-kun-primary" : "text-foreground"}`}>
            Điểm UjCha
          </p>
          <p className="text-xs text-foreground/55">
            {pointBalance.toLocaleString("vi-VN")} điểm
            {" · "}
            {usePoints
              ? `Tiết kiệm -${formatVnd(pointDiscount)}`
              : `≈ ${formatVnd(estimatedDiscount)}`}
          </p>
        </div>
      </div>
      <div
        className={`size-5 shrink-0 rounded-full border-2 transition ${usePoints ? "border-kun-primary bg-kun-primary" : "border-black/20 bg-white"
          }`}
      >
        {usePoints && (
          <svg viewBox="0 0 20 20" fill="white" className="size-full p-0.5">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>
    </button>
  );
}
