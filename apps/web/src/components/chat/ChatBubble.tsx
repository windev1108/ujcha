"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MessageCircle, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useChatSocket } from "@/hooks/useChatSocket";
import type { ChatMessage, FetchMessagesOpts, ChatMessagePage, ChatMessageType } from "@/services/chat/api";
import { fetchChatStickers, uploadChatImage } from "@/services/chat/api";
import { ChatWindow } from "./ChatWindow";
import { toast } from "sonner";
import { useNotificationStore } from "@/store/notification-store";
import { useQuery } from "@tanstack/react-query";
import { mergeMessages } from "@/lib/chat-messages";

const PAGE_SIZE = 25;
const MAX_IMAGE_MB = 10;
const NEW_MESSAGE_SOUND_SRC = "/mp3/new-message.mp3";
const NEW_MESSAGE_SOUND_VOLUME = 0.1;

interface ChatBubbleProps {
  kind: "order" | "group";
  roomId: string | null;
  enabled: boolean;
  hostName?: string;
  fetchMessages: (opts: FetchMessagesOpts) => Promise<ChatMessagePage>;
  sendMessage: (content: string, type?: ChatMessageType) => Promise<ChatMessage>;
  myId?: string;
  className?: string;
  open?: boolean;
  stackIndex?: number;
  label?: string;
  onViewOrder?: () => void;
  onOpenChange?: (open: boolean) => void;
  onIncoming?: (msg: ChatMessage) => void;
}

const SELF_SENDER_TYPES: ChatMessage["senderType"][] = ["customer", "guest"];

function isMine(msg: ChatMessage, myId?: string) {
  if (myId) return msg.senderId === myId;
  return SELF_SENDER_TYPES.includes(msg.senderType);
}

