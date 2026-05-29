import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { TableLandingShell } from "./TableLandingShell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t("order_at_table_title"),
  };
}

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
