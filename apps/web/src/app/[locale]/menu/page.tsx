import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProductPageShell } from "./components/ProductPageShell";

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations();
    return {
        title: t("menu"),
        description:
            "Khám phá Matcha, cà phê, trà sữa, nước ép và đồ uống tại cửa hàng của chúng tôi. Thưởng thức hương vị tuyệt vời và trải nghiệm đồ uống chất lượng cao.",
    };
}

export const revalidate = 300;

export default function ProductsPage() {
    return <ProductPageShell />;
}
