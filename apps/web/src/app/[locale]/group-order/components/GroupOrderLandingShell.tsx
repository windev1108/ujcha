"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useInView } from "motion/react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Crown,
  Loader2,
  Share2,
  ShoppingBag,
  Sparkles,
  Timer,
  Truck,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@heroui/react";
import { ROUTES } from "@/lib/routes";
import { useAuthStore } from "@/store/auth-store";
import {
  createGroupOrder,
  fetchGroupOrderConfig,
  type GroupDiscountTier,
} from "@/services/group-order/api";

type OrderTypeOpt = "pickup" | "delivery";
type PaymentModeOpt = "split" | "host_pays";

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateGroupModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [step, setStep] = useState<"type" | "payment">("type");
  const [orderType, setOrderType] = useState<OrderTypeOpt>("pickup");
  const [paymentMode, setPaymentMode] = useState<PaymentModeOpt>("split");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!accessToken) {
      router.push(ROUTES.LOGIN);
      return;
    }
    setCreating(true);
    try {
      const result = await createGroupOrder({ type: orderType, paymentMode });
      localStorage.setItem(`group_order_session_${result.token}`, result.hostSessionToken);
      if (result.hostParticipantId) {
        localStorage.setItem(`group_order_participant_${result.token}`, result.hostParticipantId);
      }
      router.push(ROUTES.GROUP_ORDER(result.token));
    } catch {
      alert("Không thể tạo đơn nhóm. Vui lòng thử lại.");
      setCreating(false);
    }
  };

  const ORDER_TYPES = [
    { value: "pickup" as const, label: "Mang về", Icon: ShoppingBag, desc: "Đến cửa hàng nhận" },
    { value: "delivery" as const, label: "Giao tận nơi", Icon: Truck, desc: "Ship về địa chỉ" },
  ];

  const PAYMENT_MODES = [
    {
      value: "split" as const,
      label: "Mỗi người trả riêng",
      Icon: Users,
      desc: "Từng thành viên tự chuyển khoản phần của mình — phù hợp đi nhóm bạn bè.",
    },
    {
      value: "host_pays" as const,
      label: "Chủ nhóm trả hết",
      Icon: Crown,
      desc: "Một người thanh toán toàn bộ, tiện cho công ty hay gia đình.",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 32, stiffness: 380 }}
        className="w-full max-w-md overflow-hidden rounded-t-[2rem] bg-white sm:rounded-[2rem]"
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#1a3c34]/8">
              <Users className="size-4.5 text-[#1a3c34]" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/35">
                {step === "type" ? "Bước 1 / 2" : "Bước 2 / 2"}
              </p>
              <h2 className="text-base font-bold text-foreground">
                {step === "type" ? "Hình thức đơn hàng" : "Phương thức thanh toán"}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full bg-black/6 text-foreground/50 hover:bg-black/10 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1.5 px-6 pt-4">
          {["type", "payment"].map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${i === 0
                ? "bg-[#1a3c34]"
                : step === "payment"
                  ? "bg-[#1a3c34]"
                  : "bg-black/10"
                }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === "type" ? (
            <motion.div
              key="type"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="px-6 py-5"
            >
              <p className="mb-3 text-sm text-foreground/55">
                Chọn cách bạn muốn nhận đơn hàng
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {ORDER_TYPES.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setOrderType(opt.value)}
                    className={`flex flex-col items-center gap-2 rounded-2xl border-2 px-2 py-4 text-center transition-all ${orderType === opt.value
                      ? "border-[#1a3c34] bg-[#f0faf6]"
                      : "border-black/8 bg-[#fafafa] hover:border-black/16 hover:bg-white"
                      }`}
                  >
                    <div className={`flex size-10 items-center justify-center rounded-xl ${orderType === opt.value ? "bg-[#1a3c34]/12" : "bg-black/6"}`}>
                      <opt.Icon className={`size-5 ${orderType === opt.value ? "text-[#1a3c34]" : "text-foreground/50"}`} />
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${orderType === opt.value ? "text-[#1a3c34]" : "text-foreground"}`}>
                        {opt.label}
                      </p>
                      <p className="mt-0.5 text-[10px] leading-tight text-foreground/40">{opt.desc}</p>
                    </div>
                    {orderType === opt.value && (
                      <div className="flex size-4 items-center justify-center rounded-full bg-[#1a3c34]">
                        <CheckCircle2 className="size-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <Button
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1a3c34] text-sm font-semibold text-white"
                onPress={() => setStep("payment")}
              >
                Tiếp tục
                <ChevronRight className="size-4" />
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="payment"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="px-6 py-5"
            >
              <p className="mb-3 text-sm text-foreground/55">
                Ai sẽ thanh toán cho nhóm?
              </p>
              <div className="flex flex-col gap-2.5">
                {PAYMENT_MODES.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPaymentMode(opt.value)}
                    className={`flex items-start gap-4 rounded-2xl border-2 px-4 py-4 text-left transition-all ${paymentMode === opt.value
                      ? "border-[#1a3c34] bg-[#f0faf6]"
                      : "border-black/8 bg-[#fafafa] hover:border-black/16 hover:bg-white"
                      }`}
                  >
                    <div className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${paymentMode === opt.value ? "bg-[#1a3c34]/12" : "bg-black/6"}`}>
                      <opt.Icon className={`size-4.5 ${paymentMode === opt.value ? "text-[#1a3c34]" : "text-foreground/50"}`} />
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-bold ${paymentMode === opt.value ? "text-[#1a3c34]" : "text-foreground"}`}>
                        {opt.label}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-foreground/50">{opt.desc}</p>
                    </div>
                    <div className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${paymentMode === opt.value ? "border-[#1a3c34] bg-[#1a3c34]" : "border-black/20"
                      }`}>
                      {paymentMode === opt.value && <div className="size-2 rounded-full bg-white" />}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-5 flex gap-2.5">
                <Button
                  className="flex h-12 w-24 items-center justify-center gap-1.5 rounded-full border border-black/10 bg-white text-sm font-semibold text-foreground hover:bg-black/4"
                  onPress={() => setStep("type")}
                >
                  Quay lại
                </Button>
                <Button
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#1a3c34] text-sm font-semibold text-white"
                  isDisabled={creating}
                  onPress={() => void handleCreate()}
                >
                  {creating ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Đang tạo…
                    </>
                  ) : (
                    <>
                      <Share2 className="size-4" />
                      Tạo & lấy link chia sẻ
                    </>
                  )}
                </Button>
              </div>

              <p className="mt-3 text-center text-[11px] text-foreground/35">
                Bạn bè cần có tài khoản UjCha để tham gia và chọn món
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// ─── Animated counter ──────────────────────────────────────────────────────────

