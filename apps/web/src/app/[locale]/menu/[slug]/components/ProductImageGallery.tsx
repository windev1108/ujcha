"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  images: string[];
  name: string;
  placeholderBg?: string;
};

export function ProductImageGallery({ images, name, placeholderBg = "#1a3c34" }: Props) {
  const t = useTranslations();
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  const hasImages = images.length > 0;
  const currentImage = images[active] ?? null;

  const go = useCallback((next: number, imgs: string[]) => {
    setDirection(next > active ? 1 : -1);
    setActive(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const prev = () => go((active - 1 + images.length) % images.length, images);
  const next = () => go((active + 1) % images.length, images);

  const variants = {
    enter: (d: number) => ({ x: d * 32, opacity: 0, scale: 0.97 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (d: number) => ({ x: d * -32, opacity: 0, scale: 0.97 }),
  };

  return (
    <>
      <div className="flex flex-col gap-2.5">

        {/* ── Main viewer ─────────────────────────────────────── */}
        <div className="group relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-[#f0f4f1] ring-1 ring-black/[0.07] shadow-[0_8px_32px_-12px_rgba(0,0,0,0.16)]">

          {/* Blurred ambient background — fills empty space with image color */}
          {currentImage && (
            <Image
              src={currentImage}
              alt=""
              fill
              aria-hidden
              unoptimized
              priority
              className="pointer-events-none select-none object-cover scale-110 blur-3xl opacity-25 saturate-150"
              sizes="80px"
            />
          )}

          {/* Placeholder monogram */}
          {!hasImages && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ backgroundColor: placeholderBg }}
            >
              <span className="select-none text-9xl font-black text-white/10">
                {name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          {/* Animated image */}
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={active}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
              className="absolute inset-0 flex items-center justify-center"
            >
              {currentImage && (
                <div className="relative h-full w-full">
                  <Image
                    src={currentImage}
                    alt={`${name} — ${active + 1}`}
                    fill
                    priority={active === 0}
                    unoptimized
                    className="object-contain drop-shadow-[0_4px_20px_rgba(0,0,0,0.14)] transition-transform duration-500 group-hover:scale-[1.03]"
                    sizes="(min-width: 1280px) 420px, (min-width: 1024px) 380px, (min-width: 640px) 60vw, 100vw"
                  />
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Zoom button */}
          {currentImage && (
            <button
              type="button"
              onClick={() => setLightbox(true)}
              aria-label="Xem ảnh đầy đủ"
              className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-white/80 opacity-0 shadow ring-1 ring-black/[0.07] backdrop-blur-sm transition-all duration-200 hover:bg-white group-hover:opacity-100"
            >
              <ZoomIn className="size-3.5 text-foreground/70" />
            </button>
          )}

          {/* Nav arrows */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={prev}
                aria-label={t("scroll_left")}
                className="absolute left-3 top-1/2 z-10 -translate-y-1/2 flex size-8 items-center justify-center rounded-full bg-white/85 shadow ring-1 ring-black/[0.06] backdrop-blur-sm transition hover:bg-white active:scale-95"
              >
                <ChevronLeft className="size-3.5 text-foreground" />
              </button>
              <button
                type="button"
                onClick={next}
                aria-label={t("scroll_right")}
                className="absolute right-3 top-1/2 z-10 -translate-y-1/2 flex size-8 items-center justify-center rounded-full bg-white/85 shadow ring-1 ring-black/[0.06] backdrop-blur-sm transition hover:bg-white active:scale-95"
              >
                <ChevronRight className="size-3.5 text-foreground" />
              </button>

              {/* Dot indicators */}
              <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => go(i, images)}
                    aria-label={`Ảnh ${i + 1}`}
                    className={`rounded-full bg-white shadow transition-all duration-200 ${
                      i === active ? "w-5 h-1.5" : "size-1.5 opacity-50 hover:opacity-80"
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Thumbnail strip ──────────────────────────────────── */}
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            {images.map((img, i) => (
              <button
                key={img}
                type="button"
                onClick={() => go(i, images)}
                aria-label={`Ảnh ${i + 1}`}
                className={`relative aspect-[3/4] w-[60px] shrink-0 overflow-hidden rounded-xl bg-[#f0f4f1] transition-all duration-200 ${
                  i === active
                    ? "ring-2 ring-kun-products-forest ring-offset-1 opacity-100"
                    : "ring-1 ring-black/[0.07] opacity-50 hover:opacity-85"
                }`}
              >
                <Image
                  src={img}
                  alt={`${name} ${i + 1}`}
                  fill
                  unoptimized
                  className="object-contain p-1"
                  sizes="60px"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Lightbox ─────────────────────────────────────────── */}
      <AnimatePresence>
        {lightbox && currentImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
            onClick={() => setLightbox(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              className="relative max-h-[90dvh] max-w-[90dvw] aspect-[3/4] w-full sm:w-auto sm:h-[85dvh]"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={currentImage}
                alt={`${name} — ${active + 1}`}
                fill
                unoptimized
                className="object-contain"
                sizes="90vw"
              />
            </motion.div>

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); prev(); }}
                  aria-label={t("scroll_left")}
                  className="absolute left-4 top-1/2 -translate-y-1/2 flex size-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-white/20"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); next(); }}
                  aria-label={t("scroll_right")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 flex size-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-white/20"
                >
                  <ChevronRight className="size-5" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setLightbox(false)}
              className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-white/20"
              aria-label="Đóng"
            >
              <span className="text-lg leading-none">×</span>
            </button>

            <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xs font-medium text-white/50">
              {active + 1} / {images.length}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
