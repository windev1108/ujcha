"use client";

import { useRef, type KeyboardEvent, type ClipboardEvent } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
};

export function OtpBoxInput({ value, onChange, autoFocus }: Props) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, char: string) => {
    const digit = char.replace(/\D/g, "").slice(-1);
    const next = value.split("");
    next[index] = digit;
    const updated = next.join("").slice(0, 6);
    onChange(updated.padEnd(6, " ").slice(0, 6).trimEnd());
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (value[index]) {
        const next = value.split("");
        next[index] = "";
        onChange(next.join(""));
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        const next = value.split("");
        next[index - 1] = "";
        onChange(next.join(""));
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(text);
    const focusIdx = Math.min(text.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  return (
    <div className="flex gap-2 justify-center" role="group" aria-label="Mã OTP 6 chữ số">
      {Array.from({ length: 6 }).map((_, i) => {
        const digit = value[i] ?? "";
        const filled = digit !== "" && digit !== " ";
        return (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={filled ? digit : ""}
            autoFocus={autoFocus && i === 0}
            autoComplete={i === 0 ? "one-time-code" : "off"}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            className={`size-11 rounded-xl border-0 text-center text-lg font-bold tabular-nums ring-2 transition-all duration-150 outline-none
              ${filled
                ? "bg-[#1a3c34]/8 ring-[#1a3c34]/40 text-[#1a3c34]"
                : "bg-black/[0.04] ring-black/[0.10] text-foreground"
              }
              focus:bg-[#1a3c34]/6 focus:ring-[#1a3c34] focus:ring-2`}
            aria-label={`Chữ số thứ ${i + 1}`}
          />
        );
      })}
    </div>
  );
}
