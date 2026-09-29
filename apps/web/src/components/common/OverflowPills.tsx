"use client";

import { Tooltip } from "@heroui/react";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type PillItem = { id: string; label: string };

const GAP = 6; // gap-1.5
const PANEL_WIDTH = 192; // w-48

function TruncatedButton({
  label,
  className,
  onClick,
  triggerClassName,
}: {
  label: string;
  className: string;
  onClick: () => void;
  triggerClassName?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [truncated, setTruncated] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setTruncated(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [label]);

  return (
    <Tooltip delay={0.1} isDisabled={!truncated}>
      <Tooltip.Content>{label}</Tooltip.Content>
      <Tooltip.Trigger className={triggerClassName}>
        <button ref={ref} type="button" onClick={onClick} className={className}>
          {label}
        </button>
      </Tooltip.Trigger>
    </Tooltip>
  );
}

type Props = {
  items: PillItem[];
  activeId: string;
  onSelect: (id: string) => void;
  /** class cơ bản của pill (không cần max-w/truncate, component tự thêm) */
  pillClass: (active: boolean) => string;
  plusClass: (active: boolean) => string;
  itemClass: (active: boolean) => string;
  moreLabel?: string;
  plusWidth?: number;
  pillMaxClass?: string;
};

export function OverflowPills({
  items,
  activeId,
  onSelect,
  pillClass,
  plusClass,
  itemClass,
  moreLabel = "Xem thêm",
  plusWidth = 32,
  pillMaxClass = "xl:max-w-[210px] lg:max-w-[150px] max-w-[100px]",
}: Props) {
  const rowRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const morePanelRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(Number.POSITIVE_INFINITY);
  const [moreOpen, setMoreOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const fullPill = (active: boolean) =>
    `${pillClass(active)} ${pillMaxClass} shrink-0 truncate`;

  const recalc = useCallback(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return;

    const widths = Array.from(measure.children).map((c) => (c as HTMLElement).offsetWidth);
    const fit = (limit: number) => {
      let used = 0;
      let n = 0;
      for (const w of widths) {
        const next = used + (n > 0 ? GAP : 0) + w;
        if (next > limit) break;
        used = next;
        n++;
      }
      return n;
    };

    const available = row.clientWidth;
    let n = fit(available);
    if (n < widths.length) n = Math.max(1, fit(available - plusWidth - GAP));
    setVisibleCount(n);
  }, [plusWidth]);

  useLayoutEffect(() => {
    recalc();
  }, [items, recalc]);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const ro = new ResizeObserver(recalc);
    ro.observe(row);
    return () => ro.disconnect();
  }, [recalc]);

  useEffect(() => {
    document.fonts?.ready.then(recalc);
  }, [recalc, items]);

  useEffect(() => {
    if (!moreOpen) return;
    const close = () => setMoreOpen(false);
    const onScroll = (e: Event) => {
      // Scroll bên trong dropdown thì không đóng
      if (morePanelRef.current?.contains(e.target as Node)) return;
      setMoreOpen(false);
    };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [moreOpen]);
  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (morePanelRef.current?.contains(target)) return;
      if (moreBtnRef.current?.contains(target)) return;
      setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moreOpen]);

  const visibleItems = items.slice(0, visibleCount);
  const overflowItems = items.slice(visibleCount);
  const isActiveInOverflow = overflowItems.some((i) => i.id === activeId);

  const toggleMore = () => {
    const btn = moreBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, rect.right - PANEL_WIDTH),
      window.innerWidth - PANEL_WIDTH - 8,
    );
    setPanelStyle({
      position: "fixed",
      top: rect.bottom + 6,
      left,
      width: PANEL_WIDTH,
      zIndex: 10000,
    });
    setMoreOpen((v) => !v);
  };

  useEffect(() => {
    if (overflowItems.length === 0) setMoreOpen(false);
  }, [overflowItems.length]);

  useEffect(() => {
    const mq = ["(min-width: 1024px)", "(min-width: 1280px)"].map((q) => window.matchMedia(q));
    mq.forEach((m) => m.addEventListener("change", recalc));
    return () => mq.forEach((m) => m.removeEventListener("change", recalc));
  }, [recalc]);
  return (
    <div ref={rowRef} className="relative min-w-0 flex-1 overflow-hidden">
      {/* Layer ẩn để đo width */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 flex h-0 w-max gap-1.5 overflow-hidden"
      >
        {items.map((item) => (
          <span key={item.id} className={fullPill(false)}>
            {item.label}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        {visibleItems.map((item) => (
          <TruncatedButton
            key={item.id}
            label={item.label}
            onClick={() => onSelect(item.id)}
            className={fullPill(activeId === item.id)}
          />
        ))}

        {overflowItems.length > 0 && (
          <div className="relative shrink-0">
            <button
              type="button"
              ref={moreBtnRef}
              onClick={toggleMore}
              aria-label={moreLabel}
              title={moreLabel}
              className={`cursor-pointer flex items-center justify-center rounded-full transition-colors ${plusClass(isActiveInOverflow || moreOpen)}`}
              style={{ width: plusWidth, height: plusWidth }}
            >
              <Plus className="size-3.5" />
            </button>

            {moreOpen &&
              typeof document !== "undefined" &&
              createPortal(
                <div
                  ref={morePanelRef}
                  style={panelStyle}
                  className="max-h-60 overflow-y-auto rounded-xl border border-black/8 bg-white py-1 shadow-2xl"
                >
                  {overflowItems.map((item) => (
                    <TruncatedButton
                      key={item.id}
                      label={item.label}
                      triggerClassName="w-full"
                      onClick={() => {
                        onSelect(item.id);
                        setMoreOpen(false);
                      }}
                      className={`cursor-pointer block w-full truncate px-3 py-2 text-left transition-colors ${itemClass(activeId === item.id)}`}
                    />
                  ))}
                </div>,
                document.body,
              )}
          </div>
        )}
      </div>
    </div>
  );
}