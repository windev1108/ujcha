"use client";

import { Info, MapPin, Navigation, Bike, Tag, X } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import type { PublicShippingConfig } from "@/services/shipping/api";

function fmtVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}

export function ShippingFeeTooltip({ config }: { config: PublicShippingConfig }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const scheduleClose = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), 80);
  }, []);

  const openTooltip = useCallback(() => {
    cancelClose();
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setStyle({
      position: "fixed",
      bottom: `${window.innerHeight - rect.top + 10}px`,
      left: `${rect.left + rect.width / 2}px`,
      transform: "translateX(-50%)",
      zIndex: 9999,
    });
    setOpen(true);
  }, [cancelClose]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const popup = document.getElementById("shipping-fee-tooltip");
      if (!btnRef.current?.contains(e.target as Node) && !popup?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  return (
    <span className="inline-flex items-center">
      <button
        ref={btnRef}
        type="button"
        aria-label={t("shipping_fee_guide_label")}
        onMouseEnter={openTooltip}
        onMouseLeave={scheduleClose}
        onClick={() => (open ? setOpen(false) : openTooltip())}
        className="flex items-center justify-center rounded-full p-0.5 text-foreground/35 transition-colors hover:text-kun-products-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kun-products-forest/40"
      >
        <Info className="size-3.5" />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            id="shipping-fee-tooltip"
            style={style}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            className="w-72 rounded-2xl border border-black/8 bg-white p-4 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.16)]"
          >
            <div className="absolute -bottom-[5px] left-1/2 size-2.5 -translate-x-1/2 rotate-45 border-b border-r border-black/8 bg-white" />

            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                {t("shipping_fee_guide_label")}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-5 items-center justify-center rounded-full text-foreground/30 transition-colors hover:bg-surface-card hover:text-foreground/60 sm:hidden"
              >
                <X className="size-3" />
              </button>
            </div>

            <ul className="space-y-2.5 text-xs">
              <li className="flex items-start gap-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#1a3c34]/8">
                  <Bike className="size-3.5 text-[#1a3c34]" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">{t("ship_guide_base")}</p>
                  <p className="mt-0.5 text-foreground/55">
                    {fmtVnd(config.baseFee)} {t("ship_guide_for_first")} {config.baseKm} km
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#1a3c34]/8">
                  <Navigation className="size-3.5 text-[#1a3c34]" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">{t("ship_guide_extra")}</p>
                  <p className="mt-0.5 text-foreground/55">
                    +{fmtVnd(config.feePerKm)}/{t("km_unit")} {t("ship_guide_after")} {config.baseKm} km
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-50">
                  <MapPin className="size-3.5 text-amber-600" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">{t("ship_guide_max_range")}</p>
                  <p className="mt-0.5 text-foreground/55">
                    {t("ship_guide_max_range_desc", { km: config.maxDistanceKm })}
                  </p>
                </div>
              </li>

              {config.freeShipDistanceKm > 0 && (
                <li className="flex items-start gap-2.5">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                    <Bike className="size-3.5 text-emerald-600" />
                  </span>
                  <div>
                    <p className="font-semibold text-emerald-700">{t("ship_guide_free_distance")}</p>
                    <p className="mt-0.5 text-foreground/55">
                      {t("ship_guide_free_distance_desc", { km: config.freeShipDistanceKm })}
                    </p>
                  </div>
                </li>
              )}

              {config.freeThreshold > 0 && (
                <li className="flex items-start gap-2.5">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                    <Tag className="size-3.5 text-emerald-600" />
                  </span>
                  <div>
                    <p className="font-semibold text-emerald-700">{t("ship_guide_free_amount")}</p>
                    <p className="mt-0.5 text-foreground/55">
                      {t("ship_guide_free_amount_desc", { amount: fmtVnd(config.freeThreshold) })}
                    </p>
                  </div>
                </li>
              )}
            </ul>

            <div className="mt-3 rounded-xl bg-surface-soft px-3 py-2.5 text-[11px] text-foreground/55">
              {t("ship_guide_formula", {
                base: fmtVnd(config.baseFee),
                baseKm: config.baseKm,
                perKm: fmtVnd(config.feePerKm),
              })}
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}
