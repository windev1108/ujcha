import { formatVnd } from "@/lib/product-display";


export default function OrderAmountSummary({
    subtotal,
    discount,
    pointDiscount,
    shipping,
    total,
    isDelivery,
}: {
    subtotal: number;
    discount: number;
    pointDiscount: number;
    shipping: number;
    total: number;
    isDelivery: boolean;
}) {
    return (
        <div className="space-y-2">
            <div className="flex justify-between text-sm text-foreground/60">
                <span>Tạm tính</span>
                <span className="tabular-nums font-medium text-foreground">{formatVnd(subtotal)}</span>
            </div>
            {discount > 0 && (
                <div className="flex justify-between text-sm text-foreground/60">
                    <span>Giảm giá</span>
                    <span className="tabular-nums font-medium text-red-600">-{formatVnd(discount)}</span>
                </div>
            )}
            {pointDiscount > 0 && (
                <div className="flex justify-between text-sm text-foreground/60">
                    <span>Điểm tích lũy</span>
                    <span className="tabular-nums font-medium text-violet-600">-{formatVnd(pointDiscount)}</span>
                </div>
            )}
            {isDelivery && (
                <div className="flex justify-between text-sm text-foreground/60">
                    <span>Phí vận chuyển</span>
                    {shipping > 0 ? (
                        <span className="tabular-nums font-medium text-foreground">{formatVnd(shipping)}</span>
                    ) : (
                        <span className="font-semibold uppercase text-[#26634d]">Miễn phí</span>
                    )}
                </div>
            )}
            <div className="flex items-baseline justify-between border-t border-black/6 pt-3">
                <span className="font-semibold text-foreground/70">Tổng cộng</span>
                <span className="text-xl font-bold tabular-nums text-[#1a3c34]">{formatVnd(total)}</span>
            </div>
        </div>
    );
}