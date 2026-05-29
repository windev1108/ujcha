import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AddressesPageShell } from "./components/AddressesPageShell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t("shipping_addresses"),
  };
}

export default function AddressesPage() {
  return (
    <Suspense>
      <AddressesPageShell />
    </Suspense>
  );
}
