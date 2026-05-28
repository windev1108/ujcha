"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/store/auth-store";

/**
 * Bảo vệ nội dung chỉ dành cho super_admin.
 * Staff sẽ bị redirect về trang chủ ngay khi hydration xong.
 */
export function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const admin = useAuthStore((s) => s.admin);
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!admin) return;
    if (admin.role !== "super_admin") {
      router.replace("/");
    }
  }, [mounted, admin, router]);

  if (!mounted || !admin) return null;
  if (admin.role !== "super_admin") return null;

  return <>{children}</>;
}
