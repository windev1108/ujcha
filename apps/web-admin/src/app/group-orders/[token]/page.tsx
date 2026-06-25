import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { GroupOrderDetailClient } from "./components/GroupOrderDetailClient";

export const metadata: Metadata = {
  title: "Chi tiết đơn nhóm | UjCha Admin",
};

export default async function GroupOrderDetailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-[#1a3c34]" />
        </div>
      }
    >
      <GroupOrderDetailClient token={token} />
    </Suspense>
  );
}
