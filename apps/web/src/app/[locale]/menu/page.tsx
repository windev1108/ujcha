import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProductPageShell } from "./components/ProductPageShell";

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations();
    return {
        title: t("menu"),
        description:
            "Khám phá matcha, cà phê, trà và phụ kiện — nguồn gốc bền vững, chất lượng ceremonial.",
    };
}

export default function ProductsPage() {
    return <ProductPageShell />;
}
