import type { Metadata } from "next";

import { NewOrderClient } from "../components/NewOrderClient";

export const metadata: Metadata = {
  title: "Tạo đơn — UjCha Admin",
  description: "POS tạo đơn thay khách",
};

export default function NewOrderPage() {
  return <NewOrderClient />;
}
