"use client";

import { Card, CardContent, Description, Input, Label } from "@heroui/react";

import { adminFieldStack, adminInputClass, adminLabelClassProduct } from "@/lib/admin-form-classes";
import { parseMarginInput, parseMarkupInput } from "@/lib/pricing-format";
import { formatVnd } from "@/lib/product-display";
import type { PricingMode, PricingSource, ProductPricingInfo, ProductPricingStatus } from "@/services/admin/types";
import { MARGIN_HINT, MARGIN_MAX, MARGIN_MIN } from "@/lib/pricing-margin";

const SOURCE_TEXT: Record<PricingSource, string> = {
    product: "riêng của món", category: "từ danh mục", global: "mặc định toàn shop", fixed: "chưa có biên lợi nhuận",
};
const STATUS_TEXT: Record<Exclude<ProductPricingStatus, "ok" | "fixed">, string> = {
    not_computed: "Chưa tính giá tự động cho món này.",
    no_recipe: "Chưa có công thức nên chưa tính được giá vốn.",
    missing_cost: "Thiếu giá vốn của nguyên liệu trong công thức.",
    zero_cost: "Tổng giá vốn bằng 0 — kiểm tra định lượng và giá vốn.",
    baseline_non_positive: "Giá tính ra thấp hơn phụ phí mặc định của biến thể nên không áp dụng.",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-3 py-1 text-sm">
            <span className="text-foreground/55">{label}</span>
            <span className="text-right font-semibold tabular-nums text-[#1a3c34]">{children}</span>
        </div>
    );
}

type Props = {
    pricing?: ProductPricingInfo;
    mode: PricingMode;
    onModeChange: (m: PricingMode) => void;
    marginText: string;
    onMarginChange: (v: string) => void;
    disabled: boolean;
};

export function ProductPricingCard({ pricing, mode, onModeChange, marginText, onMarginChange, disabled }: Props) {
    const parsed = parseMarginInput(marginText);
    const inherited = pricing && pricing.source !== "product" && pricing.marginPercent != null
        ? `Kế thừa ${pricing.marginPercent}% (${SOURCE_TEXT[pricing.source]})`
        : "Để trống = kế thừa danh mục / mặc định";

    return (
        <Card className="rounded-2xl border border-black/6 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-6">
                <h2 className="text-sm font-bold uppercase tracking-wide text-[#1a3c34]">Giá tự động</h2>

                <div className="flex gap-2">
                    {([["auto", "Tự động"], ["fixed", "Giữ giá cố định"]] as const).map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            disabled={disabled}
                            onClick={() => onModeChange(id)}
                            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${mode === id
                                ? "bg-[#1a3c34] text-white"
                                : "bg-black/5 text-foreground/50 hover:bg-black/10"}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div className={adminFieldStack}>
                    <Label className={adminLabelClassProduct}>Biên lợi nhuận gộp riêng của món (%)</Label>
                    <Input
                        fullWidth
                        inputMode="decimal"
                        value={marginText}
                        onChange={(e) => onMarginChange(e.target.value)}
                        placeholder={inherited}
                        className={`w-full ${adminInputClass}`}
                        disabled={disabled || mode === "fixed"}
                    />
                    <Description className={`text-xs ${parsed.ok ? "text-foreground/45" : "text-red-600"}`}>
                        {parsed.ok
                            ? `${MARGIN_HINT} Ghi đè biên của danh mục và mặc định toàn shop; chỉ có tác dụng khi công tắc giá tự động toàn shop đang bật.`
                            : `Biên không hợp lệ (${MARGIN_MIN}–${MARGIN_MAX}%).`}
                    </Description>
                </div>

                {pricing && (
                    <div className="flex flex-col gap-2">
                        <p className="text-[11px] text-foreground/40">Kết quả của lần lưu gần nhất.</p>
                        {pricing.status === "ok" ? (
                            <div className="rounded-xl bg-[#f7faf9] p-3 ring-1 ring-[#1a3c34]/10">
                                <Row label="Biên đang áp dụng">
                                    {pricing.marginPercent != null ? `${pricing.marginPercent}%` : "—"}{" "}
                                    <span className="text-xs font-normal text-foreground/45">({SOURCE_TEXT[pricing.source]})</span>
                                </Row>
                                {pricing.costPrice != null && <Row label="Giá vốn">{formatVnd(pricing.costPrice)}</Row>}
                                <Row label="Giá cơ bản tự động">{formatVnd(pricing.autoPrice!)}</Row>
                                {pricing.actualMarginPercent != null && (
                                    <p className="pt-1 text-right text-xs text-foreground/50">
                                        Biên thực tế{" "}
                                        <span className={pricing.actualMarginPercent < 0 ? "font-semibold text-red-600" : ""}>
                                            {pricing.actualMarginPercent}%
                                        </span>{" "}
                                        trên giá bán
                                    </p>
                                )}
                            </div>
                        ) : pricing.status === "fixed" ? (
                            <div className="rounded-xl bg-zinc-50 p-3 text-sm text-foreground/60 ring-1 ring-black/6">
                                Đang dùng giá cố định{" "}
                                {pricing.mode === "fixed" ? "(món đặt chế độ giữ giá cố định)." : "(chưa có biên lợi nhuận áp dụng hoặc công tắc toàn shop đang tắt)."}
                            </div>
                        ) : (
                            <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200/80">
                                <p>{STATUS_TEXT[pricing.status]}</p>
                                <p className="mt-1 text-xs text-amber-700/80">Món đang dùng giá cố định.</p>
                            </div>
                        )}
                        {pricing.warnings.length > 0 && (
                            <ul className="flex flex-col gap-1 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-200/80">
                                {pricing.warnings.map((w) => <li key={w}>• {w}</li>)}
                            </ul>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}