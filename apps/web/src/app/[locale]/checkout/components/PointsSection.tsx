"use client";

import { Switch } from "@heroui/react";
import { Coins, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

type PointConfig = {
  pointRate: number;
  maxUsagePercent: number;
  minOrderAmountToSpend: number;
};

type Props = {
  pointBalance: number;
  pointConfig?: PointConfig;
  subtotal: number;
  pointsToUse: number;
  onChange: (points: number) => void;
};

function formatVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}

export function PointsSection({
  pointBalance,
  pointConfig,
  subtotal,
  pointsToUse,
  onChange,
}: Props) {
  const t = useTranslations();
  const [inputValue, setInputValue] = useState(pointsToUse > 0 ? String(pointsToUse) : "");
  const [showInfo, setShowInfo] = useState(false);

  // Đồng bộ input khi parent clamp lại giá trị (VD: subtotal đổi làm maxUsable giảm)
  useEffect(() => {
    setInputValue(pointsToUse > 0 ? String(pointsToUse) : "");
  }, [pointsToUse]);

  if (pointBalance < 1) return null;

  const pointRate = pointConfig?.pointRate ?? 0;
  const maxUsagePercent = pointConfig?.maxUsagePercent ?? 100;
  const minOrderAmountToSpend = pointConfig?.minOrderAmountToSpend ?? 0;

  const maxMoneyByPercent = subtotal * (maxUsagePercent / 100);
  const maxPointsByPercent =
    pointRate > 0 ? Math.floor(maxMoneyByPercent / pointRate) : pointBalance;
  const maxUsablePoints = Math.max(0, Math.min(pointBalance, maxPointsByPercent));

  const belowMinOrder = minOrderAmountToSpend > 0 && subtotal < minOrderAmountToSpend;
  const usePoints = pointsToUse > 0;
  const discount = Math.min(pointsToUse, maxUsablePoints) * pointRate;

  function commit(raw: string) {
    const parsed = Math.floor(Number(raw.replace(/[^\d]/g, "")) || 0);
    const clamped = Math.max(0, Math.min(parsed, maxUsablePoints));
    setInputValue(clamped > 0 ? String(clamped) : "");
    onChange(clamped);
  }

  function handleToggle() {
    if (usePoints) {
      setInputValue("");
      onChange(0);
    } else {
      setInputValue(maxUsablePoints > 0 ? String(maxUsablePoints) : "");
      onChange(maxUsablePoints);
    }
  }

  return (
    <div
      className={`rounded-2xl border px-4 py-3 transition ${usePoints ? "border-kun-primary/25 bg-kun-primary/5" : "border-black/8 bg-white"
        }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div
          role="button"
          tabIndex={0}
          onClick={handleToggle}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleToggle();
            }
          }}
        >
          <div
            className={`flex size-8 shrink-0 items-center justify-center rounded-full ${usePoints ? "bg-kun-primary text-white" : "bg-surface-card text-foreground/50"
              }`}
          >
            <Coins className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <p className={`text-sm font-semibold ${usePoints ? "text-kun-primary" : "text-foreground"}`}>
                {t("points_label")}
              </p>
              <span
                className="relative inline-flex"
                onMouseEnter={() => setShowInfo(true)}
                onMouseLeave={() => setShowInfo(false)}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowInfo((v) => !v);
                  }}
                  className="flex size-4 items-center justify-center rounded-full text-foreground/35 transition hover:text-foreground/60"
                  aria-label={t("points_info_label")}
                >
                  <Info className="size-3.5" />
                </button>

                {showInfo && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowInfo(false);
                      }}
                    />
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 rounded-xl border border-black/8 bg-white p-3 text-left text-xs text-foreground/70 shadow-lg"
                    >
                      <p className="font-semibold text-foreground">{t("points_info_title")}</p>
                      <ul className="mt-1.5 space-y-1">
                        <li>{t("points_info_rate", { rate: formatVnd(pointRate) })}</li>
                        <li>{t("points_info_max_percent", { percent: maxUsagePercent })}</li>
                        {minOrderAmountToSpend > 0 && (
                          <li>
                            {t("points_info_min_order", { amount: formatVnd(minOrderAmountToSpend) })}
                          </li>
                        )}
                      </ul>
                      <div className="absolute left-1/2 top-full -translate-x-1/2 border-8 border-transparent border-t-white" />
                    </div>
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-foreground/55">
              {t("points_count", { count: pointBalance.toLocaleString("vi-VN") })}
              {usePoints && discount > 0 && (
                <> · {t("points_saving", { amount: formatVnd(discount) })}</>
              )}
            </p>
          </div>
        </div>
        <Switch isSelected={usePoints} onChange={handleToggle}>
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>
      </div>

      {usePoints && (
        <div className="mt-3 flex items-center gap-2 border-t border-black/6 pt-3">
          <input
            type="text"
            inputMode="numeric"
            value={inputValue}
            max={maxUsablePoints}
            onChange={(e) => {
              const digitsOnly = e.target.value.replace(/[^\d]/g, "");
              const parsed = Math.floor(Number(digitsOnly) || 0);
              if (parsed > maxUsablePoints) {
                setInputValue(String(maxUsablePoints));
                onChange(maxUsablePoints);
                return;
              }
              setInputValue(digitsOnly);
              onChange(parsed);
            }}
            placeholder="0"
            className="h-9 w-full min-w-0 rounded-lg border border-black/10 bg-white px-3 text-sm tabular-nums focus:border-kun-primary/40 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => commit(String(maxUsablePoints))}
            className="shrink-0 whitespace-nowrap rounded-lg border border-black/10 px-3 py-2 text-xs font-semibold text-foreground/70 transition hover:bg-black/5"
          >
            {t("points_use_max")}
          </button>
        </div>
      )}

      {usePoints && belowMinOrder && (
        <p className="mt-2 text-[11px] font-medium text-amber-600">
          {t("points_below_min_order", { amount: formatVnd(minOrderAmountToSpend) })}
        </p>
      )}
    </div>
  );
}