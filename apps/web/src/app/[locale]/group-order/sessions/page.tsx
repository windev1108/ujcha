import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { GroupOrderSessionsShell } from "./components/GroupOrderSessionsShell";

export const metadata: Metadata = {
  title: "Đơn nhóm của tôi",
};

function PageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-kun-primary" />
    </div>
  );
}

export default function GroupOrderSessionsPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <GroupOrderSessionsShell />
    </Suspense>
  );
}
