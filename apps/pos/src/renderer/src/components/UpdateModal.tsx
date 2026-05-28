import { useState, useEffect } from 'react'
import { Download, X, RefreshCw, CheckCircle2, AlertCircle, Zap } from 'lucide-react'

export interface UpdateInfo {
  version: string
  downloadUrl: string
  releaseNotes: string | null
}

interface Props {
  info: UpdateInfo
  currentVersion: string
  onDismiss: () => void
}

const eAPI = (window as unknown as {
  electronAPI?: import('../../../preload/index').ElectronAPI
}).electronAPI

function parseNotes(raw: string | null): string[] {
  if (!raw) return []
  return raw.split('\n').map(l => l.replace(/^[\s\-*•]+/, '').trim()).filter(Boolean).slice(0, 8)
}

type Stage = 'available' | 'downloading' | 'downloaded' | 'installing' | 'error'

export function UpdateModal({ info, currentVersion, onDismiss }: Props) {
  const notes = parseNotes(info.releaseNotes)
  const [stage, setStage] = useState<Stage>('available')
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const u = eAPI?.updater
    if (!u) return
    const unsubs = [
      u.onProgress(pct => { if (pct >= 0) setProgress(pct) }),
      u.onDownloaded(() => setStage('downloaded')),
      u.onDownloadError(msg => { setErrorMsg(msg); setStage('error') }),
      u.onInstalling(() => setStage('installing')),
    ]
    return () => unsubs.forEach(fn => fn())
  }, [])

  function startDownload() {
    setStage('downloading')
    setProgress(0)
    eAPI?.updater?.startDownload(info.downloadUrl, info.version)
  }

  const canDismiss = stage === 'available' || stage === 'downloaded' || stage === 'error'

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-[420px] max-w-[92vw] rounded-2xl bg-white shadow-2xl ring-1 ring-black/8 overflow-hidden">

        {/* Header strip */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
              <Zap size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-100">
                Cập nhật phần mềm
              </p>
              <p className="text-lg font-bold text-white">UjCha POS v{info.version}</p>
            </div>
            {canDismiss && (
              <button
                onClick={onDismiss}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-400">
            Phiên bản hiện tại: <span className="font-semibold text-gray-600">v{currentVersion}</span>
          </p>

          {/* Release notes — only show when available */}
          {notes.length > 0 && stage === 'available' && (
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Có gì mới</p>
              <ul className="space-y-1">
                {notes.map((n, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-0.5 text-emerald-500 font-bold shrink-0">•</span>{n}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Stage: available ── */}
          {stage === 'available' && (
            <div className="space-y-2">
              <button
                onClick={startDownload}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-sm shadow-emerald-200"
              >
                <Download size={16} />
                Tải và cài đặt ngay
              </button>
              <button
                onClick={onDismiss}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Nhắc tôi sau
              </button>
            </div>
          )}

          {/* ── Stage: downloading ── */}
          {stage === 'downloading' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Đang tải xuống…</span>
                  <span className="text-sm font-bold text-emerald-600 tabular-nums">
                    {progress > 0 ? `${progress}%` : '—'}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-100">
                  {progress > 0 ? (
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  ) : (
                    <div className="h-full w-full animate-pulse rounded-full bg-emerald-100">
                      <div className="h-full w-2/5 rounded-full bg-emerald-400 animate-[shimmer_1.5s_ease-in-out_infinite]" />
                    </div>
                  )}
                </div>

                {/* Step indicators */}
                <div className="flex items-center gap-2 pt-1">
                  {[
                    { label: 'Tải xuống', done: false, active: true },
                    { label: 'Cài đặt', done: false, active: false },
                    { label: 'Hoàn thành', done: false, active: false },
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      {i > 0 && <div className="h-px w-6 bg-gray-200" />}
                      <div className={`h-2 w-2 rounded-full ${step.active ? 'bg-emerald-500 animate-pulse' : 'bg-gray-200'}`} />
                      <span className={`text-[11px] font-medium ${step.active ? 'text-emerald-600' : 'text-gray-300'}`}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-gray-400 text-center">
                Vui lòng không tắt ứng dụng trong khi tải
              </p>
            </div>
          )}

          {/* ── Stage: downloaded ── */}
          {stage === 'downloaded' && (
            <div className="space-y-3">
              {/* Step indicators — download done */}
              <div className="flex items-center gap-2">
                {[
                  { label: 'Tải xuống', done: true, active: false },
                  { label: 'Cài đặt', done: false, active: true },
                  { label: 'Hoàn thành', done: false, active: false },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    {i > 0 && <div className={`h-px w-6 ${step.done || i === 1 ? 'bg-emerald-300' : 'bg-gray-200'}`} />}
                    <div className={`h-2 w-2 rounded-full ${step.done ? 'bg-emerald-500' : step.active ? 'bg-emerald-500 animate-pulse' : 'bg-gray-200'}`} />
                    <span className={`text-[11px] font-medium ${step.done || step.active ? 'text-emerald-600' : 'text-gray-300'}`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-emerald-800">Tải xong!</p>
                  <p className="text-xs text-emerald-600">Ứng dụng sẽ tự khởi động lại sau khi cài đặt.</p>
                </div>
              </div>

              <button
                onClick={() => eAPI?.updater?.install()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-sm shadow-emerald-200"
              >
                <Zap size={16} />
                Cài đặt và khởi động lại
              </button>
              <button
                onClick={onDismiss}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Để sau
              </button>
            </div>
          )}

          {/* ── Stage: installing ── */}
          {stage === 'installing' && (
            <div className="space-y-4">
              {/* Step indicators — installing */}
              <div className="flex items-center gap-2">
                {[
                  { label: 'Tải xuống', done: true },
                  { label: 'Cài đặt', done: false, active: true },
                  { label: 'Hoàn thành', done: false },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    {i > 0 && <div className={`h-px w-6 ${i <= 1 ? 'bg-emerald-300' : 'bg-gray-200'}`} />}
                    <div className={`h-2 w-2 rounded-full ${step.done ? 'bg-emerald-500' : (step as any).active ? 'bg-emerald-500 animate-pulse' : 'bg-gray-200'}`} />
                    <span className={`text-[11px] font-medium ${step.done || (step as any).active ? 'text-emerald-600' : 'text-gray-300'}`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col items-center gap-3 py-4">
                <div className="relative">
                  <div className="h-14 w-14 rounded-full border-4 border-emerald-100" />
                  <div className="absolute inset-0 h-14 w-14 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
                  <Zap size={20} className="absolute inset-0 m-auto text-emerald-500" />
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-gray-900">Đang cài đặt…</p>
                  <p className="text-sm text-gray-400 mt-0.5">Ứng dụng sẽ tự khởi động lại</p>
                </div>
              </div>

              {/* Indeterminate bar */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full w-1/2 rounded-full bg-emerald-400 animate-[bounce-x_1.2s_ease-in-out_infinite]" />
              </div>
            </div>
          )}

          {/* ── Stage: error ── */}
          {stage === 'error' && (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-3 py-2.5">
                <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-700">Tải thất bại</p>
                  <p className="text-xs text-red-500 mt-0.5 break-all">{errorMsg}</p>
                </div>
              </div>
              <button
                onClick={startDownload}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-gray-800 transition-all"
              >
                <RefreshCw size={15} />
                Thử lại
              </button>
              <button
                onClick={onDismiss}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Đóng
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