export function ChatBubble({ onViewOrder, label, stackIndex, kind, hostName, roomId, enabled, fetchMessages, sendMessage, myId, className, open: controlledOpen, onOpenChange, onIncoming }: ChatBubbleProps) {
  const t = useTranslations();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [closed, setClosed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [innerOpen, setInnerOpen] = useState(false);
  const stacked = stackIndex !== undefined;
  const { data: stickers = [] } = useQuery({
    queryKey: ["chat-stickers"],
    queryFn: fetchChatStickers,
    staleTime: 5 * 60 * 1000, // sticker ít đổi, cache 5 phút
  });

  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const hasMoreRef = useRef(false);
  hasMoreRef.current = hasMore;
  const loadingMoreRef = useRef(false);
  const seenIdsRef = useRef(new Set<string>())
  const open = controlledOpen ?? innerOpen;
  const setOpen = useCallback((v: boolean) => {
    setInnerOpen(v);
    onOpenChange?.(v);
  }, [onOpenChange]);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => { if (open) setUnreadCount(0); }, [open]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (kind === 'group') return
    audioRef.current = new Audio(NEW_MESSAGE_SOUND_SRC);
    audioRef.current.volume = NEW_MESSAGE_SOUND_VOLUME;
  }, [kind]);

  const loadInitial = useCallback(async () => {
    if (!enabled || !roomId) return;
    setInitialLoading(true);
    setLoadError(false);
    try {
      const res = await fetchMessages({ limit: PAGE_SIZE });
      setMessages((prev) => mergeMessages(prev, res.messages))
      setHasMore(res.hasMore);
    } catch {
      setLoadError(true);
    } finally {
      setInitialLoading(false);
    }
  }, [enabled, roomId, fetchMessages]);

  useEffect(() => {
    void loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, roomId]);

  const loadMore = useCallback(async () => {
    if (!enabled || !roomId || loadingMoreRef.current || !hasMoreRef.current) return;
    const oldest = messagesRef.current[0];
    if (!oldest) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const res = await fetchMessages({ limit: PAGE_SIZE, beforeId: oldest.id });
      setMessages((prev) => mergeMessages(prev, res.messages))
      setHasMore(res.hasMore)
    } catch {
      // im lặng — user scroll lại là retry được
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [enabled, roomId, fetchMessages]);

  const syncLatest = useCallback(async () => {
    if (!enabled || !roomId) return;
    try {
      const res = await fetchMessages({ limit: PAGE_SIZE });
      setMessages((prev) => mergeMessages(prev, res.messages))
    } catch {
      // sẽ retry ở lần onSynced kế tiếp
    }
  }, [enabled, roomId, fetchMessages]);

  useChatSocket({
    kind,
    id: enabled ? roomId : null,
    enabled: enabled && !!roomId,
    onMessage: (msg) => {
      if (seenIdsRef.current.has(msg.id)) return
      seenIdsRef.current.add(msg.id)
      setMessages((prev) => mergeMessages(prev, [msg]))

      if (isMine(msg, myId)) return

      if (kind !== 'group') {
        audioRef.current?.play().catch(() => { })
      }

      if (!openRef.current) {
        setUnreadCount((c) => c + 1)
        onIncoming?.(msg)
      }

      // Badge trên tab trình duyệt — chỉ khi user không nhìn vào tab này
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        const notiMessage = kind === "group"
          ? t("chat_group_new_message", { name: hostName ?? "" })
          : t("chat_bg_new_message", { name: msg.displayName ?? "" })
        useNotificationStore.getState().addBgNotif(notiMessage)
      }
    },
    onRoomClosed: () => setClosed(true),
    onSynced: () => void syncLatest(),
  });

  const toggleOpen = useCallback(() => {
    const next = !openRef.current;
    setOpen(next);
    if (next) setUnreadCount(0);
  }, [setOpen]);

  const appendMessage = (msg: ChatMessage) => {
    setMessages((prev) => mergeMessages(prev, [msg]))
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending || closed) return;
    setSending(true);
    setInput("");
    try {
      const msg = await sendMessage(content, "text");
      appendMessage(msg);
      void syncLatest();
    } catch (err) {
      console.error("[chat] send failed:", err);
      setInput(content);
      toast.error(t("chat_send_failed"));
      void syncLatest();
    } finally {
      setSending(false);
    }
  };

  const handleSendSticker = async (url: string) => {
    if (sending || closed) return;
    setSending(true);
    try {
      const msg = await sendMessage(url, "sticker");
      appendMessage(msg);
      void syncLatest();
    } catch (err) {
      console.error("[chat] send sticker failed:", err);
      toast.error(t("chat_send_sticker_failed"));
    } finally {
      setSending(false);
    }
  };

  const handleSendImage = async (file: File) => {
    if (closed || uploadingImage) return;
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      toast.error(t("chat_image_too_large", { maxMb: MAX_IMAGE_MB }));
      return;
    }
    setUploadingImage(true);
    try {
      const url = await uploadChatImage(file);
      if (url) {
        const msg = await sendMessage(url!, "image");
        appendMessage(msg);
        void syncLatest();
      }
    } catch (err) {
      console.error("[chat] upload image failed:", err);
      toast.error(t("chat_send_image_failed"));
    } finally {
      setUploadingImage(false);
    }
  };

  if (!enabled) return null;

  return (
    <div className={stacked ? undefined : `fixed bottom-5 right-5 z-[50] flex flex-col items-end gap-3 ${className ?? ""}`}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: "spring", damping: 26, stiffness: 340 }}
            className={`overflow-hidden rounded-3xl border border-black/6 bg-white shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)] ${stacked
              ? "fixed bottom-5 right-[84px] z-[21] w-[min(calc(100vw-100px),500px)]"
              : "w-[min(92vw,500px)]"
              }`}
          >
            <ChatWindow
              key={roomId ?? "none"}
              stickers={stickers}
              title={kind === 'group' ? t("chat_group_order_title", { host: hostName ?? 'Guest' }) : t("chat_title")}
              eyebrow={
                label ? `#${label}`
                  : kind === "group" ? t("chat_group_order_eyebrow") : t("chat_eyebrow")
              }
              messages={messages}
              loading={initialLoading}
              loadError={loadError}
              hasMore={hasMore}
              loadingMore={loadingMore}
              onLoadMore={loadMore}
              closed={closed}
              input={input}
              onInputChange={setInput}
              onSend={() => void handleSend()}
              onSendSticker={(url) => void handleSendSticker(url)}
              onSendImage={(file) => void handleSendImage(file)}
              uploadingImage={uploadingImage}
              sending={sending}
              onClose={() => setOpen(false)}
              emptyLabel={t("chat_empty_state")}
              errorLabel={t("chat_load_error")}
              closedLabel={t("chat_closed_notice")}
              placeholder={t("chat_placeholder")}
              onViewOrder={onViewOrder}
              viewOrderLabel={t("chat_view_order")}
              myId={myId}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={toggleOpen}
        aria-label={label ? `${t("chat_bubble_aria_label")} #${label}` : t("chat_bubble_aria_label")}
        style={
          stacked
            ? { position: "fixed", right: 20, bottom: 20 + stackIndex! * 76, zIndex: 50 }
            : undefined
        }
        className="relative cursor-pointer flex size-14 items-center justify-center rounded-full bg-[#1a3c34] text-white shadow-[0_8px_24px_-6px_rgba(26,60,52,0.5)] transition hover:opacity-90"
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span key="x" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}>
              <X className="size-6" />
            </motion.span>
          ) : (
            <motion.span key="icon" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}>
              <MessageCircle className="size-6" />
            </motion.span>
          )}
        </AnimatePresence>

        {!open && unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute -right-1 -top-1 flex min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold leading-5 text-white ring-2 ring-white"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        )}

        {/* {stacked && label && (
          <span className="absolute -bottom-4 left-1/2 max-w-[100px] -translate-x-1/2 truncate rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-[#1a3c34] shadow ring-1 ring-black/10">
            #{label}
          </span>
        )} */}
      </button>
    </div>
  );
}