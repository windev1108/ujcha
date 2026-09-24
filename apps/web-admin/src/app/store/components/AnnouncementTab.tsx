"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { AlertTriangle, Info, Megaphone, Save, Sparkles } from "lucide-react";
import { Button, Input, Label, Switch, TextArea } from "@heroui/react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import { adminFieldStack, adminLabelClass } from "@/lib/admin-form-classes";
import { AnnouncementFrequency, AnnouncementType, fetchAnnouncementConfig, updateAnnouncementConfig } from "@/services/admin/store-api";

function axiosMsg(e: unknown) {
    const err = e as AxiosError<{ message?: string | string[] }>;
    const m = err.response?.data?.message;
    if (typeof m === "string") return m;
    if (Array.isArray(m)) return m.join(", ");
    return (err as Error).message || "Có lỗi xảy ra.";
}

const ADMIN_KEY = ["admin", "store", "announcement"];

const TYPE_OPTIONS: {
    id: AnnouncementType;
    label: string;
    desc: string;
    icon: typeof Info;
    activeCls: string;
}[] = [
        { id: "info", label: "Thông tin", desc: "Ghi chú, hướng dẫn chung.", icon: Info, activeCls: "border-sky-400 bg-sky-50 text-sky-700" },
        { id: "feature", label: "Tính năng mới", desc: "Giới thiệu tính năng, ưu đãi.", icon: Sparkles, activeCls: "border-emerald-400 bg-emerald-50 text-emerald-700" },
        { id: "warning", label: "Lưu ý quan trọng", desc: "Thay đổi khách cần biết.", icon: AlertTriangle, activeCls: "border-amber-400 bg-amber-50 text-amber-700" },
    ];

const FREQUENCY_OPTIONS: { id: AnnouncementFrequency; label: string; desc: string }[] = [
    { id: "session", label: "Mỗi phiên truy cập", desc: "Hiện lại khi khách đóng tab rồi mở web lại." },
    { id: "once", label: "Chỉ một lần", desc: "Mỗi khách chỉ thấy 1 lần, đến khi bạn sửa nội dung." },
];

