"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Banknote,
  ChevronRight,
  Crown,
  Loader2,
  QrCode,
  Share2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ROUTES } from "@/lib/routes";
import { useAuthStore } from "@/store/auth-store";
import { createGroupOrder, setGroupOrderFulfillment } from "@/services/group-order/api";
import { getDeviceId } from "@/hooks/useDeviceId";

export type GroupOrderAfterCreatePayload = {
  token: string;
  sessionToken: string;
};

type Step = "paymentMethod" | "paymentMode";
type PaymentTypeOpt = "cash" | "bank_transfer";
type PaymentModeOpt = "host_pays" | "split";

export function CreateGroupOrderModal({
  onClose,
  hasActiveSession,
  onAfterCreate,
}: {
  onClose: () => void;
  hasActiveSession: boolean;
  onAfterCreate?: (payload: GroupOrderAfterCreatePayload) => Promise<void>;
}) {
  const router = useRouter();
  const t = useTranslations();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [step, setStep] = useState<Step>("paymentMethod");
  const [paymentType, setPaymentType] = useState<PaymentTypeOpt>("cash");
  const [paymentMode, setPaymentMode] = useState<PaymentModeOpt>("host_pays");
  const [shippingFeeMode, setShippingFeeMode] = useState<"split" | "host_pays">("split");
  const [creating, setCreating] = useState(false);

  if (hasActiveSession) {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 32, stiffness: 380 }}
          className="w-full max-w-md overflow-hidden rounded-t-[2rem] bg-white sm:rounded-[2rem]"
        >
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-amber-50">
                <Users className="size-4.5 text-amber-600" />
              </div>
              <h2 className="text-base font-bold text-foreground">{t("group_orders")}</h2>
            </div>
            <button type="button" onClick={onClose}
              className="flex size-8 items-center justify-center rounded-full bg-black/6 text-foreground/50 hover:bg-black/10"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="px-6 pb-8 pt-2 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-amber-50 ring-1 ring-amber-200">
              <Users className="size-6 text-amber-600" />
            </div>
            <p className="text-sm font-semibold text-foreground">{t("active_group_order_exists")}</p>
            <div className="mt-5 flex flex-col gap-2.5">
              <Button
                className="h-12 w-full rounded-full bg-[#1a3c34] text-sm font-semibold text-white"
                onPress={() => { onClose(); router.push(ROUTES.GROUP_ORDER_SESSIONS); }}
              >
                {t("active_group_order_exists_cta")}
              </Button>
              <Button
                className="h-10 w-full rounded-full border border-black/10 bg-white text-sm font-semibold text-foreground/60"
                onPress={onClose}
              >
                {t("back")}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  const handleCreate = async (mode: PaymentModeOpt, pmType: PaymentTypeOpt) => {
    if (!accessToken) { router.push(ROUTES.LOGIN); return; }
    setCreating(true);
    try {
      const deviceId = await getDeviceId();
      const result = await createGroupOrder({
        type: "delivery",
        paymentMode: mode,
        deviceId,
      });
      await setGroupOrderFulfillment(result.token, result.hostSessionToken, {
        type: "delivery",
        paymentType: pmType,
        shippingFeeMode: mode === "split" ? shippingFeeMode : "split",
      });
      for (const key of Object.keys(localStorage)) {
        if (
          key.startsWith("group_order_session_") ||
          key.startsWith("group_order_participant_") ||
          key.startsWith("group_order_meta_")
        ) {
          localStorage.removeItem(key);
        }
      }
      localStorage.setItem(`group_order_session_${result.token}`, result.hostSessionToken);
      if (result.hostParticipantId) {
        localStorage.setItem(`group_order_participant_${result.token}`, result.hostParticipantId);
      }
      localStorage.setItem(
        `group_order_meta_${result.token}`,
        JSON.stringify({ token: result.token, expiresAt: result.expiresAt, type: "delivery", status: result.status }),
      );
      if (onAfterCreate) {
        try {
          await onAfterCreate({ token: result.token, sessionToken: result.hostSessionToken });
        } catch {
          // Items failed to add — still redirect, host can add manually on the group order page
        }
      }
      router.push(ROUTES.GROUP_ORDER(result.token));
    } catch {
      toast.error(t("create_group_order_error"));
      setCreating(false);
    }
  };

  const handleContinue = () => {
    if (paymentType === "cash") {
      void handleCreate("host_pays", "cash");
    } else {
      setStep("paymentMode");
    }
  };

  const PAYMENT_TYPES = [
    { value: "cash" as const, label: t("cash"), Icon: Banknote, desc: t("cash_desc") },
    { value: "bank_transfer" as const, label: t("bank_transfer"), Icon: QrCode, desc: t("bank_transfer_desc") },
  ];

  const PAYMENT_MODES = [
    { value: "host_pays" as const, label: t("host_pays"), Icon: Crown, desc: t("host_pays_desc") },
    { value: "split" as const, label: t("split_payment"), Icon: Users, desc: t("split_payment_desc") },
  ];

  const isTwoSteps = paymentType === "bank_transfer" || step === "paymentMode";
  const currentStepIndex = step === "paymentMethod" ? 0 : 1;
  const stepLabel = isTwoSteps
    ? (step === "paymentMethod" ? t("step_1_of_2") : t("step_2_of_2"))
    : null;
  const stepTitle = step === "paymentMethod" ? t("payment_method") : t("who_pays_for_group");

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 32, stiffness: 380 }}
        className="w-full max-w-md overflow-hidden rounded-t-[2rem] bg-white sm:rounded-[2rem]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#1a3c34]/8">
              <Users className="size-4.5 text-[#1a3c34]" />
            </div>
            <div>
              {stepLabel && (
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/35">
                  {stepLabel}
                </p>
              )}
              <h2 className="text-base font-bold text-foreground">{stepTitle}</h2>
            </div>
          </div>
          <button
            type="button" onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full bg-black/6 text-foreground/50 hover:bg-black/10 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Step bar — only when both steps are relevant */}
        {isTwoSteps && (
          <div className="flex gap-1.5 px-6 pt-4">
            {[0, 1].map((i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= currentStepIndex ? "bg-[#1a3c34]" : "bg-black/10"
                }`} />
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === "paymentMethod" ? (
            <motion.div key="paymentMethod" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="px-6 py-5"
            >
              <p className="mb-3 text-sm text-foreground/55">{t("group_select_payment_method_desc")}</p>
              <div className="flex flex-col gap-2.5">
                {PAYMENT_TYPES.map((opt) => (
                  <button key={opt.value} type="button" onClick={() => setPaymentType(opt.value)}
                    className={`flex items-start gap-4 rounded-2xl border-2 px-4 py-4 text-left transition-all ${paymentType === opt.value
                      ? "border-[#1a3c34] bg-[#f0faf6]"
                      : "border-black/8 bg-[#fafafa] hover:border-black/16 hover:bg-white"
                      }`}
                  >
                    <div className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${paymentType === opt.value ? "bg-[#1a3c34]/12" : "bg-black/6"}`}>
                      <opt.Icon className={`size-4.5 ${paymentType === opt.value ? "text-[#1a3c34]" : "text-foreground/50"}`} />
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-bold ${paymentType === opt.value ? "text-[#1a3c34]" : "text-foreground"}`}>{opt.label}</p>
                      <p className="mt-1 text-xs leading-relaxed text-foreground/50">{opt.desc}</p>
                    </div>
                    <div className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${paymentType === opt.value ? "border-[#1a3c34] bg-[#1a3c34]" : "border-black/20"
                      }`}>
                      {paymentType === opt.value && <div className="size-2 rounded-full bg-white" />}
                    </div>
                  </button>
                ))}
              </div>
              <Button
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1a3c34] text-sm font-semibold text-white"
                isDisabled={creating}
                onPress={handleContinue}
              >
                {creating ? (
                  <><Loader2 className="size-4 animate-spin" />{t("creating")}</>
                ) : paymentType === "cash" ? (
                  <><Share2 className="size-4" />{t("create_and_share")}</>
                ) : (
                  <>{t("continue")} <ChevronRight className="size-4" /></>
                )}
              </Button>
              {paymentType === "cash" && (
                <p className="mt-3 text-center text-[11px] text-foreground/35">{t("group_cash_host_pays_note")}</p>
              )}
            </motion.div>
          ) : (
            <motion.div key="paymentMode" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="px-6 py-5"
            >
              <p className="mb-3 text-sm text-foreground/55">{t("who_pays_for_group")}</p>
              <div className="flex flex-col gap-2.5">
                {PAYMENT_MODES.map((opt) => (
                  <button key={opt.value} type="button" onClick={() => setPaymentMode(opt.value)}
                    className={`flex items-start gap-4 rounded-2xl border-2 px-4 py-4 text-left transition-all ${paymentMode === opt.value
                      ? "border-[#1a3c34] bg-[#f0faf6]"
                      : "border-black/8 bg-[#fafafa] hover:border-black/16 hover:bg-white"
                      }`}
                  >
                    <div className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${paymentMode === opt.value ? "bg-[#1a3c34]/12" : "bg-black/6"}`}>
                      <opt.Icon className={`size-4.5 ${paymentMode === opt.value ? "text-[#1a3c34]" : "text-foreground/50"}`} />
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-bold ${paymentMode === opt.value ? "text-[#1a3c34]" : "text-foreground"}`}>{opt.label}</p>
                      <p className="mt-1 text-xs leading-relaxed text-foreground/50">{opt.desc}</p>
                    </div>
                    <div className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${paymentMode === opt.value ? "border-[#1a3c34] bg-[#1a3c34]" : "border-black/20"
                      }`}>
                      {paymentMode === opt.value && <div className="size-2 rounded-full bg-white" />}
                    </div>
                  </button>
                ))}
              </div>

              <AnimatePresence initial={false}>
                {paymentMode === "split" && (
                  <motion.div
                    key="shipping-mode"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2.5 rounded-2xl border border-black/8 bg-[#fafafa] px-4 py-3">
                      <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground/45">
                        {t("shipping_fee")}
                      </p>
                      <div className="flex gap-2">
                        {([
                          { value: "split", label: t("group_shipping_fee_split"), Icon: Users },
                          { value: "host_pays", label: t("group_shipping_fee_host_pays"), Icon: Crown },
                        ] as const).map(({ value, label, Icon }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setShippingFeeMode(value)}
                            className={`flex flex-1 items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left text-xs font-semibold transition-all ${shippingFeeMode === value
                              ? "border-[#1a3c34] bg-[#f0faf6] text-[#1a3c34]"
                              : "border-black/8 bg-white text-foreground/55 hover:border-black/16"
                              }`}
                          >
                            <Icon className="size-3.5 shrink-0" />
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-5 flex gap-2.5">
                <Button
                  className="flex h-12 w-24 items-center justify-center gap-1.5 rounded-full border border-black/10 bg-white text-sm font-semibold text-foreground hover:bg-black/4"
                  onPress={() => setStep("paymentMethod")}
                >
                  {t("back")}
                </Button>
                <Button
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#1a3c34] text-sm font-semibold text-white"
                  isDisabled={creating}
                  onPress={() => void handleCreate(paymentMode, "bank_transfer")}
                >
                  {creating ? (
                    <><Loader2 className="size-4 animate-spin" />{t("creating")}</>
                  ) : (
                    <><Share2 className="size-4" />{t("create_and_share")}</>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
