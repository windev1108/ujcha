import type { Metadata } from "next";
import { Suspense } from "react";
import { AddressesPageShell } from "./components/AddressesPageShell";

export const metadata: Metadata = {
  title: "Địa chỉ giao hàng",
};

export default function AddressesPage() {
  return (
    <Suspense>
      <AddressesPageShell />
    </Suspense>
  );
}
