import type { Metadata } from "next";
import { Suspense } from "react";
import { NotificationsPageShell } from "./components/NotificationsPageShell";

export const metadata: Metadata = {
  title: "Thông báo",
};

export default function NotificationsPage() {
  return (
    <Suspense>
      <NotificationsPageShell />
    </Suspense>
  );
}
