"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Leaf, Sparkles, Heart, Coffee } from "lucide-react";
import { ROUTES } from "@/lib/routes";

const FADE_UP = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-48px" } as const,
};

const VALUES = [
  {
    icon: Leaf,
    eyebrow: "Thủ công",
    headline: "Làm bằng tay, trao bằng tâm",
    body: "Từng ly matcha được xay thủ công theo đúng phương pháp truyền thống, giữ trọn hương vị và dưỡng chất tự nhiên nhất.",
  },
  {
    icon: Sparkles,
    eyebrow: "Chọn lọc",
    headline: "Nguyên liệu tốt nhất, không thỏa hiệp",
    body: "Chúng tôi chỉ chọn ceremonial grade matcha từ các vùng trà uy tín cùng nguyên liệu tươi ngon được kiểm định kỹ lưỡng.",
  },
  {
    icon: Heart,
    eyebrow: "Tĩnh tâm",
    headline: "Mỗi ngụm là một khoảnh khắc",
    body: "UjCha được xây dựng để nhắc bạn chậm lại — tìm thấy sự yên tĩnh trong một tách trà giữa ngày bận rộn.",
  },
];

const STATS = [
  { value: "3+", label: "Năm kinh nghiệm" },
  { value: "50+", label: "Sản phẩm thủ công" },
  { value: "1000+", label: "Khách hàng tin yêu" },
];

const STORY_PARAGRAPHS = [
  "UjCha ra đời từ niềm đam mê với matcha và triết lý pha chế thủ công. Chúng tôi không chỉ bán đồ uống — chúng tôi tạo ra những nghi thức nhỏ giúp bạn kết nối lại với bản thân giữa nhịp sống hối hả.",
  "Từ matcha ceremonial grade được xay thủ công theo phương pháp truyền thống, đến những thức uống theo mùa được chọn lọc tỉ mỉ — mọi thứ tại UjCha đều mang trong mình sự chú tâm và tình yêu của người làm ra nó.",
  "Chúng tôi hướng đến việc xây dựng một không gian — cả thực và số — nơi bạn có thể chậm lại, thưởng thức, và tìm thấy khoảnh khắc yên tĩnh của riêng mình. Mỗi tách trà là một lời nhắc: hãy hiện diện.",
];

export function AboutShell() {
  return (
    <main>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1a3c34] via-[#1e4438] to-[#112a21] px-5 pb-20 pt-16 sm:pb-24 sm:pt-20">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 size-72 rounded-full bg-white/[0.03] blur-3xl" />
          <div className="absolute -bottom-16 left-1/4 size-96 rounded-full bg-[#99d6b3]/[0.06] blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        <div className="relative mx-auto max-w-[72rem]">
          <div className="mx-auto max-w-2xl text-center">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45"
            >
              Về chúng tôi
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.5 }}
              className="text-4xl font-bold tracking-tight text-white sm:text-5xl"
            >
              Chúng tôi tin rằng
              <br />
              <span className="text-[#99d6b3]">mỗi tách trà</span> là một nghi thức
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mx-auto mt-4 max-w-md text-base leading-relaxed text-white/60"
            >
              UjCha — nơi matcha gặp gỡ sự chú tâm, và mỗi ly uống là một khoảnh khắc dành riêng cho bạn.
            </motion.p>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 40" fill="none" className="w-full" aria-hidden>
            <path d="M0 40 C360 0 1080 0 1440 40 L1440 40 L0 40Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* ── Brand story ── */}
      <section className="px-5 py-16 sm:py-24">
        <div className="mx-auto max-w-[72rem]">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
            <motion.div {...FADE_UP} transition={{ duration: 0.6 }}>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                Câu chuyện
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Khởi đầu từ
                <br />
                một tình yêu
              </h2>
            </motion.div>

            <div className="flex flex-col gap-5 text-sm leading-relaxed text-foreground/70 sm:text-base">
              {STORY_PARAGRAPHS.map((para, i) => (
                <motion.p key={i} {...FADE_UP} transition={{ duration: 0.5, delay: i * 0.1 }}>
                  {para}
                </motion.p>
              ))}
            </div>
          </div>

          <motion.div
            {...FADE_UP}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-14 flex items-center gap-4"
          >
            <div className="h-px flex-1 bg-black/[0.06]" />
            <Leaf className="size-4 text-kun-sage" />
            <div className="h-px flex-1 bg-black/[0.06]" />
          </motion.div>
        </div>
      </section>

      {/* ── Values ── */}
      <section className="bg-surface-soft px-5 py-16 sm:py-24">
        <div className="mx-auto max-w-[72rem]">
          <motion.div {...FADE_UP} transition={{ duration: 0.6 }} className="mb-12 text-center">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
              Giá trị cốt lõi
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Những điều chúng tôi tin
            </h2>
          </motion.div>

          <div className="grid gap-5 sm:grid-cols-3">
            {VALUES.map(({ icon: Icon, eyebrow, headline, body }, i) => (
              <motion.div
                key={eyebrow}
                {...FADE_UP}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="rounded-3xl border border-black/[0.06] bg-white p-6 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)] sm:p-7"
              >
                <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-kun-primary/[0.08]">
                  <Icon className="size-5 text-kun-primary" />
                </span>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                  {eyebrow}
                </p>
                <h3 className="mb-3 text-base font-semibold tracking-tight text-foreground">
                  {headline}
                </h3>
                <p className="text-sm leading-relaxed text-foreground/65">{body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="px-5 py-16 sm:py-20">
        <div className="mx-auto max-w-[72rem]">
          <div className="grid grid-cols-3 divide-x divide-black/[0.06]">
            {STATS.map(({ value, label }, i) => (
              <motion.div
                key={label}
                {...FADE_UP}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="px-4 text-center sm:px-10"
              >
                <p className="text-4xl font-bold tabular-nums tracking-tight text-kun-primary sm:text-5xl">
                  {value}
                </p>
                <p className="mt-2 text-xs font-medium text-muted sm:text-sm">{label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-5 pb-24 pt-2 sm:pb-32">
        <div className="mx-auto max-w-[72rem]">
          <motion.div
            {...FADE_UP}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-3xl bg-kun-primary px-8 py-14 text-center sm:px-16 sm:py-20"
          >
            <svg
              className="pointer-events-none absolute right-0 top-0 opacity-[0.08]"
              width="300"
              height="260"
              viewBox="0 0 300 260"
              fill="none"
              aria-hidden
            >
              <circle cx="240" cy="60" r="140" fill="white" />
            </svg>
            <div className="relative">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                Ghé thăm
              </p>
              <h2 className="mb-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Sẵn sàng khám phá UjCha?
              </h2>
              <p className="mx-auto mb-8 max-w-md text-sm leading-relaxed text-white/65 sm:text-base">
                Từ matcha ceremonial đến các thức uống thủ công theo mùa — tất cả đang chờ bạn.
              </p>
              <Link
                href={ROUTES.MENU}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-8 text-sm font-semibold text-kun-primary transition-opacity hover:opacity-90"
              >
                <Coffee className="size-4" />
                Xem thực đơn
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
