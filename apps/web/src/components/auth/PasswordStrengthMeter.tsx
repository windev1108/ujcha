"use client";

type StrengthLevel = 0 | 1 | 2 | 3 | 4;

type StrengthResult = {
  level: StrengthLevel;
  label: string;
  color: string;
  textColor: string;
};

export function getPasswordStrength(password: string): StrengthResult {
  if (!password) return { level: 0, label: "", color: "bg-transparent", textColor: "" };

  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (password.length < 6)
    return { level: 1, label: "Rất yếu", color: "bg-red-400", textColor: "text-red-500" };
  if (score <= 2)
    return { level: 1, label: "Yếu", color: "bg-red-400", textColor: "text-red-500" };
  if (score === 3)
    return { level: 2, label: "Trung bình", color: "bg-amber-400", textColor: "text-amber-600" };
  if (score === 4)
    return { level: 3, label: "Khá mạnh", color: "bg-emerald-400", textColor: "text-emerald-600" };
  return { level: 4, label: "Mạnh", color: "bg-emerald-500", textColor: "text-emerald-600" };
}

export function PasswordStrengthMeter({ password }: { password: string }) {
  const { level, label, color, textColor } = getPasswordStrength(password);
  if (!password) return null;

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
          Mật khẩu: {label}
        </p>
      )}
    </div>
  );
}