function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf: number;
    const start = performance.now();
    const duration = 1000;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(ease * to));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to]);

  return (
    <span ref={ref} className="tabular-nums">
      {val}{suffix}
    </span>
  );
}

// ─── Discount ladder ───────────────────────────────────────────────────────────

function DiscountTierCard({
  tier,
  index,
  isMax,
  isActive,
  activeCount,
}: {
  tier: GroupDiscountTier;
  index: number;
  isMax: boolean;
  isActive: boolean;
  activeCount: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-24px" }}
      transition={{ delay: index * 0.08 }}
      className={`relative flex items-center gap-4 overflow-hidden rounded-2xl border px-5 py-4 transition-all ${isMax
        ? "border-[#1a3c34]/25 bg-gradient-to-r from-[#f0faf6] to-white shadow-[0_4px_20px_-8px_rgba(26,60,52,0.15)]"
        : isActive
          ? "border-[#1a3c34]/15 bg-[#f7fcfa]"
          : "border-black/6 bg-white"
        }`}
    >
      {/* Tier icon */}
      <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${isMax ? "bg-[#1a3c34]/12" : "bg-black/4"}`}>
        {index === 0 ? (
          <Users className={`size-5 ${isMax ? "text-[#1a3c34]" : "text-foreground/50"}`} />
        ) : index === 1 ? (
          <Sparkles className={`size-5 ${isMax ? "text-[#1a3c34]" : "text-foreground/50"}`} />
        ) : (
          <Zap className={`size-5 ${isMax ? "text-[#1a3c34]" : "text-foreground/50"}`} />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground">
          {tier.minParticipants}+ thành viên
        </p>
        <p className="mt-0.5 text-xs text-foreground/50">
          {activeCount >= tier.minParticipants
            ? "Đang áp dụng cho nhóm của bạn"
            : `Còn ${tier.minParticipants - activeCount} người nữa để đạt`}
        </p>
      </div>

      {/* Discount value */}
      <div className="flex flex-col items-end shrink-0">
        <span className={`text-2xl font-bold tabular-nums ${isMax ? "text-[#1a3c34]" : "text-foreground/70"}`}>
          -{tier.discountPercent}%
        </span>
        {isMax && (
          <span className="mt-0.5 rounded-full bg-[#1a3c34] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            Tốt nhất
          </span>
        )}
      </div>

      {/* Active glow bar */}
      {isActive && (
        <div className="absolute left-0 top-0 h-full w-1 rounded-r bg-[#1a3c34]/30" />
      )}
    </motion.div>
  );
}

// ─── Main shell ────────────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  {
    Icon: Sparkles,
    step: "01",
    title: "Tạo đơn nhóm",
    desc: "Chọn hình thức và kiểu thanh toán. Nhận link chia sẻ ngay tức thì.",
  },
  {
    Icon: Share2,
    step: "02",
    title: "Mời bạn bè",
    desc: "Gửi link vào nhóm chat. Bạn bè đăng nhập tài khoản UjCha và bắt đầu chọn món.",
  },
  {
    Icon: ShoppingBag,
    step: "03",
    title: "Cùng chọn món",
    desc: "Mỗi người chọn món của mình. Realtime, tất cả thấy ngay.",
  },
  {
    Icon: Zap,
    step: "04",
    title: "Chốt & giảm giá",
    desc: "Khóa đơn, hệ thống tự tính giảm theo nhóm và tạo đơn hàng.",
  },
];

const FEATURES = [
  {
    icon: <Share2 className="size-4.5 text-[#1a3c34]" />,
    title: "Chống gian lận",
    desc: "Mỗi tài khoản chỉ tham gia một lần — ưu đãi nhóm luôn chính xác.",
  },
  {
    icon: <Zap className="size-4.5 text-[#1a3c34]" />,
    title: "Realtime tức thì",
    desc: "Mọi thay đổi hiện ngay cho cả nhóm.",
  },
  {
    icon: <ShoppingBag className="size-4.5 text-[#1a3c34]" />,
    title: "Linh hoạt thanh toán",
    desc: "Chia đều hoặc một người trả hết.",
  },
  {
    icon: <Timer className="size-4.5 text-[#1a3c34]" />,
    title: "Đơn hết hạn 2 giờ",
    desc: "Đủ thời gian để cả nhóm chọn xong.",
  },
] as const;

export function GroupOrderLandingShell() {
  const [showModal, setShowModal] = useState(false);
  const [tiers, setTiers] = useState<GroupDiscountTier[]>([]);
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    fetchGroupOrderConfig()
      .then((cfg) => setTiers(cfg.discountTiers))
      .catch(() => { })
      .finally(() => setConfigLoaded(true));
  }, []);

  const sorted = [...tiers].sort((a, b) => a.minParticipants - b.minParticipants);
  const maxDiscount = tiers.length > 0 ? Math.max(...tiers.map((t) => t.discountPercent)) : null;

  return (
    <>
      <AnimatePresence>
        {showModal && <CreateGroupModal onClose={() => setShowModal(false)} />}
      </AnimatePresence>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1a3c34] via-[#1e4438] to-[#112a21] px-5 pb-20 pt-16 sm:pb-24 sm:pt-20">
        {/* Background texture */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 size-72 rounded-full bg-white/[0.03] blur-3xl" />
          <div className="absolute -bottom-16 left-1/4 size-96 rounded-full bg-[#99d6b3]/[0.06] blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        <div className="relative mx-auto max-w-[72rem]">
          <div className="mx-auto max-w-2xl text-center">

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.5 }}
              className="text-4xl font-bold tracking-tight text-white sm:text-5xl"
            >
              Gọi cả nhóm,
              <br />
              <span className="text-[#99d6b3]">giảm thật nhiều</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mx-auto mt-4 max-w-md text-base leading-relaxed text-white/60"
            >
              Mời bạn bè cùng chọn món qua một link. Nhóm càng đông, giảm giá càng sâu.
            </motion.p>

            {/* Stats */}
            {maxDiscount !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.22 }}
                className="mt-8 flex flex-wrap items-center justify-center gap-8 sm:gap-12"
              >
                {[
                  { label: "Giảm tối đa", value: <><CountUp to={maxDiscount} />%</> },
                  { label: "Mỗi tài khoản 1 lần", value: "✓ Công bằng" },
                  { label: "Thời hạn", value: "2 giờ" },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <p className="text-2xl font-bold text-white sm:text-3xl">{s.value}</p>
                    <p className="mt-0.5 text-xs text-white/45">{s.label}</p>
                  </div>
                ))}
              </motion.div>
            )}

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-8 flex flex-col items-center gap-3"
            >
              <Button
                className="inline-flex h-14 items-center gap-2.5 rounded-full bg-white px-8 text-base font-bold text-[#1a3c34] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.3)] hover:opacity-95"
                onPress={() => setShowModal(true)}
              >
                <Users className="size-5" />
                Tạo đơn nhóm ngay
                <ArrowRight className="size-4.5" />
              </Button>
              <p className="text-xs text-white/35">Chia sẻ link · Bạn bè đăng nhập và chọn món ngay</p>
            </motion.div>
          </div>
        </div>

        {/* Bottom wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 40" fill="none" className="w-full">
            <path d="M0 40 C360 0 1080 0 1440 40 L1440 40 L0 40Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="px-5 py-14 sm:py-16">
        <div className="mx-auto max-w-[72rem]">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-48px" }}
            className="mb-10 text-center"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/40">
              Cách hoạt động
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Chỉ 4 bước đơn giản
            </h2>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-32px" }}
                transition={{ delay: i * 0.08 }}
                className="relative flex flex-col gap-4 rounded-3xl border border-black/6 bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.06)]"
              >
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="absolute -right-2.5 top-8 z-10 hidden size-5 items-center justify-center lg:flex">
                    <ChevronRight className="size-4 text-foreground/20" />
                  </div>
                )}
                <div className="flex items-start justify-between">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-[#1a3c34]/8">
                    <step.Icon className="size-5 text-[#1a3c34]" />
                  </div>
                  <span className="mt-0.5 font-mono text-[11px] font-bold tracking-widest text-foreground/15">
                    {step.step}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{step.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-foreground/50">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Discount tiers ── */}
      <section className="bg-[#f7f7f7] px-5 py-14 sm:py-16">
        <div className="mx-auto max-w-[72rem]">
          <div className="mx-auto max-w-xl">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-48px" }}
              className="mb-3 text-center"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/40">
                Ưu đãi nhóm
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Càng đông, càng giảm
              </h2>
              <p className="mt-2 text-sm text-foreground/50">
                Giảm giá tự động khi chốt đơn — không cần nhập mã, không cần làm gì thêm.
              </p>
            </motion.div>

            {/* Max discount hero */}
            {maxDiscount !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: "-32px" }}
                className="mb-5 overflow-hidden rounded-3xl bg-[#1a3c34] px-8 py-10 text-center"
              >
                <Zap className="mx-auto mb-2 size-7 text-[#99d6b3]" />
                <p className="text-5xl font-bold text-white sm:text-6xl">
                  <CountUp to={maxDiscount} suffix="%" />
                </p>
                <p className="mt-2 text-sm text-white/60">Giảm giá tối đa khi nhóm đủ lớn</p>
                <div className="mt-5 flex justify-center gap-4 text-center text-xs text-white/40">
                  <span>Áp dụng tự động</span>
                  <span>·</span>
                  <span>Không cần mã</span>
                  <span>·</span>
                  <span>Tính trên tổng đơn</span>
                </div>
              </motion.div>
            )}

            {/* Tier list */}
            {configLoaded ? (
              sorted.length > 0 ? (
                <div className="flex flex-col gap-2.5">
                  {sorted.map((tier, i) => (
                    <DiscountTierCard
                      key={tier.minParticipants}
                      tier={tier}
                      index={i}
                      isMax={i === sorted.length - 1}
                      isActive={false}
                      activeCount={1}
                    />
                  ))}
                  <div className="flex items-center gap-2 rounded-xl border border-dashed border-black/8 px-4 py-2.5">
                    <Zap className="size-3.5 shrink-0 text-[#1a3c34]/50" />
                    <p className="text-[11px] text-foreground/45">
                      Giảm giá tính dựa trên số thành viên thực sự chọn món. Áp dụng khi khóa đơn.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex h-24 items-center justify-center rounded-2xl border border-dashed border-black/10">
                  <p className="text-sm text-foreground/40">Chưa có bậc ưu đãi nào được cấu hình</p>
                </div>
              )
            ) : (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="size-6 animate-spin text-foreground/25" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="px-5 py-14 sm:py-16">
        <div className="mx-auto max-w-[72rem]">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-48px" }}
            className="mb-10 text-center"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/40">
              Tại sao chọn đơn nhóm
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Đặt hàng theo cách mới
            </h2>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-32px" }}
                transition={{ delay: i * 0.06 }}
                className="flex flex-col gap-3 rounded-2xl border border-black/6 bg-white p-5"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-[#1a3c34]/8">
                  {f.icon}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{f.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-foreground/50">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="px-5 pb-16 sm:pb-20">
        <div className="mx-auto max-w-[72rem]">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-48px" }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a3c34] to-[#0f2820] px-8 py-14 text-center"
          >
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -right-12 -top-12 size-52 rounded-full bg-white/[0.03] blur-3xl" />
              <div className="absolute -bottom-12 -left-12 size-52 rounded-full bg-[#99d6b3]/[0.05] blur-3xl" />
            </div>
            <div className="relative">
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-white/10">
                <Users className="size-7 text-white" />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
                Sẵn sàng chưa?
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                Gọi cả nhóm đặt thôi!
              </h2>
              <p className="mx-auto mt-3 max-w-sm text-sm text-white/55">
                Tạo đơn trong vài giây. Chia sẻ link, bạn bè vào ngay, cùng chọn món, cùng được giảm.
              </p>
              <Button
                className="mt-7 inline-flex h-13 items-center gap-2.5 rounded-full bg-white px-8 text-sm font-bold text-[#1a3c34] hover:opacity-95"
                onPress={() => setShowModal(true)}
              >
                <Users className="size-4.5" />
                Tạo đơn nhóm miễn phí
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
