"use client";

import { AppHeader } from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { usePathname } from "next/navigation";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname()
  const isTablePath = pathname.startsWith("/table/")

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {!isTablePath && <AppHeader />}
      <main className="flex-1 w-full">{children}</main>
      {!isTablePath && <Footer />}
    </div>
  );
}
