"use client";

import { useTranslations } from "next-intl";

type StrengthLevel = 0 | 1 | 2 | 3 | 4;

type StrengthResult = {
  level: StrengthLevel;
  labelKey: string;
  color: string;
  textColor: string;
};

export function getPasswordStrength(password: string): StrengthResult {
  if (!password) return { level: 0, labelKey: "", color: "bg-transparent", textColor: "" };

  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (password.length < 6)
    return { level: 1, labelKey: "pwd_very_weak", color: "bg-red-400", textColor: "text-red-500" };
  if (score <= 2)
    return { level: 1, labelKey: "pwd_weak", color: "bg-red-400", textColor: "text-red-500" };
  if (score === 3)
    return { level: 2, labelKey: "pwd_medium", color: "bg-amber-400", textColor: "text-amber-600" };
  if (score === 4)
    return { level: 3, labelKey: "pwd_strong_enough", color: "bg-emerald-400", textColor: "text-emerald-600" };
  return { level: 4, labelKey: "pwd_strong", color: "bg-emerald-500", textColor: "text-emerald-600" };
}

export function PasswordStrengthMeter({ password }: { password: string }) {
  const t = useTranslations();
  const { level, labelKey, color, textColor } = getPasswordStrength(password);
  if (!password) return null;

  const labelMap: Record<string, string> = {
    pwd_very_weak: t("pwd_very_weak"),
    pwd_weak: t("pwd_weak"),
    pwd_medium: t("pwd_medium"),
    pwd_strong_enough: t("pwd_strong_enough"),
    pwd_strong: t("pwd_strong"),
  };
  const label = labelKey ? labelMap[labelKey] ?? "" : "";

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {([1, 2, 3, 4] as const).map((n) => (
          <div
            key={n}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              level >= n ? color : "bg-black/[0.07]"
            }`}
          />
        ))}
      </div>
      {label && (
        <p className={`text-[11px] font-semibold transition-colors ${textColor}`}>
          {t("password")}: {label}
        </p>
      )}
    </div>
  );
}
