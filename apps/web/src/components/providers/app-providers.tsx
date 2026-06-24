"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, Suspense, type ReactNode } from "react";
import { Toaster } from "sonner";

import { useAuthStore } from "@/store/auth-store";
import { RefCodeCapture } from "@/components/common/RefCodeCapture";

function AuthPersistHydration() {
  const setHydrated = useAuthStore((s) => s.setHydrated);

  useEffect(() => {
    const p = useAuthStore.persist;
    if (p.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return p.onFinishHydration(() => setHydrated(true));
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
    <>
      <AuthPersistHydration />
      <Suspense fallback={null}><RefCodeCapture /></Suspense>
      <Toaster position="top-right" richColors />
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </>
  );
}
