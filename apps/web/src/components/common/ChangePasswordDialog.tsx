"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, Circle, Eye, EyeOff, Lock, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useChangePasswordMutation } from "@/services/auth/hooks";

type Props = {
  open: boolean;
  onClose: () => void;
  hasExistingPassword: boolean;
};

function axiosErrorMessage(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { message?: string } }; message?: string };
  return err.response?.data?.message ?? err.message ?? fallback;
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  invalid?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={invalid}
        className={`h-11 w-full rounded-2xl border bg-white pl-4 pr-10 text-sm font-medium text-foreground outline-none ring-2 ring-transparent transition focus:ring-kun-primary/20 ${invalid ? "border-red-300" : "border-black/10"
          }`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function RuleRow({ met, label }: { met: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs transition-colors ${met ? "text-kun-primary" : "text-muted"}`}>
      {met ? (
        <CheckCircle2 className="size-3.5 shrink-0 fill-kun-primary text-white" />
      ) : (
        <Circle className="size-3.5 shrink-0" />
      )}
      {label}
    </div>
  );
}

export function ChangePasswordDialog({ open, onClose, hasExistingPassword }: Props) {
  const t = useTranslations("CHANGE_PASSWORD");
  const mutation = useChangePasswordMutation();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const hasMinLength = newPassword.length >= 8;
  const hasCase = /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword);
  const hasNumberOrSpecial = /[0-9]/.test(newPassword) || /[^A-Za-z0-9]/.test(newPassword);
  const newPasswordValid = hasMinLength && hasCase && hasNumberOrSpecial;

  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;

  const currentPasswordMissing = hasExistingPassword && currentPassword.length === 0;

  const formValid = useMemo(
    () => !currentPasswordMissing && newPasswordValid && passwordsMatch,
    [currentPasswordMissing, newPasswordValid, passwordsMatch],
  );

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(false);
    setSubmitted(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    setError(null);

    if (currentPasswordMissing) {
      setError(t("current_password_required"));
      return;
    }
    if (!newPasswordValid) {
      setError(t("new_password_requirements_not_met"));
      return;
    }
    if (!passwordsMatch) {
      setError(t("password_mismatch"));
      return;
    }

    try {
      await mutation.mutateAsync({
        currentPassword: hasExistingPassword ? currentPassword : undefined,
        newPassword,
      });
      setSuccess(true);
      setTimeout(handleClose, 1200);
    } catch (e) {
      console.log({ e })
      setError(axiosErrorMessage(e, t("generic_error")));
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            className="w-full max-w-sm rounded-t-3xl bg-white p-6 sm:rounded-3xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-kun-primary/10 text-kun-primary">
                  <Lock className="size-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">{t("change_password")}</h2>
                  <p className="mt-0.5 text-xs text-muted">{t("change_password_subtitle")}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-soft"
              >
                <X className="size-4" />
              </button>
            </div>

            {success ? (
              <p className="py-6 text-center text-sm font-medium text-kun-primary">
                {t("change_password_success")}
              </p>
            ) : (
              <div className="space-y-4">
                {hasExistingPassword && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      {t("current_password")} <span className="text-red-500">*</span>
                    </label>
                    <PasswordInput
                      value={currentPassword}
                      onChange={setCurrentPassword}
                      placeholder={t("current_password")}
                      invalid={submitted && currentPasswordMissing}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {t("new_password")} <span className="text-red-500">*</span>
                  </label>
                  <PasswordInput
                    value={newPassword}
                    onChange={setNewPassword}
                    placeholder={t("new_password")}
                    invalid={submitted && !newPasswordValid}
                  />
                  <div className="space-y-1 pt-1">
                    <RuleRow met={hasMinLength} label={t("pwd_rule_min_length")} />
                    <RuleRow met={hasCase} label={t("pwd_rule_case")} />
                    <RuleRow met={hasNumberOrSpecial} label={t("pwd_rule_number_or_special")} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {t("confirm_new_password")} <span className="text-red-500">*</span>
                  </label>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    placeholder={t("confirm_new_password")}
                    invalid={submitted && !passwordsMatch}
                  />
                  {confirmPassword.length > 0 && (
                    <RuleRow met={passwordsMatch} label={t("passwords_match")} />
                  )}
                </div>

                {error && <p className="text-xs text-red-500">{error}</p>}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="h-11 flex-1 rounded-2xl border border-black/10 bg-white text-sm font-semibold text-foreground transition hover:bg-surface-soft"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={mutation.isPending || (submitted && !formValid)}
                    className="flex h-11 flex-[1.4] items-center justify-center rounded-2xl bg-kun-primary text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {mutation.isPending ? (
                      <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      t("change_password")
                    )}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}