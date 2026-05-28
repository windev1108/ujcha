"use client";

import {
  Button,
  Card,
  CardContent,
  Label,
  ListBox,
  Select,
  Switch,
} from "@heroui/react";
import { CheckCircle2, Loader2, Play, RotateCcw, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";

import {
  adminFieldStack,
  adminLabelClass,
  adminSelectTriggerClass,
  adminSelectValueClass,
} from "@/lib/admin-form-classes";
import { fetchTtsConfig, updateTtsConfig, type TtsConfig } from "@/services/admin/tts-config-api";

const TTS_VOICES = [
  { value: "hn-leyen", label: "Lê Yến", gender: "Nữ", region: "Miền Bắc" },
  { value: "hn-quynhanh", label: "Quỳnh Anh", gender: "Nữ", region: "Miền Bắc" },
  { value: "hn-thaochi", label: "Thảo Chi", gender: "Nữ", region: "Miền Bắc" },
  { value: "hn-thanhtung", label: "Thanh Tùng", gender: "Nam", region: "Miền Bắc" },
  { value: "hn-namkhanh", label: "Nam Khánh", gender: "Nam", region: "Miền Bắc" },
  { value: "hn-phuongtrang", label: "Phương Trang", gender: "Nữ", region: "Miền Bắc" },
  { value: "hn-thanhha", label: "Thanh Hà", gender: "Nữ", region: "Miền Bắc" },
  { value: "hn-thanhphuong", label: "Thanh Phương", gender: "Nữ", region: "Miền Bắc" },
  { value: "hn-tienquan", label: "Tiến Quân", gender: "Nam", region: "Miền Bắc" },
  { value: "hue-maingoc", label: "Mai Ngọc", gender: "Nữ", region: "Miền Trung" },
  { value: "hue-baoquoc", label: "Bảo Quốc", gender: "Nam", region: "Miền Trung" },
  { value: "hcm-diemmy", label: "Diễm My", gender: "Nữ", region: "Miền Nam" },
  { value: "hcm-thuydung", label: "Thùy Dung", gender: "Nữ", region: "Miền Nam" },
  { value: "hcm-phuongly", label: "Phương Ly", gender: "Nữ", region: "Miền Nam" },
  { value: "hcm-minhquan", label: "Minh Quân", gender: "Nam", region: "Miền Nam" },
  { value: "hcm-thuyduyen", label: "Thùy Duyên", gender: "Nữ", region: "Miền Nam" },
] as const;

const RETURN_OPTIONS = [
  { value: 1, label: "1 — URL stream" },
  { value: 2, label: "2 — Base64" },
  { value: 3, label: "3 — Binary MP3" },
  { value: 4, label: "4 — URL tải về" },
];

const DEFAULT_CONFIG: TtsConfig = {
  voice: "hcm-diemmy",
  speed: 1,
  tts_return_option: 3,
  without_filter: false,
};

export function VoicerClient() {
  const [config, setConfig] = useState<TtsConfig>(DEFAULT_CONFIG);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewText, setPreviewText] = useState("Đã nhận thanh toán 150.000 đồng!");
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    fetchTtsConfig()
      .then((cfg) => { setConfig(cfg); setLoadState('ready') })
      .catch(() => { setConfig(DEFAULT_CONFIG); setLoadState('error') });
  }, []);

  const update = <K extends keyof TtsConfig>(key: K, value: TtsConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await updateTtsConfig(config);
      setConfig(saved);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      const reset = await updateTtsConfig(DEFAULT_CONFIG);
      setConfig(reset);
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (playing || !previewText.trim()) return;
    setPlaying(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: previewText.trim(), ...config }),
      });
      if (!res.ok) throw new Error("tts_error");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play().catch(() => { });
      audio.addEventListener("ended", () => { URL.revokeObjectURL(url); setPlaying(false) });
    } catch {
      setPlaying(false);
    }
  };

  const selectedVoice = TTS_VOICES.find((v) => v.value === config.voice);

  if (loadState === 'loading') {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-6 animate-spin text-[#5a8f7a]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
            Giọng đọc TTS
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1a3c34] sm:text-3xl">
            Cấu hình giọng đọc
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-foreground/55">
            Thiết lập giọng đọc Viettel AI dùng cho thông báo thanh toán tự động.
            Cấu hình được lưu trên server và áp dụng đồng bộ cho tất cả thiết bị POS.
          </p>
          {loadState === 'error' && (
            <p className="mt-2 text-xs text-red-500">
              Không thể tải cấu hình từ server — đang dùng giá trị mặc định.
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="ghost"
            isDisabled={saving}
            className="rounded-full border border-black/10 px-5 font-medium text-foreground/60 hover:text-foreground"
            onPress={() => void handleReset()}
          >
            <RotateCcw className="mr-1.5 size-3.5" />
            Đặt lại mặc định
          </Button>
          <Button
            className="rounded-full bg-[#1a3c34] px-6 font-semibold text-white shadow-md shadow-[#1a3c34]/20"
            isDisabled={saving}
            onPress={() => void handleSave()}
          >
            {saving ? (
              <><Loader2 className="mr-1.5 size-4 animate-spin" />Đang lưu…</>
            ) : saved ? (
              <><CheckCircle2 className="mr-1.5 size-4 text-emerald-300" />Đã lưu</>
            ) : (
              "Lưu cấu hình"
            )}
          </Button>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* ── Config form ── */}
        <div className="flex flex-col gap-6">
          <Card className="rounded-2xl border border-black/6 shadow-sm">
            <CardContent className="flex flex-col gap-5 px-5 py-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Giọng đọc
              </p>
              <div className={adminFieldStack}>
                <Label className={adminLabelClass}>Chọn giọng đọc</Label>
                <Select
                  value={config.voice}
                  onChange={(key) => update("voice", key as string)}
                >
                  <Select.Trigger className={adminSelectTriggerClass}>
                    <Select.Value className={adminSelectValueClass} />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox className="max-h-72 min-w-(--trigger-width) overflow-y-auto p-1 outline-none">
                      {TTS_VOICES.map((v) => (
                        <ListBox.Item
                          key={v.value}
                          id={v.value}
                          textValue={v.label}
                          className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm"
                        >
                          <span>{v.label}</span>
                          <span className="ml-2 shrink-0 text-xs text-foreground/40">
                            {v.gender} · {v.region}
                          </span>
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                {selectedVoice && (
                  <p className="text-[11px] text-foreground/45">
                    {selectedVoice.label} · Giọng {selectedVoice.gender} · Vùng {selectedVoice.region} · Viettel AI
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-black/6 shadow-sm">
            <CardContent className="flex flex-col gap-5 px-5 py-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Tham số âm thanh
              </p>

              <div className={adminFieldStack}>
                <Label className={adminLabelClass}>
                  Tốc độ đọc{" "}
                  <span className="ml-1 font-mono font-bold text-[#1a3c34]">{config.speed}×</span>
                </Label>
                <input
                  type="range"
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  value={config.speed}
                  onChange={(e) => update("speed", Number(e.target.value))}
                  className="h-2 w-full cursor-pointer accent-[#1a3c34]"
                />
                <div className="flex justify-between text-[10px] text-foreground/40">
                  <span>0.5× (chậm)</span>
                  <span>1× (chuẩn)</span>
                  <span>2× (nhanh)</span>
                </div>
              </div>

              <div className={adminFieldStack}>
                <Label className={adminLabelClass}>Định dạng trả về</Label>
                <Select
                  value={String(config.tts_return_option)}
                  onChange={(key) => update("tts_return_option", Number(key))}
                >
                  <Select.Trigger className={adminSelectTriggerClass}>
                    <Select.Value className={adminSelectValueClass} />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox className="min-w-(--trigger-width) outline-none">
                      {RETURN_OPTIONS.map((o) => (
                        <ListBox.Item
                          key={o.value}
                          id={String(o.value)}
                          textValue={o.label}
                          className="rounded-lg text-sm"
                        >
                          {o.label}
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                <p className="text-[11px] text-foreground/45">
                  Khuyến nghị dùng <span className="font-mono font-semibold">3 — Binary MP3</span>.
                </p>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl border border-black/8 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Tắt bộ lọc từ ngữ</p>
                  <p className="mt-0.5 text-xs text-foreground/50">
                    Khi bật, Viettel AI sẽ đọc nguyên văn không qua bộ lọc nội dung.
                  </p>
                </div>
                <Switch
                  isSelected={config.without_filter}
                  onChange={(v) => update("without_filter", v)}
                >
                  <Switch.Control><Switch.Thumb /></Switch.Control>
                </Switch>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Preview ── */}
        <div className="flex flex-col gap-4">
          <Card className="sticky top-6 rounded-2xl border border-black/6 shadow-sm">
            <CardContent className="flex flex-col gap-5 px-5 py-5">
              <div className="flex items-center gap-2">
                <Volume2 className="size-4 text-[#1a3c34]" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Thử giọng đọc
                </p>
              </div>

              <div className={adminFieldStack}>
                <Label className={adminLabelClass}>Văn bản thử</Label>
                <textarea
                  value={previewText}
                  onChange={(e) => setPreviewText(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1a3c34]/20"
                  placeholder="Nhập văn bản để thử giọng đọc…"
                />
              </div>

              <Button
                className="w-full rounded-full bg-[#1a3c34] font-semibold text-white shadow-md shadow-[#1a3c34]/20"
                onPress={() => void handlePreview()}
                isDisabled={playing || !previewText.trim()}
              >
                {playing ? (
                  <><span className="mr-2 inline-block size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />Đang phát…</>
                ) : (
                  <><Play className="mr-1.5 size-4" />Phát thử</>
                )}
              </Button>

              <div className="rounded-xl border border-black/8 bg-[#fafafa] px-4 py-3 text-xs text-foreground/55 space-y-1">
                <p><span className="font-semibold text-foreground/70">Giọng:</span> {selectedVoice?.label ?? config.voice} ({selectedVoice?.gender})</p>
                <p><span className="font-semibold text-foreground/70">Tốc độ:</span> {config.speed}×</p>
                <p><span className="font-semibold text-foreground/70">Return option:</span> {config.tts_return_option}</p>
                <p><span className="font-semibold text-foreground/70">Without filter:</span> {config.without_filter ? "Bật" : "Tắt"}</p>
              </div>
            </CardContent>
          </Card>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
            <p className="font-semibold">Đã đồng bộ với server</p>
            <p className="mt-1">
              Cấu hình lưu trên backend và tự động áp dụng cho tất cả thiết bị POS khi khởi động.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
