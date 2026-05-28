import type { Metadata } from "next";

import { PaymentConfigClient } from "./components/PaymentConfigClient";

export const metadata: Metadata = {
  title: "Cấu hình thanh toán — UjCha Admin",
  description: "Cấu hình thanh toán SePay QR cho cửa hàng",
};

export default function PaymentConfigPage() {
  return <PaymentConfigClient />;
}
