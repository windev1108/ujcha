"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface DevToolsDetectionOptions {
  enabled?: boolean;
  threshold?: number;
  interval?: number;
  debuggerThreshold?: number;
  onDetected?: () => void;
  onClosed?: () => void;
}

export function useDevToolsDetection({
  enabled = process.env.NODE_ENV === "production",
  threshold = 160,
  interval = 1000,
  debuggerThreshold = 100,
  onDetected,
  onClosed,
}: DevToolsDetectionOptions = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const previousState = useRef(false);

  const check = useCallback(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    // Method 1: docked DevTools
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;

    const sizeDetected =
      widthDiff > threshold ||
      heightDiff > threshold;

    // Method 2: debugger timing
    let debuggerDetected = false;

    const start = performance.now();

    debugger;

    const elapsed = performance.now() - start;

    if (elapsed > debuggerThreshold) {
      debuggerDetected = true;
    }

    const detected =
      sizeDetected ||
      debuggerDetected;

    if (detected !== previousState.current) {
      previousState.current = detected;
      setIsOpen(detected);

      if (detected) {
        onDetected?.();
      } else {
        onClosed?.();
      }
    }
  }, [
    enabled,
    threshold,
    debuggerThreshold,
    onDetected,
    onClosed,
  ]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    check();

    const timer = window.setInterval(
      check,
      interval
    );

    window.addEventListener(
      "resize",
      check
    );

    return () => {
      window.clearInterval(timer);

      window.removeEventListener(
        "resize",
        check
      );
    };
  }, [
    enabled,
    interval,
    check,
  ]);

  return {
    isOpen,
    check,
  };
}