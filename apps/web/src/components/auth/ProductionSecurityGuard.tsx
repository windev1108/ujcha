"use client";

import { useCallback } from "react";
import { useDevToolsDetection } from "@/hooks/useDevToolsDetection";
import { useTranslations } from "next-intl";


export function ProductionSecurityGuard() {
  const t = useTranslations("security.devTools");

  const isDevelopment =
    process.env.NODE_ENV === "development";

  const handleDetected = useCallback(() => {
    console.warn(
      "[Ujcha Security] Developer tools detected."
    );
  }, []);

  const { isOpen } = useDevToolsDetection({
    enabled: isDevelopment
      ? true
      : process.env.NODE_ENV === "production",

    onDetected: handleDetected,
  });

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <svg
            viewBox="0 0 24 24"
            className="h-7 w-7 text-red-600"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.3 3.8 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7 0l-7.7-13.2a2 2 0 0 0-3.4 0Z" />
          </svg>
        </div>

        <h2 className="text-xl font-semibold text-gray-900">
          {t("title")}
        </h2>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          {t("description")}
        </p>

        <div className="mt-6 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
          {t("instruction")}
        </div>
      </div>
    </div>
  );
}