"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, MapPin, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";

export interface AddressSuggestion {
    displayName: string;
    lat: number;
    lng: number;
    isExactHouseMatch?: boolean;
}

export interface BoundingBox {
    west: number;
    north: number;
    east: number;
    south: number;
}

interface Props {
    value: string;
    onChange: (value: string) => void;
    onSelect: (suggestion: AddressSuggestion) => void;
    /**
     * Gọi khi user gõ free-text nhưng blur ra ngoài mà KHÔNG chọn suggestion nào.
     * Input sẽ tự clear — dùng callback này để parent reset thêm lat/lng (set về null).
     */
    onInvalidClear?: () => void;
    placeholder?: string;
    className?: string;
    autoComplete?: string;
    boundingBox?: BoundingBox;
    strictBounds?: boolean;
    querySuffix?: string;
    /** Hiển thị viền đỏ + thông báo lỗi khi input trống nhưng required */
    error?: string;
}

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 400;

const ALLEY_KEYWORD_MAP: Record<string, string> = {
    k: "Kiệt",
    "kiệt": "Kiệt",
    kiet: "Kiệt",
    h: "Hẻm",
    "hẻm": "Hẻm",
    hem: "Hẻm",
    "ngõ": "Ngõ",
    ngo: "Ngõ",
    "ngách": "Ngách",
    ngach: "Ngách",
};

function normalizeVietnameseAddress(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return trimmed;
    if (trimmed.includes(",")) return trimmed;

    const alleySlashMatch = trimmed.match(
        /^(k|kiệt|kiet|h|hẻm|hem|ngõ|ngo|ngách|ngach)?\.?\s*(\d+)\s*\/\s*(\d+)\s+(.+)$/i,
    );
    if (alleySlashMatch) {
        const [, prefixRaw, alleyNum, houseNum, street] = alleySlashMatch;
        const alleyLabel = prefixRaw
            ? (ALLEY_KEYWORD_MAP[prefixRaw.toLowerCase()] ?? "Kiệt")
            : "Kiệt";
        return `${houseNum}, ${alleyLabel} ${alleyNum} ${street.trim()}`;
    }

    const alleyOnlyMatch = trimmed.match(
        /^(k|kiệt|kiet|h|hẻm|hem|ngõ|ngo|ngách|ngach)\.?\s*(\d+)\s+(.+)$/i,
    );
    if (alleyOnlyMatch) {
        const [, prefixRaw, alleyNum, street] = alleyOnlyMatch;
        const alleyLabel = ALLEY_KEYWORD_MAP[prefixRaw.toLowerCase()] ?? "Kiệt";
        return `${alleyLabel} ${alleyNum} ${street.trim()}`;
    }

    const plainMatch = trimmed.match(/^(\d+[A-Za-z]?)\s+(.+)$/);
    if (plainMatch) {
        const [, houseNum, street] = plainMatch;
        return `${houseNum}, ${street.trim()}`;
    }

    return trimmed;
}

