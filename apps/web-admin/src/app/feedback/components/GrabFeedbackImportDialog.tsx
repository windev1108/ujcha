"use client";

import { Modal, Button, useOverlayState } from "@heroui/react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  MonitorDot,
  Star,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchGrabReviews,
  pollGrabWebLogin,
  startGrabWebLogin,
} from "@/services/admin/grab-api";
import {
  fetchGrabImportedIds,
  importGrabFeedbacks,
  type GrabReviewImportItem,
} from "@/services/admin/feedback-api";

// ─── Grab review type ─────────────────────────────────────────────────────────

type GrabReview = {
  reviewID: string;
  createdAt: number;
  rating: number;
  description: string;
  eaterName: string;
  orderedItems?: string[];
  paxReviewImageUrls?: string[];
};

function parseReviews(raw: unknown[]): GrabReview[] {
  return (raw ?? []).flatMap((r) => {
    const rv = r as Record<string, unknown>;
    const reviewID = typeof rv.reviewID === "string" ? rv.reviewID.trim() : "";
    const description = typeof rv.description === "string" ? rv.description.trim() : "";
    if (!reviewID || !description) return [];
    const rating = typeof rv.rating === "number" ? rv.rating : 0;
    if (rating < 1 || rating > 5) return [];
    const createdAt = typeof rv.createdAt === "number" ? rv.createdAt : 0;
    const eaterName = typeof rv.eaterName === "string" ? rv.eaterName.trim() : "Khách hàng GrabFood";
    const orderedItems = Array.isArray(rv.orderedItems)
      ? (rv.orderedItems as unknown[]).flatMap((i) => {
          const s = typeof i === "string" ? i.trim() : "";
          const n = (i as Record<string, unknown>)?.name;
          const name = s || (typeof n === "string" ? n.trim() : "");
          return name ? [name] : [];
        })
      : [];
    const paxReviewImageUrls = Array.isArray(rv.paxReviewImageUrls)
      ? (rv.paxReviewImageUrls as unknown[]).flatMap((u) =>
          typeof u === "string" && u.trim() ? [u.trim()] : [],
        )
      : [];
    return [{ reviewID, createdAt, rating, description, eaterName, orderedItems, paxReviewImageUrls }];
  });
}

// ─── Step machine ─────────────────────────────────────────────────────────────

type Step = "login" | "preview" | "importing" | "done";

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────

