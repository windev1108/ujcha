import { Card, CardContent } from "@heroui/react";
import type { ReactNode } from "react";

type MetricCardProps = {
  title: string;
  value: string;
  badge?: string;
  badgeVariant?: "positive" | "neutral" | "outline";
  subtitle?: string;
  /** Thanh progress mỏng phía dưới (0–1) */
  progress?: number;
  /** Nội dung thêm: avatar stack, link, v.v. */
  extra?: ReactNode;
  className?: string;
  /** Nền accent (UjCha Points) */
  variant?: "default" | "accent";
};

export function MetricCard({
  title,
  value,
  badge,
  badgeVariant = "positive",
  subtitle,
  progress,
  extra,
  className,
  variant = "default",
}: MetricCardProps) {
  const isAccent = variant === "accent";

  const badgeClass =
    badgeVariant === "positive"
      ? isAccent
        ? "bg-white/20 text-white"
        : "bg-[color-mix(in_oklab,#71b394_18%,transparent)] text-[#14532d]"
      : badgeVariant === "outline"
        ? isAccent
          ? "border border-white/30 bg-transparent text-white"
          : "border border-black/10 bg-transparent text-foreground/80"
        : isAccent
          ? "bg-white/15 text-white/95"
          : "bg-black/[0.05] text-foreground/75";

  return (
    <Card
      className={`overflow-hidden rounded-2xl border border-black/[0.06] shadow-[0_12px_40px_-24px_rgba(0,0,0,0.2)] ${isAccent
        ? "border-transparent bg-[#5a8f7a] text-white"
        : "bg-white"
        } ${className ?? ""}`}
    >
      <CardContent className="relative flex flex-col gap-3 p-5">
        {isAccent ? (
          <div
            className="pointer-events-none absolute -right-4 -top-4 size-24 opacity-[0.12]"
            aria-hidden
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-full">
              <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6-4.6-6 4.6 2.3-7-6-4.6h7.6z" />
            </svg>
          </div>
        ) : null}

        <p
          className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isAccent ? "text-white/85" : "text-foreground/50"
            }`}
        >
          {title}
        </p>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p
            className={`text-2xl font-bold tracking-tight sm:text-[1.65rem] ${isAccent ? "text-white" : "text-foreground"
              }`}
          >
            {value}
          </p>
          {badge ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeClass}`}
            >
              {badge}
            </span>
          ) : null}
        </div>
        {subtitle ? (
          <p
            className={`text-xs ${isAccent ? "text-white/80" : "text-foreground/55"}`}
          >
            {subtitle}
          </p>
        ) : null}
        <>
          {extra}
        </>
        {typeof progress === "number" ? (
          <div
            className={`mt-1 h-1 w-full overflow-hidden rounded-full ${isAccent ? "bg-white/20" : "bg-black/[0.06]"
              }`}
          >
            <div
              className={`h-full rounded-full ${isAccent ? "bg-white" : "bg-[#71b394]"}`}
              style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
