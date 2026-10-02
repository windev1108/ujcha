"use client";

import { Button, Card, CardContent, Description, Input, Label, Switch } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import { marginToInput, markupToInput, parseMarginInput, parseMarkupInput } from "@/lib/pricing-format";
import {
    fetchPricingConfig,
    pricingConfigKey,
    recomputePricing,
    updatePricingConfig,
} from "@/services/admin/pricing-api";
import { useAuthStore } from "@/store/auth-store";
import { marginPriceExample } from "@/lib/pricing-margin";

const STEPS = [500, 1000, 2000, 5000] as const;

function errMsg(err: unknown): string {
    const m = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
    if (typeof m === "string") return m;
    if (Array.isArray(m)) return m.join(", ");
    return err instanceof Error ? err.message : "Không lưu được.";
}

export function PricingConfigCard() {
    const queryClient = useQueryClient();
    const { confirm } = useAppDialog();
    const isSuper = useAuthStore((s) => s.admin?.role === "super_admin");

    const { data: cfg } = useQuery({ queryKey: pricingConfigKey, queryFn: fetchPricingConfig });

    const [enabled, setEnabled] = useState(false);
    const [marginText, setMarginText] = useState("");
    const [step, setStep] = useState<number>(1000);
    const [notice, setNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!cfg) return;
        setEnabled(cfg.isEnabled);
        setMarginText(marginToInput(cfg.defaultMarginPercent));
        setStep(cfg.roundingStep);
    }, [cfg]);

    const parsed = parseMarginInput(marginText);
    const example =
        parsed.ok && parsed.value != null
            ? marginPriceExample(15000, parsed.value, step)
            : null;
    const dirty =
        !!cfg &&
        (enabled !== cfg.isEnabled ||
            step !== cfg.roundingStep ||
            !parsed.ok ||
            parsed.value !== cfg.defaultMarginPercent);

    const refreshAll = () => {
        void queryClient.invalidateQueries({ queryKey: pricingConfigKey });
        void queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    };

    const saveMut = useMutation({
        mutationFn: () =>
            updatePricingConfig({
                isEnabled: enabled,
                defaultMarginPercent: parsed.ok ? parsed.value : null,
                roundingStep: step,
            }),
        onSuccess: (r) => {
            setError(null);
            setNotice(`Đã lưu. Tính lại ${r.recomputed.scanned} món, ${r.recomputed.updated} món thay đổi giá.`);
            refreshAll();
        },
        onError: (e) => { setNotice(null); setError(errMsg(e)); },
    });

    const recomputeMut = useMutation({
        mutationFn: recomputePricing,
        onSuccess: (r) => {
            setError(null);
            setNotice(`Đã tính lại ${r.scanned} món, ${r.updated} món thay đổi.`);
            refreshAll();
        },
        onError: (e) => { setNotice(null); setError(errMsg(e)); },
    });

    const onSave = async () => {
        if (cfg && enabled !== cfg.isEnabled) {
            const ok = await confirm({
                title: enabled ? "Bật giá tự động?" : "Tắt giá tự động?",
                description: enabled
                    ? "Giá bán của các món đủ giá vốn và có biên lợi nhuận sẽ đổi theo giá vốn ngay lập tức."
                    : "Mọi món sẽ quay về giá cố định ngay lập tức.",
                tone: "danger",
                confirmLabel: enabled ? "Bật" : "Tắt",
            });
            if (!ok) return;
        }
        saveMut.mutate();
    };

    const busy = saveMut.isPending || recomputeMut.isPending;
    const locked = !isSuper || busy;

    return (
        <Card className="rounded-2xl border border-[#1a3c34]/12 bg-[color-mix(in_oklab,#ecfdf5_40%,white)] shadow-sm">
            <CardContent className="flex flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <Label className="text-xs font-bold uppercase tracking-wider text-[#1a3c34]">
                            Giá tự động theo giá vốn
                        </Label>
                        <Description className="text-[11px] text-foreground/50">
                            Giá = giá vốn ÷ (1 − biên%), làm tròn lên. Món chưa tính được giá vốn hoặc để chế độ
                            "giữ giá cố định" vẫn dùng giá cố định. Tắt công tắc = mọi món về giá cố định.
                        </Description>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${enabled ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                            {enabled ? "Đang bật" : "Đang tắt"}
                        </span>
                        <Switch isSelected={enabled} onChange={setEnabled} isDisabled={locked} aria-label="Bật giá tự động">
                            <Switch.Control><Switch.Thumb /></Switch.Control>
                        </Switch>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-xs font-semibold text-foreground/60">Biên lợi nhuận gộp mặc định toàn shop (%)</Label>
                        <Input
                            inputMode="decimal"
                            value={marginText}
                            onChange={(e) => setMarginText(e.target.value)}
                            placeholder="Để trống = không áp dụng mặc định"
                            className="h-9 rounded-full border border-black/10 bg-white px-3 text-sm"
                            disabled={locked}
                        />
                        {!parsed.ok ? (
                            <Description className="text-xs text-red-600">Biên không hợp lệ (0–99,99%).</Description>
                        ) : (
                            <Description className="text-[11px] text-foreground/45">
                                Biên tính trên giá bán, không phải trên giá vốn.{" "}
                                {example != null && parsed.ok && parsed.value != null
                                    ? `VD giá vốn 15.000đ, biên ${parsed.value}% → ${example.toLocaleString("vi-VN")}đ. `
                                    : "VD giá vốn 15.000đ, biên 60% → 38.000đ. "}
                                Biên của danh mục hoặc món sẽ ghi đè mức này.
                            </Description>
                        )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-xs font-semibold text-foreground/60">Làm tròn lên đến</Label>
                        <div className="flex flex-wrap gap-2">
                            {STEPS.map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    disabled={locked}
                                    onClick={() => setStep(s)}
                                    className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${step === s
                                        ? "border-[#1a3c34] bg-[#1a3c34] text-white shadow-sm"
                                        : "border-black/10 bg-white text-foreground/65 hover:border-[#1a3c34]/30 hover:text-[#1a3c34]"}`}
                                >
                                    {s.toLocaleString("vi-VN")}đ
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        className="h-9 rounded-full bg-[#1a3c34] px-5 text-sm font-semibold text-white"
                        onPress={() => void onSave()}
                        isDisabled={locked || !dirty || !parsed.ok}
                    >
                        {saveMut.isPending ? "Đang lưu…" : "Lưu cấu hình"}
                    </Button>
                    <Button
                        variant="ghost"
                        className="h-9 rounded-full border border-black/10 bg-white px-4 text-sm font-semibold text-foreground/70"
                        onPress={() => recomputeMut.mutate()}
                        isDisabled={locked || dirty}
                    >
                        <RefreshCw className="mr-1.5 size-3.5 text-[#5a8f7a]" />
                        {recomputeMut.isPending ? "Đang tính…" : "Tính lại giá"}
                    </Button>
                    {!isSuper && <span className="text-xs text-foreground/45">Chỉ Super Admin được chỉnh cấu hình này.</span>}
                </div>
                {notice && <p className="text-xs font-semibold text-emerald-700">{notice}</p>}
                {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
            </CardContent>
        </Card>
    );
}