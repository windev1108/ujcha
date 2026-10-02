import { isValidMargin } from "./pricing-margin";

export type MarkupParse = { ok: true; value: number | null } | { ok: false };

/** Rỗng = null (kế thừa). Chấp nhận dấu phẩy. Hợp lệ 0–10.000. */
export function parseMarkupInput(text: string): MarkupParse {
    const t = text.trim().replace(",", ".");
    if (!t) return { ok: true, value: null };
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 && n <= 10_000
        ? { ok: true, value: Math.round(n * 100) / 100 }
        : { ok: false };
}

export function markupToInput(v: string | number | null | undefined): string {
    if (v == null || v === "") return "";
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : "";
}


export function marginToInput(v: string | number | null | undefined): string {
    if (v == null || v === "") return "";
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : "";
}

export function parseMarginInput(
    text: string,
): { ok: true; value: number | null } | { ok: false } {
    const t = text.trim().replace(",", ".");
    if (!t) return { ok: true, value: null }; // trống = kế thừa
    const n = Number(t);
    return isValidMargin(n) ? { ok: true, value: n } : { ok: false };
}