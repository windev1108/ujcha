import type { Metadata } from "next";
import { ShippingConfigClient } from "./components/ShippingConfigClient";

export const metadata: Metadata = {
  title: "Phí vận chuyển — UjCha Admin",
  description: "Cấu hình phí giao hàng theo khoảng cách GPS",
};

export default function ShippingPage() {
  return <ShippingConfigClient />;
}
