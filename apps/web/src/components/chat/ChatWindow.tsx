"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import {
    MessageCircle,
    Send,
    Loader2,
    Lock,
    X,
    ChevronDown,
    Smile,
    Sticker as StickerIcon,
    ImagePlus,
    ImageOff,
    Plus,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@heroui/react";
import { EmojiStyle, type EmojiClickData } from "emoji-picker-react";
import { CHAT_STICKERS } from "@/constants/chat-stickers";
import { EmojiIcon, EmojiText } from "./EmojiText";
import { useTranslations } from "next-intl";
import Image from "next/image";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

const MAX_IMAGE_MB = 8;
const QUICK_EMOJI = "👍"; // đổi sang emoji bạn muốn dùng làm nút gửi nhanh mặc định
const LOGO_URL = "/logo-only.png";

export interface ChatWindowMessage {
    id: string;
    senderId: string;
    senderType: "customer" | "guest" | "staff";
    displayName: string;
    avatar: string | null;
    content: string;
    type?: "text" | "sticker" | "image";
    createdAt: string;
}

function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function isValidImageFile(file: File): boolean {
    return file.type.startsWith("image/") && file.size <= MAX_IMAGE_MB * 1024 * 1024;
}

function ChatImage({
    src,
    alt,
    className,
    fallbackClassName,
    onLoad,
}: {
    src: string;
    alt: string;
    className: string;
    fallbackClassName: string;
    onLoad?: () => void;
}) {
    const [errored, setErrored] = useState(false);
    const t = useTranslations();
    if (errored) {
        return (
            <div
                className={`flex flex-col items-center justify-center gap-1 rounded-xl bg-black/5 text-foreground/35 ${fallbackClassName}`}
            >
                <ImageOff className="size-5" />
                <span className="text-[10px] font-medium">{t("chat_image_load_error")}</span>
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            draggable={false}
            className={className}
            onError={() => setErrored(true)}
            onLoad={onLoad}
        />
    );
}

function ChatMessageImage({
    src,
    alt,
    onLoad,
    onClick,
}: {
    src: string;
    alt: string;
    onLoad?: () => void;
    onClick: () => void;
}) {
    const [errored, setErrored] = useState(false);

    if (errored) {
        return (
            <div className="flex h-[180px] w-[180px] flex-col items-center justify-center gap-1 rounded-2xl bg-black/5 text-foreground/35">
                <ImageOff className="size-5" />
                <span className="text-[10px] font-medium">{t("chat_image_load_error")}</span>
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={onClick}
            className="cursor-pointer my-1 block overflow-hidden rounded-md ring-1 ring-black/8 transition hover:opacity-90"
        >
            <Image
                src={src}
                alt={alt}
                width={400}
                height={400}
                sizes="220px"
                className="block h-auto max-h-[220px] min-h-[100px] w-auto max-w-[220px] min-w-[100px] object-contain"
                onError={() => setErrored(true)}
                onLoad={onLoad}
            />
        </button>
    );
}

const GROUP_WINDOW_MS = 60_000;
const NEAR_BOTTOM_PX = 120;
const LOAD_MORE_TRIGGER_PX = 80;

interface MessageGroup {
    senderId: string;
    mine: boolean;
    messages: ChatWindowMessage[];
}

function groupMessages(
    messages: ChatWindowMessage[],
    isMineFn: (m: ChatWindowMessage) => boolean,
): MessageGroup[] {
    const groups: MessageGroup[] = [];
    for (const m of messages) {
        const last = groups[groups.length - 1];
        const lastMsg = last?.messages[last.messages.length - 1];
        const withinWindow =
            !!lastMsg &&
            new Date(m.createdAt).getTime() - new Date(lastMsg.createdAt).getTime() <= GROUP_WINDOW_MS;
        if (last && last.senderId === m.senderId && withinWindow) {
            last.messages.push(m);
        } else {
            groups.push({ senderId: m.senderId, mine: isMineFn(m), messages: [m] });
        }
    }
    return groups;
}

export function ChatWindow({
    title = "Chat",
    eyebrow,
    messages,
    loading,
    loadError,
    hasMore = false,
    loadingMore = false,
    onLoadMore,
    closed,
    input,
    onInputChange,
    onSend,
    onSendSticker,
    onSendImage,
    onSendQuickEmoji,
    uploadingImage = false,
    sending,
    onClose,
    emptyLabel = "Chưa có tin nhắn nào",
    errorLabel = "Không tải được tin nhắn, thử lại sau",
    closedLabel = "Cuộc trò chuyện đã kết thúc",
    placeholder = "Nhập tin nhắn…",
    myId,
}: {
    title?: string;
    eyebrow?: string;
    messages: ChatWindowMessage[];
    loading: boolean;
    loadError?: boolean;
    hasMore?: boolean;
    loadingMore?: boolean;
    onLoadMore?: () => void;
    closed: boolean;
    input: string;
    onInputChange: (v: string) => void;
    onSend: () => void;
    onSendSticker: (url: string) => void;
    onSendImage: (file: File) => void;
    /** Gửi ngay 1 emoji, bỏ qua ô input — khuyến nghị truyền để tránh phụ thuộc timing của input state. */
    onSendQuickEmoji?: (emoji: string) => void;
    uploadingImage?: boolean;
    sending: boolean;
    onClose: () => void;
    emptyLabel?: string;
    errorLabel?: string;
    closedLabel?: string;
    placeholder?: string;
    myId?: string;
}) {
    const t = useTranslations()
    const listRef = useRef<HTMLDivElement>(null);
    const isInitialRef = useRef(true);
    const stickToBottomRef = useRef(true);
    const prevScrollHeightRef = useRef<number | null>(null);
    const prevMsgCountRef = useRef(0);
    const [showJumpToBottom, setShowJumpToBottom] = useState(false);
    const [previewSrc, setPreviewSrc] = useState<string | null>(null);

    useEffect(() => {
        if (!previewSrc) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setPreviewSrc(null);
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [previewSrc]);

    const inputRef = useRef<HTMLInputElement>(null);
    const prevSendingRef = useRef(sending);
    useEffect(() => {
        if (prevSendingRef.current && !sending && !closed) {
            inputRef.current?.focus();
        }
        prevSendingRef.current = sending;
    }, [sending, closed]);

    const [activePopover, setActivePopover] = useState<"emoji" | "sticker" | null>(null);
    const [plusMenuOpen, setPlusMenuOpen] = useState(false);
    const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
    const [plusMenuStyle, setPlusMenuStyle] = useState<React.CSSProperties>({});
    const emojiBtnRef = useRef<HTMLButtonElement>(null);
    const plusBtnRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const plusMenuRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const stickerBtnRef = useRef<HTMLButtonElement>(null);

    // ── Preview ảnh trước khi gửi (blob URL local) ──────────────────────
    const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(null);
    const pendingImageRef = useRef(pendingImage);
    useEffect(() => {
        pendingImageRef.current = pendingImage;
    }, [pendingImage]);
    useEffect(() => {
        return () => {
            if (pendingImageRef.current) URL.revokeObjectURL(pendingImageRef.current.previewUrl);
        };
    }, []);

    const setImage = (file: File) => {
        if (!isValidImageFile(file)) return;
        setPendingImage((prev) => {
            if (prev) URL.revokeObjectURL(prev.previewUrl);
            return { file, previewUrl: URL.createObjectURL(file) };
        });
    };

    const clearPendingImage = () => {
        setPendingImage((prev) => {
            if (prev) URL.revokeObjectURL(prev.previewUrl);
            return null;
        });
    };

    // ── Kéo-thả ảnh vào khung chat ───────────────────────────────────────
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const dragCounterRef = useRef(0);

    const handleDragEnter = (e: React.DragEvent) => {
        if (closed) return;
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        dragCounterRef.current += 1;
        setIsDraggingFile(true);
    };
    const handleDragOver = (e: React.DragEvent) => {
        if (closed) return;
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
    };
    const handleDragLeave = (e: React.DragEvent) => {
        if (closed) return;
        e.preventDefault();
        dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
        if (dragCounterRef.current === 0) setIsDraggingFile(false);
    };
    const handleDrop = (e: React.DragEvent) => {
        if (closed) return;
        e.preventDefault();
        dragCounterRef.current = 0;
        setIsDraggingFile(false);
        const file = e.dataTransfer.files?.[0];
        if (file) setImage(file);
    };

    // ── Paste ảnh từ clipboard ────────────────────────────────────────────
    useEffect(() => {
        if (closed) return;
        const handleWindowPaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of Array.from(items)) {
                if (item.type.startsWith("image/")) {
                    const file = item.getAsFile();
                    if (file && isValidImageFile(file)) {
                        e.preventDefault();
                        setImage(file);
                    }
                    break;
                }
            }
        };
        window.addEventListener("paste", handleWindowPaste);
        return () => window.removeEventListener("paste", handleWindowPaste);
    }, [closed]);

    // ── Đóng popover/menu khi click ra ngoài ─────────────────────────────
    useEffect(() => {
        if (!activePopover && !plusMenuOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (panelRef.current?.contains(target)) return;
            if (plusMenuRef.current?.contains(target)) return;
            if (emojiBtnRef.current?.contains(target)) return;
            if (plusBtnRef.current?.contains(target)) return;
            if (stickerBtnRef.current?.contains(target)) return;
            setActivePopover(null);
            setPlusMenuOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [activePopover, plusMenuOpen]);

    const computeAnchoredStyle = (btn: HTMLElement, popupWidth: number): React.CSSProperties => {
        const rect = btn.getBoundingClientRect();
        const maxLeft = Math.max(8, window.innerWidth - popupWidth - 8);
        const left = Math.min(Math.max(8, rect.right - popupWidth), maxLeft);
        return {
            position: "fixed",
            bottom: `${window.innerHeight - rect.top + 8}px`,
            left: `${left}px`,
            zIndex: 9999,
        };
    };

    const openPopover = (which: "emoji" | "sticker", anchor?: HTMLElement | null) => {
        const btn = anchor ?? (which === "emoji" ? emojiBtnRef.current : plusBtnRef.current);
        if (!btn) return;
        const width = which === "emoji" ? 300 : 260; // trùng width picker/sticker grid
        setPopoverStyle(computeAnchoredStyle(btn, width));
        setActivePopover((prev) => (prev === which ? null : which));
    };

    const togglePlusMenu = () => {
        const btn = plusBtnRef.current;
        if (!btn) return;
        setPlusMenuStyle(computeAnchoredStyle(btn, 192)); // khớp w-48 của dropdown
        setActivePopover(null);
        setPlusMenuOpen((prev) => !prev);
    };
    const handleEmojiClick = (emojiData: EmojiClickData) => {
        onInputChange(input + emojiData.emoji);
        inputRef.current?.focus();
    };

    const handleStickerClick = (url: string) => {
        setActivePopover(null);
        onSendSticker(url);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        setImage(file);
    };

    const hasContent = !!input.trim() || !!pendingImage;
    const hasText = input.trim().length > 0;


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (sending || uploadingImage) return;
        if (pendingImage) {
            const file = pendingImage.file;
            clearPendingImage();
            onSendImage(file);
        } else if (input.trim()) {
            onSend();
        } else {
            return;
        }
        inputRef.current?.focus();
    };

    const handleQuickEmoji = () => {
        if (sending || uploadingImage) return;
        if (onSendQuickEmoji) {
            onSendQuickEmoji(QUICK_EMOJI);
            return;
        }
        // Fallback nếu parent chưa truyền onSendQuickEmoji: set input rồi gửi ở tick kế tiếp.
        onInputChange(QUICK_EMOJI);
        setTimeout(() => onSend(), 0);
    };

    const isMine = (m: ChatWindowMessage) =>
        myId ? m.senderId === myId : m.senderType === "customer" || m.senderType === "guest";

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const groups = useMemo(() => groupMessages(messages, isMine), [messages, myId]);

    useEffect(() => {
        const el = listRef.current;
        if (!el) return;

        const grew = messages.length > prevMsgCountRef.current;
        prevMsgCountRef.current = messages.length;

        if (isInitialRef.current) {
            if (!loading && messages.length > 0) {
                el.scrollTop = el.scrollHeight;
                isInitialRef.current = false;
            }
            return;
        }

        if (prevScrollHeightRef.current != null) {
            const diff = el.scrollHeight - prevScrollHeightRef.current;
            el.scrollTop = el.scrollTop + diff;
            prevScrollHeightRef.current = null;
            return;
        }

        if (grew && stickToBottomRef.current) {
            el.scrollTop = el.scrollHeight;
        } else if (grew) {
            setShowJumpToBottom(true);
        }
    }, [messages, loading]);

    const handleScroll = () => {
        const el = listRef.current;
        if (!el) return;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        const atBottom = distanceFromBottom < NEAR_BOTTOM_PX;
        stickToBottomRef.current = atBottom;
        if (atBottom) setShowJumpToBottom(false);

        if (el.scrollTop < LOAD_MORE_TRIGGER_PX && hasMore && !loadingMore && onLoadMore) {
            prevScrollHeightRef.current = el.scrollHeight;
            onLoadMore();
        }
    };

    const scrollToBottom = () => {
        const el = listRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
        stickToBottomRef.current = true;
        setShowJumpToBottom(false);
    };
    const handleMediaLoad = () => {
        const el = listRef.current;
        if (!el || !stickToBottomRef.current) return;
        el.scrollTop = el.scrollHeight;
    };
    return (
        <div
            className="relative flex h-[580px] max-h-[70vh] flex-col"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className="flex items-center gap-2 border-b border-black/6 px-4 py-3">
                <MessageCircle className="size-4 text-[#1a3c34]" />
                <div className="min-w-0 flex-1">
                    {eyebrow && <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/40">{eyebrow}</p>}
                    <p className="truncate text-sm font-bold text-foreground">{title}</p>
                </div>
                <button onClick={onClose} aria-label="Đóng"
                    className="flex size-7 items-center justify-center rounded-full text-foreground/40 hover:bg-black/6">
                    <X className="size-4" />
                </button>
            </div>

            <div className="relative flex-1 min-h-0">
                <div
                    ref={listRef}
                    onScroll={handleScroll}
                    className="flex h-full flex-col gap-3 overflow-y-auto px-3 py-3"
                >
                    {loading ? (
                        <div className="flex flex-1 items-center justify-center"><Loader2 className="size-5 animate-spin text-foreground/20" /></div>
                    ) : messages.length === 0 ? (
                        loadError ? (
                            <div className="flex flex-1 items-center justify-center text-xs text-foreground/30">{errorLabel}</div>
                        ) : (
                            <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-foreground/30">
                                <MessageCircle className="size-6 opacity-40" /><p className="text-xs">{emptyLabel}</p>
                            </div>
                        )
                    ) : (
                        <>
                            {loadingMore && (
                                <div className="flex items-center justify-center py-1.5">
                                    <Loader2 className="size-4 animate-spin text-foreground/25" />
                                </div>
                            )}
                            {loadError && (
                                <p className="px-1 text-center text-[10px] font-medium text-amber-600">{errorLabel}</p>
                            )}
                            {groups.map((group) => {
                                const first = group.messages[0];
                                const lastIdx = group.messages.length - 1;
                                return (
                                    <div key={first.id} className="flex flex-col gap-1">
                                        <p className={`px-1 text-[10px] font-medium text-foreground/35 ${group.mine ? "text-right" : ""}`}>
                                            {group.mine ? t("chat_you") : first.displayName} · {fmtTime(first.createdAt)}
                                        </p>
                                        <div className="flex flex-col gap-2">
                                            {group.messages.map((m, idx) => {
                                                const isLastOfGroup = idx === lastIdx;
                                                const isSticker = m.type === "sticker";
                                                const isImage = m.type === "image";
                                                // Tin chỉ chứa 1 emoji ngắn (gửi nhanh) → hiển thị to như Messenger
                                                const isJumboEmoji =
                                                    !isSticker &&
                                                    !isImage &&
                                                    m.content.trim().length > 0 &&
                                                    [...m.content.trim()].length <= 3 &&
                                                    /^\p{Extended_Pictographic}+$/u.test(m.content.trim());
                                                return (
                                                    <div key={m.id} className={`flex items-end gap-2 ${group.mine ? "flex-row-reverse" : ""}`}>
                                                        {group.mine ? null : isLastOfGroup ? (
                                                            <Avatar size="sm" className="shrink-0 border bg-white">
                                                                {m.senderId === 'staff' ?
                                                                    <AvatarImage src={LOGO_URL} />
                                                                    :
                                                                    <>
                                                                        {m.avatar && <AvatarImage src={m.senderId === 'staff' ? LOGO_URL : m.avatar} />}

                                                                    </>
                                                                }
                                                                <AvatarFallback>{m.displayName?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
                                                            </Avatar>
                                                        ) : (
                                                            <div className="size-8 shrink-0" aria-hidden />
                                                        )}
                                                        {isSticker ? (
                                                            <ChatImage
                                                                src={m.content}
                                                                alt="sticker"
                                                                className="h-24 w-24 select-none object-contain"
                                                                fallbackClassName="h-24 w-24"
                                                                onLoad={handleMediaLoad}
                                                            />
                                                        ) : isImage ? (
                                                            <ChatMessageImage
                                                                src={m.content}
                                                                alt={'image'}
                                                                onLoad={handleMediaLoad}
                                                                onClick={() => setPreviewSrc(m.content)}
                                                            />
                                                        ) : isJumboEmoji ? (
                                                            <div className="text-5xl leading-none">
                                                                <EmojiText text={m.content} />
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className={`w-fit max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-base leading-snug ${group.mine ? "bg-[#1a3c34] text-white" : "bg-black/6 text-foreground"
                                                                    }`}
                                                            >
                                                                <EmojiText text={m.content} />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>

                {showJumpToBottom && (
                    <button
                        type="button"
                        onClick={scrollToBottom}
                        className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-[#1a3c34] px-3 py-1.5 text-xs font-semibold text-white shadow-lg transition hover:opacity-90"
                    >
                        <ChevronDown className="size-3.5" />
                        {t("chat_new_messages")}
                    </button>
                )}
            </div>

            <div className="border-t border-black/6 p-2.5">
                {closed ? (
                    <div className="flex items-center justify-center gap-1.5 rounded-xl bg-black/4 py-2.5 text-xs font-medium text-foreground/40">
                        <Lock className="size-3.5" />{closedLabel}
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
                        {pendingImage && (
                            <div className="flex items-center gap-2 rounded-xl bg-black/[0.03] px-2 py-1.5">
                                <div className="relative shrink-0">
                                    <img
                                        src={pendingImage.previewUrl}
                                        alt="Ảnh sắp gửi"
                                        className="size-14 rounded-lg object-cover ring-1 ring-black/10"
                                    />
                                    <button
                                        type="button"
                                        onClick={clearPendingImage}
                                        aria-label="Bỏ ảnh"
                                        className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
                                    >
                                        <X className="size-3" />
                                    </button>
                                </div>
                                <p className="text-xs text-foreground/40">{t("chat_pending_image_note")}</p>
                            </div>
                        )}

                        {isDraggingFile && (
                            <div className="pointer-events-none rounded-xl border-2 border-dashed border-[#1a3c34] bg-[#1a3c34]/5 px-3 py-2 text-center text-xs font-semibold text-[#1a3c34]">
                                {t("chat_drop_image_hint")}
                            </div>
                        )}

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileChange}
                        />

                        <div className="flex items-center gap-1.5">
                            {/* Sticker + Image ↔ "+" — morph theo việc input có text hay không */}
                            <div
                                className={`relative h-9 shrink-0 overflow-hidden transition-[width] duration-200 ease-out ${hasText ? "w-9" : "w-[76px]"
                                    }`}
                            >
                                <button
                                    type="button"
                                    ref={plusBtnRef}
                                    onClick={togglePlusMenu}
                                    className={`absolute left-0 top-0 flex size-9 items-center justify-center rounded-full transition-all duration-200 ${hasText ? "scale-100 opacity-100" : "pointer-events-none scale-75 opacity-0"
                                        } ${plusMenuOpen ? "bg-[#1a3c34]/10 text-[#1a3c34]" : "text-foreground/45 hover:bg-black/6"}`}
                                    aria-label="Thêm"
                                >
                                    <Plus className="size-5" />
                                </button>

                                <button
                                    type="button"
                                    ref={stickerBtnRef}
                                    onClick={() => openPopover("sticker")}
                                    disabled={CHAT_STICKERS.length === 0}
                                    className={`cursor-pointer absolute left-0 top-0 flex size-9 items-center justify-center rounded-full transition-all duration-200 disabled:opacity-30 ${hasText ? "pointer-events-none scale-75 opacity-0" : "scale-100 opacity-100"
                                        } ${activePopover === "sticker" ? "bg-[#1a3c34]/10 text-[#1a3c34]" : "text-foreground/45 hover:bg-black/6"}`}
                                    aria-label="Chọn nhãn dán"
                                >
                                    <StickerIcon className="size-[18px]" />
                                </button>

                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploadingImage}
                                    className={`cursor-pointer absolute left-10 top-0 flex size-9 items-center justify-center rounded-full text-foreground/45 transition-all duration-200 hover:bg-black/6 disabled:opacity-40 ${hasText ? "pointer-events-none scale-75 opacity-0" : "scale-100 opacity-100"
                                        }`}
                                    aria-label="Gửi ảnh"
                                >
                                    {uploadingImage ? <Loader2 className="size-[18px] animate-spin" /> : <ImagePlus className="size-[18px]" />}
                                </button>
                            </div>

                            {/* Pill input — giãn hết chỗ trống, emoji nằm trong pill */}
                            <div className="flex min-w-0 flex-1 items-center rounded-full border border-black/10 bg-black/[0.03] pr-1 focus-within:border-[#1a3c34] focus-within:ring-2 focus-within:ring-[#1a3c34]/10">
                                <input
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => onInputChange(e.target.value)}
                                    placeholder={placeholder}
                                    maxLength={2000}
                                    disabled={sending}
                                    className="min-w-0 flex-1 bg-transparent px-3.5 py-2 text-sm outline-none disabled:opacity-60"
                                />
                                <button
                                    type="button"
                                    ref={emojiBtnRef}
                                    onClick={() => openPopover("emoji")}
                                    className={`flex cursor-pointer size-7 shrink-0 items-center justify-center rounded-full transition-colors ${activePopover === "emoji" ? "text-[#1a3c34]" : "text-foreground/40 hover:text-foreground/60"}`}
                                    aria-label="Chọn emoji"
                                >
                                    <Smile className="size-[18px]" />
                                </button>
                            </div>

                            {/* Send hoặc Quick emoji */}
                            {hasContent ? (
                                <button
                                    type="submit"
                                    disabled={sending || uploadingImage}
                                    className="cursor-pointer flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1a3c34] text-white disabled:opacity-40"
                                >
                                    {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleQuickEmoji}
                                    disabled={sending || uploadingImage}
                                    className="cursor-pointer flex size-9 shrink-0 items-center justify-center rounded-full text-2xl leading-none transition-transform hover:scale-110 disabled:opacity-40"
                                    aria-label="Gửi nhanh biểu cảm"
                                >
                                    <EmojiIcon emoji={QUICK_EMOJI} size={30} />
                                </button>
                            )}
                        </div>
                    </form>
                )}
            </div>

            {/* Dropdown của nút + */}
            {plusMenuOpen && typeof document !== "undefined" && createPortal(
                <div
                    ref={plusMenuRef}
                    style={plusMenuStyle}
                    className="w-48 overflow-hidden rounded-2xl border border-black/8 bg-white py-1 shadow-2xl"
                >
                    <button
                        type="button"
                        onClick={() => {
                            setPlusMenuOpen(false);
                            openPopover("sticker", plusBtnRef.current);
                        }}
                        disabled={CHAT_STICKERS.length === 0}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-foreground hover:bg-black/5 disabled:opacity-40"
                    >
                        <StickerIcon className="size-4 text-foreground/50" />
                        {t("chat_choose_sticker")}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setPlusMenuOpen(false);
                            fileInputRef.current?.click();
                        }}
                        disabled={uploadingImage}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-foreground hover:bg-black/5 disabled:opacity-40"
                    >
                        <ImagePlus className="size-4 text-foreground/50" />
                        {t("chat_send_image")}
                    </button>
                </div>,
                document.body,
            )}

            {/* Popover emoji / sticker */}
            {activePopover && typeof document !== "undefined" && createPortal(
                <div ref={panelRef} style={popoverStyle} className="overflow-hidden rounded-2xl border border-black/8 bg-white shadow-2xl">
                    {activePopover === "emoji" ? (
                        <EmojiPicker
                            onEmojiClick={handleEmojiClick}
                            autoFocusSearch={false}
                            height={360}
                            width={300}
                            emojiStyle={EmojiStyle.FACEBOOK}
                        />
                    ) : (
                        <div className="grid w-[260px] grid-cols-4 gap-2 p-3">
                            {CHAT_STICKERS.map((s) => (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => handleStickerClick(s.url)}
                                    className="flex items-center justify-center rounded-xl p-1.5 transition hover:bg-black/6"
                                    title={s.alt}
                                >
                                    <img src={s.url} alt={s.alt} className="size-12 object-contain" draggable={false} />
                                </button>
                            ))}
                        </div>
                    )}
                </div>,
                document.body,
            )}

            {/* Modal xem ảnh phóng to */}
            {previewSrc && typeof document !== "undefined" && createPortal(
                <div
                    className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 p-4"
                    onClick={() => setPreviewSrc(null)}
                >
                    <button
                        type="button"
                        onClick={() => setPreviewSrc(null)}
                        className="absolute cursor-pointer right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                    >
                        <X className="size-5" />
                    </button>
                    <div
                        className="relative h-[85vh] w-[90vw] max-w-3xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Image
                            src={previewSrc}
                            alt={'preview'}
                            fill
                            sizes="90vw"
                            className="object-contain"
                        />
                    </div>
                </div>,
                document.body,
            )}

        </div>
    );
}