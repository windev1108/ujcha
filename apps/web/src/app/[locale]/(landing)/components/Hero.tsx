"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { useLocale } from "next-intl";

export interface FigurineSlide {
  src: string;
  bg: string;
  name: string;
  series: string;
  ghostText: string;
  slug: string;
  description: string | { vi: string; en: string };
}

const IMAGES: FigurineSlide[] = [
  {
    src: "/images/matcha-oreo.png",
    bg: "#443224",
    name: "Matcha OREO",
    series: "Mix OREO",
    ghostText: "Mix OREO",
    slug: '/matcha-oreo-kem-cheese',
    description: {
      vi: "Bột matcha Nhật Bản thượng hạng kết hợp sữa tươi thanh trùng, hoà quyện cùng lớp kem phô mai béo mịn và bánh OREO giòn tan. Thơm nồng, ngọt dịu khó quên.",
      en: "Premium Japanese matcha powder blended with creamy fresh milk, combined with smooth cheese cream and crunchy OREO cookies. Aromatic, smooth, and unforgettable.",
    },
  },
  {
    src: "/images/matcha.png",
    bg: "#485a20",
    name: "Matcha latte",
    series: "Matcha",
    ghostText: "Matcha",
    slug: '/matcha-latte',
    description: {
      vi: "Bột matcha Nhật Bản thượng hạng kết hợp sữa tươi thanh trùng. Thơm mịn nồng nàn, ngọt dịu khó quên.",
      en: "Premium Japanese matcha powder blended with creamy fresh milk. Aromatic, smooth, and unforgettable.",
    },
  },
  {
    src: "/images/suachua-vietquoc.png",
    bg: "#3d1a6b",
    name: "Sữa Chua Sấy Việt Quất",
    series: "Sữa chua Mix",
    ghostText: "Yogurt Mix",
    slug: '/sua-chua-say-viet-quat-kem-cheese',
    description: {
      vi: "Sữa chua sấy giòn rụm, hoà quyện cùng vị chua thanh của việt quất tươi — ngọt dịu, thơm nồng, khó quên.",
      en: "Crispy dried yogurt blended with the fresh tartness of blueberries — sweet, aromatic, and unforgettable.",
    },
  },
];

const INTERVAL_MS = 5200;
const N = IMAGES.length;

const GRAIN_SVG_URI = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E")`;

// ── Slot styles: carousel shifted right via translateX offset ──────────────────
// Carousel anchor is centered, but we nudge every slot to the right so the
// cluster visually sits right-of-center, leaving room for text on the left.
// Side-slot offsets were tightened (52%/62% → 30%/32%) so the three cups sit
// closer together, matching the reference design.
const CAROUSEL_SHIFT = "20%"; // how far right the whole cluster moves

function getSlotStyle(pos: number, isMobile: boolean): React.CSSProperties {
  const shift = isMobile ? "10%" : CAROUSEL_SHIFT;

  if (pos === 0) return {
    transform: `translateX(${shift}) scale(1) rotate(0deg)`,
    opacity: 1,
    zIndex: 10,
    filter: "drop-shadow(0 40px 80px rgba(0,0,0,0.55))",
  };
  if (pos === -1 || pos === N - 1) return {
    transform: isMobile
      ? `translateX(calc(-34% + ${shift})) scale(0.62) rotate(-12deg)`
      : `translateX(calc(-30% + ${shift})) scale(0.66) rotate(-12deg)`,
    opacity: 0.5,
    zIndex: 5,
    filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.3))",
  };
  if (pos === 1 || pos === -(N - 1)) return {
    transform: isMobile
      ? `translateX(calc(34% + ${shift})) scale(0.62) rotate(12deg)`
      : `translateX(calc(30% + ${shift})) scale(0.66) rotate(12deg)`,
    opacity: 0.5,
    zIndex: 5,
    filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.3))",
  };
  return { transform: `translateX(${shift}) scale(0.4)`, opacity: 0, zIndex: 0 };
}

