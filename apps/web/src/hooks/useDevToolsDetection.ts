"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface DevToolsDetectionOptions {
  enabled?: boolean;
  threshold?: number;
  interval?: number;
  debuggerThreshold?: number;
  confirmCount?: number;
  onDetected?: () => void;
  onClosed?: () => void;
}

function isTouchDevice() {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia?.("(pointer: coarse)").matches
  );
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
  const isTouchRef = useRef(false);

  useEffect(() => {
    isTouchRef.current = isTouchDevice();
  }, []);

  const check = useCallback(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    if (document.hidden) {
      positiveStreak.current = 0;
      return;
    }

    // Bàn phím ảo đang mở (đang gõ trong input/textarea) → innerHeight co lại
    // rất mạnh trên mobile, dễ trùng ngưỡng phát hiện docked DevTools.
    // Bỏ qua hẳn lần check này để tránh false positive khi đang gõ.
    const active = document.activeElement;
    const isTypingContext =
      active instanceof HTMLElement &&
      (active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.isContentEditable);
    if (isTypingContext) {
      positiveStreak.current = 0;
      return;
    }

    // Method 1: docked DevTools — chỉ đáng tin trên desktop. Trên mobile,
    // DevTools thật (remote debug qua cáp) không hề đổi outerWidth/outerHeight
    // của trang, trong khi thanh địa chỉ ẩn/hiện khi cuộn hoặc bàn phím ảo lại
    // đổi rất nhiều → method này trên mobile chỉ sinh false positive, không
    // có giá trị phát hiện thật. Vô hiệu hoá hẳn khi là touch device.
    let sizeDetected = false;
    if (!isTouchRef.current) {
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      sizeDetected = widthDiff > threshold || heightDiff > threshold;
    }

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