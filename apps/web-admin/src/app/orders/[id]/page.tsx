import type { Metadata } from "next";

import { OrderDetailClient } from "../components/OrderDetailClient";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Đơn ${id.slice(0, 8)}… — UjCha Admin`,
    description: "Chi tiết đơn hàng",
  };
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  return <OrderDetailClient orderId={id} />;
}
