"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPin, Clock, Phone } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { usePublicStoreLocationQuery, usePublicDeliveryPlatformsQuery } from "@/services/store/hooks";
import { Logo } from "../common/Logo";
import { useTranslations } from "next-intl";

const LeafletMap = dynamic(() => import("../common/LeafletMapInner"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse rounded-2xl bg-surface-card" />
  ),
});



function minutesToTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

export default function Footer() {
  const { data: location } = usePublicStoreLocationQuery();
  const { data: platforms = [] } = usePublicDeliveryPlatformsQuery();
  const hasCoords = location && location.lat !== 0 && location.lng !== 0;
  const t = useTranslations();
  const phone = location?.phone ?? null;
  const hours = location?.shiftConfig
    ? `${minutesToTime(location.shiftConfig.startMinutes)} – ${minutesToTime(location.shiftConfig.endMinutes)}`
    : null;
  const NAV_LINKS = [
    { href: ROUTES.PRODUCTS, label: t('menu') },
    { href: ROUTES.PROMOTIONS, label: t('promotions') },
    { href: ROUTES.REFERRAL, label: t('referral_and_earn') },
    { href: ROUTES.ABOUT, label: t('about') },
    { href: ROUTES.FEEDBACK, label: t('feedback') },
  ] as const;
  return (
    <footer className="mt-auto border-t border-border bg-surface-soft">
      <div className="container mx-auto px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="flex flex-col gap-4">
            <Logo horizontal={false} size="md" className="self-start" />
            {/* <p className="max-w-xs text-sm leading-relaxed text-muted">
              Stone-ground ceremonial matcha và các thức uống thủ công, chọn lọc kỹ lưỡng cho nghi thức thường ngày của bạn.
            </p> */}
          </div>

          {/* Navigation */}
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
              {t('explore')}
            </p>
            <ul className="flex flex-col gap-2">
              {NAV_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-foreground/65 transition-colors hover:text-kun-primary"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Store info */}
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
              {t('store')}
            </p>
            <ul className="flex flex-col gap-3">
              {location?.address && (
                <li className="flex items-start gap-2.5 text-sm text-foreground/65">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-kun-primary" />
                  <span>{location.address}</span>
                </li>
              )}
              {hours && (
                <li className="flex items-center gap-2.5 text-sm text-foreground/65">
                  <Clock className="size-4 shrink-0 text-kun-primary" />
                  <span>{hours}, {t('every_day')}</span>
                </li>
              )}
              {phone && (
                <li className="flex items-center gap-2.5 text-sm text-foreground/65">
                  <Phone className="size-4 shrink-0 text-kun-primary" />
                  <a href={`tel:${phone.replace(/\s/g, "")}`} className="hover:text-kun-primary transition-colors">
                    {phone}
                  </a>
                </li>
              )}
            </ul>
            {hasCoords && (
              <a
                href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-foreground/65 transition-colors hover:border-kun-primary/30 hover:text-kun-primary"
              >
                <MapPin className="size-3" />
                {t('view_on')} Google Maps
              </a>
            )}
          </div>

          {/* Delivery platforms — only rendered when configured, sits between store info and map */}
          {platforms.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                {t('order_on')}
              </p>
              <ul className="flex flex-col gap-3">
                {platforms.map((p) => (
                  <li key={p.id}>
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2.5 text-sm text-foreground/65 transition-colors hover:text-kun-primary"
                    >
                      <img
                        src={p.thumbnailUrl}
                        alt={p.name}
                        width={p.logoWidth}
                        height={p.logoHeight}
                        style={{ width: p.logoWidth, height: p.logoHeight }}
                        className="shrink-0 object-contain"
                      />
                      {p.displayMode === 'logo_and_text' && p.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Map — always last */}
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
              {t('location')}
            </p>
            <div className="h-44 w-full overflow-hidden rounded-2xl border border-black/6">
              {hasCoords ? (
                <LeafletMap
                  lat={location.lat}
                  lng={location.lng}
                  address={location.address}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-surface-card text-xs text-muted">
                  {t('not_config_location')}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-black/6 pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-muted/80">
            © {new Date().getFullYear()} UjCha. All rights reserved.
          </p>
          <div className="flex gap-4">
            <Link href={ROUTES.TERMS} className="text-xs text-muted/80 hover:text-foreground transition-colors">
              {t('terms')}
            </Link>
            <Link href={ROUTES.PRIVACY} className="text-xs text-muted/80 hover:text-foreground transition-colors">
              {t('privacy')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
