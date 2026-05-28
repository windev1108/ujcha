"use client";

import { Card, CardContent } from "@heroui/react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { motion } from "motion/react";
import type { ReactNode } from "react";

type Props = {
  href: string;
  icon: LucideIcon;
  iconClassName?: string;
  iconWrapClassName?: string;
  title: string;
  subtitle: string;
  variant?: "default" | "danger";
  endContent?: ReactNode;
  /** Chấm đỏ trên icon (vd. thông báo mới). */
  showNotificationDot?: boolean;
};

export function ProfileMenuCard({
  href,
  icon: Icon,
  iconClassName = "text-kun-products-forest",
  iconWrapClassName = "bg-kun-sage/15",
  title,
  subtitle,
  variant = "default",
  endContent,
  showNotificationDot = false,
}: Props) {
  const isDanger = variant === "danger";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-32px" }}
      transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <Link
        href={href}
        className={`block rounded-3xl outline-offset-2 transition-colors ${
          isDanger
            ? "border border-red-100 bg-red-50/90 hover:bg-red-50"
            : "border border-border/80 bg-background hover:bg-background-secondary/60"
        }`}
      >
        <Card className="rounded-3xl border-0 bg-transparent shadow-none">
          <CardContent className="flex flex-row items-center gap-4 p-4 sm:p-5">
            <div
              className={`relative flex size-11 shrink-0 items-center justify-center rounded-full ${iconWrapClassName}`}
            >
              {showNotificationDot ? (
                <span className="absolute -right-0.5 -top-0.5 z-10 size-2 rounded-full bg-red-500 ring-2 ring-white" />
              ) : null}
              <Icon
                className={`size-5 ${isDanger ? "text-red-600" : iconClassName}`}
                strokeWidth={1.75}
              />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p
                className={`font-semibold ${isDanger ? "text-red-600" : "text-foreground"}`}
              >
                {title}
              </p>
              <p
                className={`mt-0.5 text-xs ${isDanger ? "text-red-500/90" : "text-muted"}`}
              >
                {subtitle}
              </p>
            </div>
            {endContent !== undefined ? endContent : (
              <ChevronRight
                className={`size-5 shrink-0 ${isDanger ? "text-red-400" : "text-muted"}`}
              />
            )}
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
