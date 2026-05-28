import type { Metadata } from "next";

import { OrderInvoiceClient } from "../../components/OrderInvoiceClient";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Hóa đơn ${id.slice(0, 8)}… — UjCha Admin`,
    description: "Xem hóa đơn đơn hàng",
  };
}

export default async function OrderInvoicePage({ params }: Props) {
  const { id } = await params;
  return <OrderInvoiceClient orderId={id} />;
}