export function AddressAutocompleteInput({
    value,
    onChange,
    onSelect,
    onInvalidClear,
    placeholder,
    className,
    autoComplete = "off",
    boundingBox,
    strictBounds = true,
    querySuffix,
    error,
}: Props) {
    const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(-1);

    const containerRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const skipNextSearchRef = useRef(false);
    const t = useTranslations();
    const requestIdRef = useRef(0);
    const mountedRef = useRef(true);

    // Giá trị được coi là "hợp lệ" — tức đã đi kèm toạ độ, do người dùng CHỌN
    // từ dropdown (không phải tự gõ). Khởi tạo bằng giá trị ban đầu, vì có thể
    // đây là địa chỉ đã lưu sẵn hợp lệ (VD khi mở modal edit).
    const confirmedValueRef = useRef(value);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Nếu parent tự đổi `value` từ bên ngoài theo cách hợp lệ (VD reset form),
    // đồng bộ lại confirmed value để không bị clear oan.
    const prevExternalValueRef = useRef(value);
    useEffect(() => {
        if (value !== prevExternalValueRef.current) {
            prevExternalValueRef.current = value;
        }
    }, [value]);

    const fetchNominatim = useCallback(
        async (queryText: string): Promise<AddressSuggestion[]> => {
            const finalQuery = querySuffix ? `${queryText}, ${querySuffix}` : queryText;
            const params = new URLSearchParams({
                q: finalQuery,
                format: "json",
                addressdetails: "1",
                limit: "6",
                "accept-language": "vi",
                countrycodes: "vn",
            });

            if (boundingBox) {
                params.set(
                    "viewbox",
                    `${boundingBox.west},${boundingBox.north},${boundingBox.east},${boundingBox.south}`,
                );
                if (strictBounds) params.set("bounded", "1");
            }

            const resp = await fetch(`${NOMINATIM_SEARCH_URL}?${params.toString()}`, {
                headers: { "User-Agent": "UjCha/1.0" },
            });
            if (!resp.ok) return [];

            const data = (await resp.json()) as Array<{
                display_name: string;
                lat: string;
                lon: string;
                addresstype?: string;
                address?: { house_number?: string };
            }>;

            return data.map((d) => ({
                displayName: d.display_name,
                lat: parseFloat(d.lat),
                lng: parseFloat(d.lon),
                isExactHouseMatch: d.addresstype === "house" || !!d.address?.house_number,
            }));
        },
        [boundingBox, strictBounds, querySuffix],
    );

    const search = useCallback(
        async (query: string) => {
            const myRequestId = ++requestIdRef.current;
            setLoading(true);
            try {
                const normalizedQuery = normalizeVietnameseAddress(query);
                let results = await fetchNominatim(normalizedQuery);

                if (!mountedRef.current || myRequestId !== requestIdRef.current) return;

                if (results.length === 0 && normalizedQuery !== query.trim()) {
                    results = await fetchNominatim(query.trim());
                    if (!mountedRef.current || myRequestId !== requestIdRef.current) return;
                }

                setSuggestions(results);
                setOpen(true);
            } catch {
                if (mountedRef.current && myRequestId === requestIdRef.current) {
                    setSuggestions([]);
                }
            } finally {
                if (mountedRef.current && myRequestId === requestIdRef.current) {
                    setLoading(false);
                }
            }
        },
        [fetchNominatim],
    );

    useEffect(() => {
        if (skipNextSearchRef.current) {
            skipNextSearchRef.current = false;
            return;
        }
        if (debounceRef.current) clearTimeout(debounceRef.current);
        const trimmed = value.trim();
        if (trimmed.length < MIN_QUERY_LENGTH) {
            setSuggestions([]);
            setOpen(false);
            return;
        }
        debounceRef.current = setTimeout(() => void search(trimmed), DEBOUNCE_MS);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    function handleSelect(s: AddressSuggestion) {
        skipNextSearchRef.current = true;
        confirmedValueRef.current = s.displayName;
        prevExternalValueRef.current = s.displayName;
        onChange(s.displayName);
        onSelect(s);
        setSuggestions([]);
        setOpen(false);
        setHighlightIndex(-1);
    }

    function handleBlur() {
        // Delay nhẹ để onMouseDown (preventDefault) trên suggestion kịp chạy
        // trước khi ta kiểm tra và có thể clear input.
        setTimeout(() => {
            if (!mountedRef.current) return;
            const trimmedValue = value.trim();
            const isConfirmed = trimmedValue === confirmedValueRef.current.trim() && trimmedValue !== "";

            if (!isConfirmed) {
                // User đã gõ free-text nhưng chưa chọn suggestion nào khớp → clear
                confirmedValueRef.current = "";
                prevExternalValueRef.current = "";
                onChange("");
                onInvalidClear?.();
            }
            setOpen(false);
        }, 150);
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (!open || suggestions.length === 0) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            if (highlightIndex >= 0) {
                e.preventDefault();
                handleSelect(suggestions[highlightIndex]);
            }
        } else if (e.key === "Escape") {
            setOpen(false);
        }
    }

    return (
        <div ref={containerRef} className="relative">
            <input
                type="text"
                value={value}
                onChange={(e) => {
                    onChange(e.target.value);
                    setHighlightIndex(-1);
                }}
                onFocus={() => suggestions.length > 0 && setOpen(true)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                autoComplete={autoComplete}
                className={`${className} ${error ? "ring-2 ring-red-400" : ""}`}
            />

            {loading && (
                <Loader2 className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-foreground/30" />
            )}

            {open && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-64 overflow-y-auto rounded-xl border border-black/8 bg-white shadow-lg">
                    {suggestions.map((s, i) => (
                        <button
                            key={`${s.lat}-${s.lng}-${i}`}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleSelect(s)}
                            onMouseEnter={() => setHighlightIndex(i)}
                            className={`flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors ${highlightIndex === i ? "bg-kun-sage/10" : "hover:bg-black/[0.03]"
                                }`}
                        >
                            <MapPin className="mt-0.5 size-3.5 shrink-0 text-kun-products-forest" />
                            <span className="min-w-0 flex-1">
                                <span className="line-clamp-2 block text-foreground/80">{s.displayName}</span>
                                {!s.isExactHouseMatch && (
                                    <span className="mt-0.5 block text-[10px] text-amber-600">
                                        {t("exact_address_label")}
                                    </span>
                                )}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {open && !loading && suggestions.length === 0 && value.trim().length >= MIN_QUERY_LENGTH && (
                <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 rounded-xl border border-black/8 bg-white px-3 py-2.5 text-sm text-foreground/40 shadow-lg">
                    {t("not_found_address_label")}
                </div>
            )}

            {error && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-red-500">
                    <AlertCircle className="size-3" />
                    {error}
                </p>
            )}
        </div>
    );
}