function toLocalInput(iso: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fromLocalInput(v: string) {
    return v ? new Date(v).toISOString() : null;
}

export function AnnouncementTab() {
    const qc = useQueryClient();
    const { showAlert } = useAppDialog();

    const { data, isLoading } = useQuery({ queryKey: ADMIN_KEY, queryFn: fetchAnnouncementConfig });

    const [isActive, setIsActive] = useState(false);
    const [type, setType] = useState<AnnouncementType>("info");
    const [frequency, setFrequency] = useState<AnnouncementFrequency>("session");
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [ctaLabel, setCtaLabel] = useState("");
    const [ctaUrl, setCtaUrl] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [startsAt, setStartsAt] = useState("");
    const [endsAt, setEndsAt] = useState("");

    useEffect(() => {
        if (!data) return;
        setIsActive(data.isActive);
        setType(data.type);
        setFrequency(data.frequency);
        setTitle(data.title);
        setContent(data.content);
        setCtaLabel(data.ctaLabel ?? "");
        setCtaUrl(data.ctaUrl ?? "");
        setImageUrl(data.imageUrl ?? "");
        setStartsAt(toLocalInput(data.startsAt));
        setEndsAt(toLocalInput(data.endsAt));
    }, [data]);

    const saveMut = useMutation({
        mutationFn: () =>
            updateAnnouncementConfig({
                isActive,
                type,
                frequency,
                title: title.trim(),
                content: content.trim(),
                ctaLabel: ctaLabel.trim() || null,
                ctaUrl: ctaUrl.trim() || null,
                imageUrl: imageUrl.trim() || null,
                startsAt: fromLocalInput(startsAt),
                endsAt: fromLocalInput(endsAt),
            }),
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: ADMIN_KEY });
            await qc.invalidateQueries({ queryKey: ["store", "announcement"] }); // đồng bộ popup phía user
        },
        onError: (e) => void showAlert(axiosMsg(e), "Lỗi"),
    });

    function handleSave() {
        if (isActive && !title.trim() && !content.trim()) {
            void showAlert("Vui lòng nhập tiêu đề hoặc nội dung thông báo.", "Lỗi");
            return;
        }
        if (!!ctaLabel.trim() !== !!ctaUrl.trim()) {
            void showAlert("Nút hành động cần có cả nhãn và đường dẫn.", "Lỗi");
            return;
        }
        saveMut.mutate();
    }

    return (
        <div className="space-y-6 rounded-2xl border border-black/6 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#1a3c34]/8">
                    <Megaphone className="size-5 text-[#1a3c34]" />
                </span>
                <div>
                    <p className="font-semibold text-foreground">Thông báo toàn site</p>
                    <p className="text-xs text-foreground/55">
                        Popup hiển thị khi khách vào web — dùng để giới thiệu tính năng mới hoặc ghi chú.
                    </p>
                </div>
            </div>

            {isLoading ? (
                <div className="py-8 text-center text-sm text-foreground/40">Đang tải…</div>
            ) : (
                <div className="space-y-6">
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 px-4 py-3">
                        <div>
                            <p className="text-sm font-semibold text-foreground">Bật thông báo</p>
                            <p className="text-xs text-foreground/55">Tắt để ẩn popup mà vẫn giữ nội dung đã soạn.</p>
                        </div>
                        <Switch isSelected={isActive} onChange={setIsActive}>
                            <Switch.Content>
                                <Switch.Control>
                                    <Switch.Thumb />
                                </Switch.Control>
                            </Switch.Content>
                        </Switch>
                    </div>

                    <div className={adminFieldStack}>
                        <Label className={adminLabelClass}>Loại thông báo</Label>
                        <div className="grid gap-2 sm:grid-cols-3">
                            {TYPE_OPTIONS.map(({ id, label, desc, icon: Icon, activeCls }) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setType(id)}
                                    className={`flex flex-col items-start gap-1.5 rounded-2xl border-2 px-4 py-3 text-left transition-colors ${type === id ? activeCls : "border-black/10 bg-white text-foreground/60 hover:bg-black/4"
                                        }`}
                                >
                                    <Icon className="size-4" />
                                    <span className="text-sm font-semibold">{label}</span>
                                    <span className="text-xs opacity-70">{desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={adminFieldStack}>
                        <Label className={adminLabelClass}>Tiêu đề</Label>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={120}
                            placeholder="VD: Ra mắt tính năng Đặt đơn nhóm"
                        />
                    </div>

                    <div className={adminFieldStack}>
                        <Label className={adminLabelClass}>Nội dung</Label>
                        <TextArea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            maxLength={1000}
                            rows={4}
                            placeholder="Hỗ trợ xuống dòng. Tối đa 1000 ký tự."
                        />
                    </div>

                    <div className={adminFieldStack}>
                        <Label className={adminLabelClass}>Ảnh minh hoạ (tuỳ chọn)</Label>
                        <Input
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            maxLength={500}
                            placeholder="https://... (tỉ lệ 16:9 hiển thị đẹp nhất)"
                        />
                        {imageUrl.trim() && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={imageUrl.trim()}
                                alt=""
                                className="mt-1 aspect-[16/9] w-full max-w-xs rounded-xl object-cover ring-1 ring-black/8"
                            />
                        )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className={adminFieldStack}>
                            <Label className={adminLabelClass}>Nhãn nút hành động (tuỳ chọn)</Label>
                            <Input
                                value={ctaLabel}
                                onChange={(e) => setCtaLabel(e.target.value)}
                                maxLength={60}
                                placeholder="VD: Xem ngay"
                            />
                        </div>
                        <div className={adminFieldStack}>
                            <Label className={adminLabelClass}>Đường dẫn</Label>
                            <Input
                                value={ctaUrl}
                                onChange={(e) => setCtaUrl(e.target.value)}
                                maxLength={500}
                                placeholder="/menu hoặc https://..."
                            />
                        </div>
                    </div>

                    <div className={adminFieldStack}>
                        <Label className={adminLabelClass}>Tần suất hiển thị</Label>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {FREQUENCY_OPTIONS.map(({ id, label, desc }) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setFrequency(id)}
                                    className={`flex flex-col items-start gap-1 rounded-2xl border-2 px-4 py-3 text-left transition-colors ${frequency === id
                                        ? "border-[#1a3c34] bg-[#1a3c34]/5 text-[#1a3c34]"
                                        : "border-black/10 bg-white text-foreground/60 hover:bg-black/4"
                                        }`}
                                >
                                    <span className="text-sm font-semibold">{label}</span>
                                    <span className="text-xs opacity-70">{desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className={adminFieldStack}>
                            <Label className={adminLabelClass}>Bắt đầu hiển thị (tuỳ chọn)</Label>
                            <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                        </div>
                        <div className={adminFieldStack}>
                            <Label className={adminLabelClass}>Kết thúc hiển thị (tuỳ chọn)</Label>
                            <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                        </div>
                    </div>
                    <p className="-mt-3 text-xs text-foreground/45">
                        Để trống = hiển thị ngay và không giới hạn thời gian. Giờ theo múi giờ trình duyệt của bạn.
                    </p>

                    <Button
                        className="rounded-xl bg-[#1a3c34] font-semibold text-white"
                        onPress={handleSave}
                        isDisabled={saveMut.isPending}
                    >
                        <Save className="mr-2 size-4" />
                        Lưu thông báo
                    </Button>
                </div>
            )}
        </div>
    );
}