export default function HeroSection() {
  const [activeIndex, setActiveIndex] = useState(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [ghostVisible, setGhostVisible] = useState(true);
  const [textKey, setTextKey] = useState(0);
  const locale = useLocale()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slide = IMAGES[activeIndex];

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    IMAGES.forEach((s) => { const img = new window.Image(); img.src = s.src; });
  }, []);

  const goTo = useCallback((idx: number) => {
    if (isAnimating || idx === activeIndex) return;
    setIsAnimating(true);
    setGhostVisible(false);
    setTimeout(() => {
      setActiveIndex(idx);
      setTextKey((k) => k + 1);
      setTimeout(() => { setGhostVisible(true); setIsAnimating(false); }, 80);
    }, 420);
  }, [isAnimating, activeIndex]);

  const next = useCallback(() => goTo((activeIndex + 1) % N), [goTo, activeIndex]);
  const prev = useCallback(() => goTo((activeIndex - 1 + N) % N), [goTo, activeIndex]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(next, INTERVAL_MS);
  }, [next]);

  useEffect(() => {
    timerRef.current = setInterval(next, INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [next]);

  const handlePrev = () => { prev(); resetTimer(); };
  const handleNext = () => { next(); resetTimer(); };
  const handleDot = (i: number) => { goTo(i); resetTimer(); };

  const imgMaxH = isMobile ? "46vh" : "64vh";
  const imgMaxW = isMobile ? "56vw" : "30vw";

  // bottom-bar heights
  const barPb = isMobile ? 20 : 28;
  const btnSize = isMobile ? 38 : 44;

  return (
    <section
      id="hero-section"
      style={{
        backgroundColor: slide.bg,
        transition: "background-color 650ms cubic-bezier(0.4,0,0.2,1)",
        fontFamily: "'Inter', sans-serif",
      }}
      className="relative w-full overflow-hidden"
    >
      <div className="relative w-full" style={{ height: "100vh", overflow: "hidden" }}>

        {/* Grain */}
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{
          zIndex: 50, backgroundImage: GRAIN_SVG_URI,
          backgroundSize: "200px 200px", backgroundRepeat: "repeat", opacity: 0.4,
        }} />

        {/* Ghost text */}
        <div aria-hidden className="absolute inset-x-0 flex items-center justify-center pointer-events-none select-none"
          style={{ zIndex: 2, top: isMobile ? "10%" : "16%" }}>
          <span style={{
            fontFamily: "'Anton', sans-serif",
            fontSize: "clamp(90px, 28vw, 380px)",
            fontWeight: 900, color: "white",
            opacity: ghostVisible ? 0.3 : 0,
            lineHeight: 1, textTransform: "uppercase",
            letterSpacing: "-0.02em", whiteSpace: "nowrap",
            mixBlendMode: "overlay", transition: "opacity 0.38s ease",
          }}>
            {slide.ghostText}
          </span>
        </div>

        {/* ── 3-up Carousel (anchor at center, shifted right) ── */}
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 3 }}>
          {IMAGES.map((s, i) => {
            let pos = i - activeIndex;
            if (pos > Math.floor(N / 2)) pos -= N;
            if (pos < -Math.floor(N / 2)) pos += N;
            const slotStyle = getSlotStyle(pos, isMobile);
            return (
              <div
                key={s.src}
                onClick={() => pos !== 0 && handleDot(i)}
                style={{
                  position: "absolute",
                  display: "flex", alignItems: "flex-end", justifyContent: "center",
                  maxHeight: imgMaxH, maxWidth: imgMaxW,
                  width: "100%", height: "100%",
                  cursor: pos !== 0 ? "pointer" : "default",
                  transition: "transform 0.62s cubic-bezier(0.34,1.18,0.64,1), opacity 0.5s ease, filter 0.5s ease",
                  transformOrigin: "center center",
                  ...slotStyle,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.src} alt={s.name} style={{
                  maxHeight: imgMaxH, maxWidth: "100%",
                  objectFit: "contain", display: "block",
                  userSelect: "none", pointerEvents: "none",
                }} />
              </div>
            );
          })}
        </div>

        {/* ── Left content block ── */}
        <div
          key={textKey}
          className="absolute"
          style={{
            zIndex: 20,
            left: isMobile ? 16 : 48,
            bottom: isMobile ? barPb + 24 : barPb + 50,
            maxWidth: isMobile ? "calc(55% - 8px)" : 280,
            animation: "fadeSlideUp 0.48s cubic-bezier(0.22,1,0.36,1) both",
          }}
        >
          {/* Series eyebrow */}
          <p className="text-white/40 font-semibold uppercase mb-1.5"
            style={{ fontSize: 10, letterSpacing: "0.22em" }}>
            {slide.series}
          </p>

          {/* Product name — scaled down */}
          <h2 className="uppercase text-white"
            style={{
              fontFamily: "'Anton', sans-serif",
              fontSize: isMobile ? "clamp(28px, 8vw, 40px)" : "clamp(32px, 3.6vw, 52px)",
              fontWeight: 900, lineHeight: 1.02,
              letterSpacing: "-0.01em", marginBottom: 10,
            }}>
            {slide.name}
          </h2>

          {/* Description */}
          <p style={{
            fontSize: isMobile ? 12 : 13,
            lineHeight: 1.6,
            color: "rgba(255,255,255,0.58)",
            marginBottom: 20,
            fontWeight: 400,
          }}>
            {typeof slide.description === "string"
              ? slide.description
              : slide.description[locale as 'vi' | 'en'] || slide.description.en}
          </p>

          {/* CTA */}
          <button
            onClick={() => { location.href = `${ROUTES.MENU}/${slide.slug}` }}
            className="inline-flex items-center gap-1.5 rounded-full font-bold uppercase hover:scale-105 transition-transform ease-in-out duration-700 active:scale-95"
            style={{
              padding: "10px 20px",
              background: "white", color: slide.bg,
              fontSize: 11, letterSpacing: "0.08em",
              boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
              border: "none", cursor: "pointer",
              transition: "transform 0.2s ease, box-shadow 0.2s ease, color 0.65s cubic-bezier(0.4,0,0.2,1)",
              marginBottom: 16,
            }}>
            Explore now
            <ArrowUpRight size={13} />
          </button>

        </div>

        {/* ── Bottom bar ── */}
        {/* Now only dots + counter — Prev/Next live in the left content block above. */}
        <div
          className="absolute bottom-0 left-0 right-0 flex items-end justify-between"
          style={{
            zIndex: 20,
            padding: isMobile ? `0 16px ${barPb}px` : `0 48px ${barPb}px`,
            background: "linear-gradient(to top, rgba(0,0,0,0.38) 0%, transparent 100%)",
          }}
        >
          <div className="flex flex-col items-start gap-2">
            <div className="flex items-center gap-1.5">
              {IMAGES.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={i === activeIndex ? "true" : undefined}
                  onClick={() => handleDot(i)}
                  className="rounded-full border-none cursor-pointer p-0"
                  style={{
                    height: 3,
                    width: i === activeIndex ? 32 : 8,
                    background: i === activeIndex ? "white" : "rgba(255,255,255,0.28)",
                    transition: "width 0.42s cubic-bezier(0.4,0,0.2,1), background 0.3s ease",
                  }}
                />
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="tabular-nums" style={{
                fontFamily: "'Anton', sans-serif",
                fontSize: isMobile ? 12 : 13, color: "rgba(255,255,255,0.7)",
              }}>
                {String(activeIndex + 1).padStart(2, "0")}
              </span>
              <span style={{ width: 16, height: 1, background: "rgba(255,255,255,0.22)", display: "inline-block" }} />
              <span className="tabular-nums" style={{
                fontFamily: "'Anton', sans-serif",
                fontSize: isMobile ? 12 : 13, color: "rgba(255,255,255,0.28)",
              }}>
                {String(N).padStart(2, "0")}
              </span>
            </div>
          </div>

          {/* Prev / Next — bên phải */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              aria-label="Previous slide"
              className="cursor-pointer flex items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/22 hover:border-white/35 active:scale-95"
              style={{ width: btnSize, height: btnSize }}
            >
              <ChevronLeft size={isMobile ? 15 : 18} />
            </button>
            <button
              onClick={handleNext}
              aria-label="Next slide"
              className="cursor-pointer flex items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/22 hover:border-white/35 active:scale-95"
              style={{ width: btnSize, height: btnSize }}
            >
              <ChevronRight size={isMobile ? 15 : 18} />
            </button>
          </div>
        </div>



        {/* Vertical brand stamp */}
        {!isMobile && (
          <div aria-hidden className="absolute pointer-events-none select-none" style={{
            zIndex: 20, right: -18, top: "50%",
            transform: "translateY(-50%) rotate(90deg)",
            fontFamily: "'Inter', sans-serif", fontSize: 9, fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "0.35em",
            color: "rgba(255,255,255,0.18)", whiteSpace: "nowrap",
          }}>
            UJCHA · COLLECTIBLES
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}