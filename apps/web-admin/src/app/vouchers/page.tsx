import type { Metadata } from "next";

import { VouchersPageClient } from "./components/VouchersPageClient";

export const metadata: Metadata = {
    title: "Voucher — UjCha Admin",
    description: "Quản lý mã giảm giá",
};

export default function VouchersPage() {
    return <VouchersPageClient />;
}

