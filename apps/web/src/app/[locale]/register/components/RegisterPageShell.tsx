"use client";

import { Suspense, useEffect } from "react";
import { RegisterFormCard } from "./RegisterFormCard";
import { useRouter } from "@/i18n/navigation";
import { useAuthStore } from "@/store/auth-store";
import { ROUTES } from "@/lib/routes";

export function RegisterPageShell() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    if (hydrated && accessToken) {
      router.replace(ROUTES.HOME);
    }
  }, [hydrated, accessToken, router]);

  return (
    <Suspense fallback={null}>
      <RegisterFormCard />
    </Suspense>
  );
}
