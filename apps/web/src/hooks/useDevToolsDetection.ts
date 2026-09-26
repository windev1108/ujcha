"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface DevToolsDetectionOptions {
  enabled?: boolean;
  threshold?: number;
  interval?: number;
  debuggerThreshold?: number;
  /** Số lần phát hiện liên tiếp cần có trước khi coi là "đã mở" — chống nhiễu
   *  do tab bị throttle khi ở nền, máy yếu, GC, v.v. */
  confirmCount?: number;
  onDetected?: () => void;
  onClosed?: () => void;
}

export function useDevToolsDetection({
  enabled = process.env.NODE_ENV === "production",
  threshold = 160,
  interval = 1000,
  debuggerThreshold = 160,
  confirmCount = 3,
  onDetected,
  onClosed,
}: DevToolsDetectionOptions = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const previousState = useRef(false);
  const positiveStreak = useRef(0);

  const check = useCallback(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    // Tab đang ẩn/nền → timer bị browser throttle mạnh, phép đo debugger-timing
    // bị lệch và báo sai. Bỏ qua hoàn toàn lần check này và reset streak.
    if (document.hidden) {
      positiveStreak.current = 0;
      return;
    }

    // Method 1: docked DevTools
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    const sizeDetected = widthDiff > threshold || heightDiff > threshold;

    // Method 2: debugger timing
    const start = performance.now();
    // eslint-disable-next-line no-debugger
    debugger;
    const elapsed = performance.now() - start;
    const debuggerDetected = elapsed > debuggerThreshold;

    const detectedThisCheck = sizeDetected || debuggerDetected;

    if (detectedThisCheck) {
      positiveStreak.current += 1;
    } else {
      positiveStreak.current = 0;
    }

    // Chỉ kết luận "đã mở" khi phát hiện liên tiếp đủ confirmCount lần —
    // 1 lần đo lệch do CPU spike/GC/throttle sẽ không đủ để block UI.
    const detected = positiveStreak.current >= confirmCount;

    if (detected !== previousState.current) {
      previousState.current = detected;
      setIsOpen(detected);

      if (detected) {
        onDetected?.();
      } else {
        onClosed?.();
      }
    }
  }, [enabled, threshold, debuggerThreshold, confirmCount, onDetected, onClosed]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    check();

    const timer = window.setInterval(check, interval);
    window.addEventListener("resize", check);

    // Khi quay lại tab, reset streak để không cộng dồn từ lúc tab đang ẩn
    const handleVisibility = () => {
      if (!document.hidden) {
        positiveStreak.current = 0;
        check();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", check);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, interval, check]);

  return {
    isOpen,
    check,
  };
}