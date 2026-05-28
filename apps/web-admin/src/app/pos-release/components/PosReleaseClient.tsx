"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { CheckCircle2, Download, ExternalLink, Loader2, Monitor, Save } from "lucide-react";
import { useEffect, useState } from "react";

import { adminKeys } from "@/services/admin/keys";
import { fetchPosRelease, updatePosRelease } from "@/services/admin/pos-release-api";

function axiosMessage(e: unknown): string {
  const err = e as AxiosError<{ message?: string | string[] }>;
  const d = err.response?.data;
  if (d && typeof d === "object") {
    const m = d.message;
    if (typeof m === "string") return m;
    if (Array.isArray(m)) return m.join(", ");
  }
  return (err as Error).message || "Có lỗi xảy ra.";
}

export function PosReleaseClient() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: adminKeys.posRelease,
    queryFn: fetchPosRelease,
  });

  const [version, setVersion] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setVersion(data.version);
    setDownloadUrl(data.downloadUrl);
    setReleaseNotes(data.releaseNotes);
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () =>
      updatePosRelease({ version: version.trim(), downloadUrl: downloadUrl.trim(), releaseNotes }),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: adminKeys.posRelease });
    },
    onError: (e) => setError(axiosMessage(e)),
  });

  const isDirty =
    version !== (data?.version ?? "") ||
    downloadUrl !== (data?.downloadUrl ?? "") ||
    releaseNotes !== (data?.releaseNotes ?? "");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6 mx-auto w-full">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100">
          <Monitor className="size-5 text-emerald-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Cập nhật UjCha POS</h1>
          <p className="text-sm text-muted">
            Phiên bản hiện tại đang phát hành:{" "}
            <span className="font-semibold text-foreground">v{data?.version || "—"}</span>
          </p>
        </div>
      </div>

      {data?.updatedAt && (
        <p className="text-xs text-muted">
          Cập nhật lần cuối: {new Date(data.updatedAt).toLocaleString("vi-VN")}
        </p>
      )}

      <div className="rounded-2xl border border-black/8 bg-white p-6 shadow-sm space-y-5">
        {/* Version */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted">
            Phiên bản mới <span className="text-red-500">*</span>
          </label>
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="1.0.8"
            className="h-11 w-full rounded-xl border border-black/12 bg-[#f9fafb] px-3 text-sm text-foreground placeholder:text-muted focus:border-[#71b394] focus:outline-none focus:ring-2 focus:ring-[#71b394]/20"
          />
          <p className="text-[11px] text-muted">Dùng định dạng semver: 1.0.8</p>
        </div>

        {/* Download URL */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted">
            Link tải file .exe <span className="text-red-500">*</span>
          </label>
          <input
            value={downloadUrl}
            onChange={(e) => setDownloadUrl(e.target.value)}
            placeholder="https://drive.google.com/uc?export=download&id=..."
            className="h-11 w-full rounded-xl border border-black/12 bg-[#f9fafb] px-3 text-sm text-foreground placeholder:text-muted focus:border-[#71b394] focus:outline-none focus:ring-2 focus:ring-[#71b394]/20"
          />
          {downloadUrl && (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-[#71b394] hover:underline"
            >
              <ExternalLink className="size-3" />
              Kiểm tra link tải
            </a>
          )}
          <p className="text-[11px] text-muted">
            Google Drive: mở file → Share → Copy link →{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[10px]">
              uc?export=download&id=FILE_ID
            </code>
          </p>
        </div>

        {/* Release notes */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted">
            Ghi chú phiên bản
          </label>
          <textarea
            value={releaseNotes}
            onChange={(e) => setReleaseNotes(e.target.value)}
            rows={5}
            placeholder={"- Sửa lỗi đơn hàng trùng\n- Thêm cấu hình TTS\n- Cải thiện hiệu suất"}
            className="w-full resize-none rounded-xl border border-black/12 bg-[#f9fafb] px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-[#71b394] focus:outline-none focus:ring-2 focus:ring-[#71b394]/20"
          />
          <p className="text-[11px] text-muted">
            Mỗi dòng bắt đầu bằng <code className="font-mono">-</code> sẽ hiện thành bullet trong POS.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending || !isDirty || !version.trim() || !downloadUrl.trim()}
          className="flex w-full items-center justify-center gap-2 h-11 rounded-xl bg-[#1a3c34] text-sm font-semibold text-white hover:bg-[#1a3c34]/90 disabled:opacity-50 transition-colors"
        >
          {saveMut.isPending ? (
            <><Loader2 className="size-4 animate-spin" /> Đang lưu…</>
          ) : saveMut.isSuccess && !isDirty ? (
            <><CheckCircle2 className="size-4" /> Đã lưu</>
          ) : (
            <><Save className="size-4" /> Phát hành phiên bản v{version || "…"}</>
          )}
        </button>
      </div>

      {/* Preview */}
      {(version || releaseNotes) && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Xem trước — Modal trong POS app
          </p>
          <div className="rounded-xl bg-white border border-emerald-100 p-4 shadow-sm space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100">
                <Download className="size-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                  Có bản cập nhật mới
                </p>
                <p className="text-base font-bold text-gray-900">UjCha POS v{version || "…"}</p>
              </div>
            </div>
            {releaseNotes && (
              <ul className="space-y-0.5 pt-1">
                {releaseNotes
                  .split("\n")
                  .map((l) => l.replace(/^[\s\-*•]+/, "").trim())
                  .filter(Boolean)
                  .slice(0, 8)
                  .map((note, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                      <span className="mt-0.5 font-bold text-emerald-500">•</span>
                      {note}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
