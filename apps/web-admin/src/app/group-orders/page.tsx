import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { GroupOrdersPageClient } from "./components/GroupOrdersPageClient";

export const metadata: Metadata = {
  title: "Đơn hàng nhóm | UjCha Admin",
};

export default function GroupOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-[#1a3c34]" />
        </div>
      }
    >
      <GroupOrdersPageClient />
    </Suspense>
  );
}
