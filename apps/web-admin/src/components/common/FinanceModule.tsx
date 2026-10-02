import { Card, CardContent } from "@heroui/react";
import type { ReactNode } from "react";

export function Panel({
    eyebrow, hint, right, children,
}: { eyebrow: string; hint?: string; right?: ReactNode; children: ReactNode }) {
    return (
        <Card className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_12px_40px_-24px_rgba(0,0,0,0.15)]">
            <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/45">{eyebrow}</p>
                        {hint && <p className="mt-1 text-sm text-foreground/60">{hint}</p>}
                    </div>
                    {right}
                </div>
                {children}
            </CardContent>
        </Card>
    );
}

export function Segmented<T extends string>({
    value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: ReadonlyArray<readonly [T, string]> }) {
    return (
        <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-black/10 bg-white p-1 shadow-sm">
            {options.map(([k, label]) => (
                <button
                    key={k}
                    type="button"
                    onClick={() => onChange(k)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${value === k ? "bg-[#1a3c34] text-white" : "text-foreground/50 hover:text-foreground/80"}`}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

export function DeltaBadge({
    value, unit = "%", invert = false,
}: { value: number | null; unit?: "%" | "pt"; invert?: boolean }) {
    if (value === null) return <span className="text-[10px] text-foreground/35">mới</span>;
    if (value === 0) return <span className="text-[10px] text-foreground/40">— không đổi</span>;
    const good = invert ? value < 0 : value > 0;
    return (
        <span className={`text-[10px] font-semibold tabular-nums ${good ? "text-emerald-700" : "text-red-600"}`}>
            {value > 0 ? "▲" : "▼"} {Math.abs(value)}{unit} <span className="font-normal text-foreground/40">vs kỳ trước</span>
        </span>
    );
}

export function KpiCard({
    label, value, delta, accent = "text-[#1a3c34]",
}: { label: string; value: string | null; delta?: ReactNode; accent?: string }) {
    return (
        <div className="flex flex-col gap-1 rounded-2xl border border-black/8 bg-white p-4">
            <span className="text-[11px] font-semibold text-foreground/55">{label}</span>
            <span className={`text-lg font-bold tabular-nums sm:text-xl ${accent}`}>
                {value === null ? <span className="inline-block h-6 w-20 animate-pulse rounded-lg bg-black/8" /> : value}
            </span>
            <div className="min-h-[14px]">{value !== null && delta}</div>
        </div>
    );
}

export function Empty({ children, h = 160 }: { children: ReactNode; h?: number }) {
    return (
        <div className="flex items-center justify-center text-sm text-foreground/40" style={{ height: h }}>
            {children}
        </div>
    );
}

export const Skeleton = ({ h }: { h: number }) => (
    <div className="animate-pulse rounded-xl bg-black/[0.04]" style={{ height: h }} />
);