export function GrabFeedbackImportDialog({ isOpen, onOpenChange, onImported }: Props) {
  const isLocalDev = typeof window !== "undefined" && window.location.hostname === "localhost";

  const [step, setStep] = useState<Step>("login");
  const [starting, setStarting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [reviews, setReviews] = useState<GrabReview[]>([]);
  const [nextToken, setNextToken] = useState<string | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [authCookie, setAuthCookie] = useState<string>("");
  const [merchantId, setMerchantId] = useState<string | undefined>(undefined);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [ratingFilter, setRatingFilter] = useState<number | undefined>(undefined);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [result, setResult] = useState<ImportResult | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setStep("login"); setStarting(false);
    setLoginError(null); setFetchError(null);
    setReviews([]); setNextToken(undefined); setLoadingMore(false);
    setAuthCookie(""); setMerchantId(undefined);
    setSelected(new Set()); setImportedIds(new Set());
    setRatingFilter(undefined); setExpandedIds(new Set());
    setResult(null);
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const modalState = useOverlayState({
    isOpen,
    onOpenChange: (open) => { if (!open) reset(); onOpenChange(open); },
  });

  // ── Auth ─────────────────────────────────────────────────────────────────

  const loadReviews = async (cookie: string, mid?: string, token?: string) => {
    setFetchError(null);
    try {
      const [data, alreadyImported] = await Promise.all([
        fetchGrabReviews(cookie, mid, token ?? "", 50),
        token ? Promise.resolve(null) : fetchGrabImportedIds().catch(() => [] as string[]),
      ]);

      const parsed = parseReviews(data.reviews ?? []);
      const dedup = (list: GrabReview[]): GrabReview[] => {
        const seen = new Set<string>();
        return list.filter((r) => (seen.has(r.reviewID) ? false : (seen.add(r.reviewID), true)));
      };

      if (!token) {
        const unique = dedup(parsed);
        const importedSet = new Set(alreadyImported ?? []);
        setImportedIds(importedSet);
        setReviews(unique);
        // auto-select only those not already imported
        setSelected(new Set(unique.filter((r) => !importedSet.has(r.reviewID)).map((r) => r.reviewID)));
      } else {
        setReviews((prev) => {
          const prevCount = prev.length;
          const unique = dedup([...prev, ...parsed]);
          const added = unique.length - prevCount;
          // if no genuinely new reviews came back, exhaust pagination
          if (added === 0) {
            setNextToken(undefined);
          } else {
            setNextToken(data.nextToken || undefined);
            setImportedIds((imp) => {
              setSelected((sel) => {
                const next = new Set(sel);
                for (const r of parsed) {
                  if (!imp.has(r.reviewID)) next.add(r.reviewID);
                }
                return next;
              });
              return imp;
            });
          }
          return unique;
        });
        setStarting(false);
        setStep("preview");
        return;
      }

      setNextToken(data.nextToken || undefined);
      setAuthCookie(cookie);
      setMerchantId(mid);
      setStarting(false);
      setStep("preview");
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : String(e));
      setStarting(false);
    }
  };

  const handleStartLogin = async () => {
    setStarting(true); setLoginError(null);
    try {
      const { sessionId } = await startGrabWebLogin();
      pollRef.current = setInterval(async () => {
        try {
          const r = await pollGrabWebLogin(sessionId);
          if (r.status === "pending") return;
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          if (r.status === "error" || !r.cookie) {
            setLoginError(r.error ?? "Không lấy được cookie — thử lại");
            setStarting(false); return;
          }
          await loadReviews(r.cookie, r.merchantId);
        } catch { /* blip */ }
      }, 1500);
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : String(e));
      setStarting(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextToken || loadingMore) return;
    setLoadingMore(true);
    await loadReviews(authCookie, merchantId, nextToken);
    setLoadingMore(false);
  };

  // ── Import ────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    const toImport: GrabReviewImportItem[] = reviews
      .filter((r) => selected.has(r.reviewID))
      .map((r) => ({
        reviewID: r.reviewID,
        content: r.description,
        rating: r.rating,
        eaterName: r.eaterName || undefined,
        createdAt: r.createdAt || undefined,
        orderedItemNames: r.orderedItems && r.orderedItems.length > 0 ? r.orderedItems : undefined,
      }));
    if (toImport.length === 0) return;
    setStep("importing");
    try {
      const res = await importGrabFeedbacks(toImport);
      setResult(res);
      if (res.imported > 0) onImported();
    } catch (e) {
      setResult({ imported: 0, skipped: 0, failed: toImport.length, errors: [String(e)] });
    }
    setStep("done");
  };

  // ── Computed ─────────────────────────────────────────────────────────────

  const filtered = ratingFilter != null
    ? reviews.filter((r) => r.rating === ratingFilter)
    : reviews;

  const selectedCount = reviews.filter((r) => selected.has(r.reviewID)).length;

  const toggleItem = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleExpand = (id: string) => setExpandedIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const heading = {
    login: "Kết nối GrabFood",
    preview: `Chọn đánh giá (${reviews.length} reviews)`,
    importing: "Đang import…",
    done: "Import xong",
  }[step];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Modal.Root state={modalState}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="lg" scroll="inside">
          <Modal.Dialog className="flex max-h-[90vh] max-w-2xl flex-col rounded-2xl border border-black/6 p-0 shadow-xl">

            {/* ── Header ── */}
            <Modal.Header className="shrink-0 border-b border-black/8 px-6 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">GrabFood Integration</p>
              <Modal.Heading className="mt-0.5 text-lg font-bold text-[#1a3c34]">{heading}</Modal.Heading>
            </Modal.Header>

            {/* ── Body ── */}
            <Modal.Body className="min-h-0 flex-1 overflow-y-auto px-6 py-5">

              {/* login idle */}
              {step === "login" && !starting && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-3 rounded-2xl bg-[#f0f7f4] p-5">
                    <MonitorDot className="mt-0.5 size-5 shrink-0 text-[#1a3c34]" />
                    <p className="text-sm text-foreground/70">
                      {isLocalDev ? (
                        <>Một cửa sổ Chrome sẽ mở ra. Đăng nhập tài khoản GrabFood merchant, rồi bấm nút xanh{" "}<strong className="text-[#00b14f]">"Xác nhận đã đăng nhập — Lấy session"</strong>.</>
                      ) : (
                        <>Tính năng này chỉ khả dụng khi chạy web-admin ở local. Hãy mở <code className="rounded bg-black/8 px-1 font-mono text-xs">http://localhost:3001</code> để sử dụng.</>
                      )}
                    </p>
                  </div>
                  {(loginError ?? fetchError) && (
                    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      {loginError ?? fetchError}
                    </div>
                  )}
                </div>
              )}

              {/* login waiting */}
              {step === "login" && starting && isLocalDev && (
                <div className="flex flex-col items-center gap-6 py-8">
                  <div className="flex size-16 items-center justify-center rounded-2xl bg-[#f0f7f4]">
                    <Loader2 className="size-8 animate-spin text-[#1a3c34]" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">Cửa sổ Chrome đã mở</p>
                    <p className="mt-1.5 text-sm text-foreground/55">
                      Đăng nhập xong → bấm nút xanh{" "}
                      <strong className="text-[#00b14f]">"Xác nhận đã đăng nhập"</strong>
                    </p>
                  </div>
                  {fetchError && (
                    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      {fetchError}
                    </div>
                  )}
                </div>
              )}

              {/* preview */}
              {step === "preview" && (
                <div className="flex flex-col gap-4">

                  {/* Stats bar */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-[#f0f7f4] p-3 text-center">
                      <p className="text-lg font-bold text-[#1a3c34]">{reviews.length}</p>
                      <p className="text-[10px] text-foreground/50">Tổng đánh giá</p>
                    </div>
                    <div className="rounded-xl bg-green-50 p-3 text-center">
                      <p className="text-lg font-bold text-green-700">{selectedCount}</p>
                      <p className="text-[10px] text-green-600">Đã chọn</p>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-3 text-center">
                      <p className="text-lg font-bold text-amber-700">
                        {reviews.length > 0
                          ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
                          : "—"}
                      </p>
                      <p className="text-[10px] text-amber-600">TB sao</p>
                    </div>
                  </div>

                  {/* Select all / deselect + rating filter */}
                  <div className="flex items-center justify-between rounded-xl bg-[#f0f7f4] px-4 py-2.5">
                    <span className="text-sm text-foreground/70">
                      <strong className="text-foreground">{selectedCount}</strong>/{reviews.length} được chọn
                    </span>
                    <div className="flex gap-3 text-xs">
                      <button type="button" onClick={() => setSelected(new Set(reviews.filter((r) => !importedIds.has(r.reviewID)).map((r) => r.reviewID)))} className="font-semibold text-[#1a3c34] hover:underline">Chọn tất cả</button>
                      <button type="button" onClick={() => setSelected(new Set())} className="text-foreground/45 hover:underline">Bỏ chọn</button>
                    </div>
                  </div>

                  {/* Rating filter chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {([undefined, 5, 4, 3, 2, 1] as (number | undefined)[]).map((r) => {
                      const count = r == null ? reviews.length : reviews.filter((rv) => rv.rating === r).length;
                      return (
                        <button
                          key={String(r)}
                          type="button"
                          onClick={() => setRatingFilter(r === ratingFilter ? undefined : r)}
                          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${ratingFilter === r ? "bg-[#1a3c34] text-white" : "bg-surface-card text-foreground/70 hover:bg-surface-tertiary"}`}
                        >
                          {r == null ? `Tất cả (${count})` : `${r}★ (${count})`}
                        </button>
                      );
                    })}
                  </div>

                  {/* Already-imported notice */}
                  {importedIds.size > 0 && (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                      <CheckCircle2 className="size-3.5 shrink-0" />
                      {importedIds.size} đánh giá đã import trước đó — được bỏ chọn tự động.
                    </div>
                  )}

                  {/* Review list */}
                  <div className="flex flex-col gap-2">
                    {filtered.length === 0 && (
                      <p className="py-8 text-center text-sm text-foreground/40">Không có đánh giá nào.</p>
                    )}
                    {filtered.map((r) => {
                      const alreadyImported = importedIds.has(r.reviewID);
                      const checked = selected.has(r.reviewID);
                      const expanded = expandedIds.has(r.reviewID);
                      const date = r.createdAt
                        ? new Date(r.createdAt * 1000).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
                        : null;
                      return (
                        <div
                          key={r.reviewID}
                          className={`overflow-hidden rounded-xl border transition ${
                            alreadyImported
                              ? "border-emerald-200 bg-emerald-50/60 opacity-70"
                              : checked
                              ? "border-[#1a3c34]/25 bg-[#1a3c34]/[0.025]"
                              : "border-black/8 bg-white hover:border-black/12"
                          }`}
                        >
                          <div
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") toggleItem(r.reviewID); }}
                            onClick={() => toggleItem(r.reviewID)}
                            className="flex cursor-pointer items-start gap-3 px-4 py-3"
                          >
                            {/* Checkbox */}
                            <div className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border-2 transition ${
                              alreadyImported
                                ? "border-emerald-400 bg-emerald-400"
                                : checked
                                ? "border-[#1a3c34] bg-[#1a3c34]"
                                : "border-black/20 bg-white"
                            }`}>
                              {(checked || alreadyImported) && <span className="text-[8px] font-bold text-white">✓</span>}
                            </div>

                            {/* Content */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-foreground">{r.eaterName}</p>
                                {date && <span className="text-[10px] text-foreground/40">{date}</span>}
                                {alreadyImported && (
                                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                    ✓ Đã import
                                  </span>
                                )}
                              </div>

                              {/* Stars */}
                              <div className="mt-0.5 flex items-center gap-0.5">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star key={i} className={`size-3 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-foreground/15"}`} />
                                ))}
                              </div>

                              {/* Review text */}
                              <p className={`mt-1.5 text-sm text-foreground/75 ${expanded ? "" : "line-clamp-2"}`}>
                                {r.description}
                              </p>

                              {/* Ordered items */}
                              {r.orderedItems && r.orderedItems.length > 0 && (
                                <p className="mt-1 text-[11px] text-foreground/45">
                                  Đã đặt: {r.orderedItems.join(", ")}
                                </p>
                              )}

                              {/* Images row */}
                              {r.paxReviewImageUrls && r.paxReviewImageUrls.length > 0 && (
                                <div className="mt-2 flex gap-1.5">
                                  {r.paxReviewImageUrls.slice(0, 4).map((url, i) => (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      key={i}
                                      src={url}
                                      alt=""
                                      className="size-14 rounded-lg object-cover ring-1 ring-black/8"
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                    />
                                  ))}
                                  {r.paxReviewImageUrls.length > 4 && (
                                    <div className="flex size-14 items-center justify-center rounded-lg bg-surface-card text-xs font-semibold text-foreground/50">
                                      +{r.paxReviewImageUrls.length - 4}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Expand toggle for long text */}
                            {r.description.length > 120 && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleExpand(r.reviewID); }}
                                className="mt-0.5 shrink-0 rounded-full p-0.5 text-foreground/30 hover:bg-black/8 hover:text-foreground/60"
                              >
                                {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Load more */}
                  {nextToken && (
                    <button
                      type="button"
                      onClick={() => void handleLoadMore()}
                      disabled={loadingMore}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-black/8 py-2.5 text-sm font-semibold text-foreground/60 hover:bg-black/[0.02] disabled:opacity-50"
                    >
                      {loadingMore ? <Loader2 className="size-4 animate-spin" /> : null}
                      Tải thêm đánh giá
                    </button>
                  )}
                </div>
              )}

              {/* importing */}
              {step === "importing" && (
                <div className="flex flex-col items-center gap-6 py-12">
                  <Loader2 className="size-10 animate-spin text-[#1a3c34]" />
                  <div className="text-center">
                    <p className="font-semibold">Đang import đánh giá…</p>
                    <p className="mt-1 text-sm text-foreground/40">Vui lòng không đóng cửa sổ này</p>
                  </div>
                </div>
              )}

              {/* done */}
              {step === "done" && result && (
                <div className="flex flex-col items-center gap-4 py-6">
                  <CheckCircle2 className="size-12 text-emerald-500" />
                  <div className="text-center">
                    <p className="text-lg font-bold">{result.imported} đánh giá đã nhập thành công</p>
                    {result.skipped > 0 && <p className="mt-1 text-sm text-foreground/50">{result.skipped} bỏ qua (đã tồn tại)</p>}
                    {result.failed > 0 && <p className="mt-1 text-sm text-red-600">{result.failed} lỗi</p>}
                  </div>
                  {result.errors.length > 0 && (
                    <div className="w-full rounded-xl border border-red-100 bg-red-50 p-3">
                      <p className="mb-1.5 text-xs font-semibold text-red-700">Chi tiết lỗi:</p>
                      <ul className="space-y-0.5 text-xs text-red-600">
                        {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </Modal.Body>

            {/* ── Footer ── */}
            <Modal.Footer className="shrink-0 flex items-center justify-between border-t border-black/8 px-6 py-4">
              {step === "login" && !starting && (
                <>
                  <Button variant="ghost" onPress={() => onOpenChange(false)} className="rounded-full">Hủy</Button>
                  {isLocalDev && (
                    <Button onPress={() => void handleStartLogin()} className="rounded-full bg-[#1a3c34] font-semibold text-white">
                      Mở cửa sổ đăng nhập GrabFood →
                    </Button>
                  )}
                </>
              )}
              {step === "login" && starting && (
                <div className="flex w-full items-center justify-between">
                  <Button
                    variant="ghost"
                    onPress={() => {
                      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
                      setStarting(false);
                    }}
                    className="rounded-full text-foreground/50"
                  >
                    Hủy
                  </Button>
                  <span className="text-sm text-foreground/40">Đang chờ bạn bấm nút xanh trong Chrome…</span>
                </div>
              )}
              {step === "preview" && (
                <>
                  <Button variant="ghost" onPress={() => setStep("login")} className="rounded-full">← Quay lại</Button>
                  <Button
                    isDisabled={selectedCount === 0}
                    onPress={() => void handleImport()}
                    className="rounded-full bg-[#1a3c34] font-semibold text-white"
                  >
                    Import {selectedCount} đánh giá →
                  </Button>
                </>
              )}
              {step === "importing" && <div className="w-full text-center text-xs text-foreground/40">Đang xử lý…</div>}
              {step === "done" && (
                <Button onPress={() => { reset(); onOpenChange(false); }} className="ml-auto rounded-full bg-[#1a3c34] font-semibold text-white">Hoàn thành</Button>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  );
}
