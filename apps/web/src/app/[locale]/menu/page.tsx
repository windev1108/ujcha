import type { Metadata } from "next";
import { ProductPageShell } from "./components/ProductPageShell";

export const metadata: Metadata = {
    title: "Thực đơn",
    description:
        "Khám phá matcha, cà phê, trà và phụ kiện — nguồn gốc bền vững, chất lượng ceremonial.",
};

export default function ProductsPage() {
    return <ProductPageShell />;
}
