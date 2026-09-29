"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";

import { AppDialogProvider } from "@/components/common/app-dialog-provider";
import { useAuthStore } from "@/store/auth-store";

function AuthPersistHydration() {
  const setHydrated = useAuthStore((s) => s.setHydrated);

  useEffect(() => {
    const p = useAuthStore.persist;
    if (typeof p.onFinishHydration === "function") {
      return p.onFinishHydration(() => {
        setHydrated(true);
      });
    }
    setHydrated(true);
  }, [setHydrated]);

  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <AppDialogProvider>
      <AuthPersistHydration />
      <QueryClientProvider client={queryClient}>
        <>
          {children}
        </>
      </QueryClientProvider>
    </AppDialogProvider>
  )
}
