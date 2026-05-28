import type { Metadata } from "next";

import { UsersPageClient } from "./components/UsersPageClient";

export const metadata: Metadata = {
  title: "Quản lý người dùng — UjCha Admin",
  description: "Quản lý nhân viên và khách hàng",
};

export default function UsersPage() {
  return <UsersPageClient />;
}
