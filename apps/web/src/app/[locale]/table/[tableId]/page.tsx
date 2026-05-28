import type { Metadata } from "next";
import { Suspense } from "react";
import { TableLandingShell } from "./TableLandingShell";

export const metadata: Metadata = {
  title: "Đặt món tại bàn",
};

export default async function TableLandingPage({
  params,
}: {
  params: Promise<{ tableId: string; locale: string }>;
}) {
  const { tableId } = await params;
  return (
    <Suspense>
      <TableLandingShell tableId={tableId} />
    </Suspense>
  );
}
