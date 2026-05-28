"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";

import { AppDialogProvider } from "@/components/common/app-dialog-provider";
import { env } from "@/config/env";
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

  const googleId = env.GOOGLE_CLIENT_ID;

  const inner = (
    <AppDialogProvider>
      <AuthPersistHydration />
      <QueryClientProvider client={queryClient}>
        <>
          {children}
        </>
      </QueryClientProvider>
    </AppDialogProvider>
  );

  if (!googleId) {
    return inner;
  }

  return (
    <GoogleOAuthProvider clientId={googleId}>{inner}</GoogleOAuthProvider>
  );
}
