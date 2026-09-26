"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MessageCircle, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useChatSocket } from "@/hooks/useChatSocket";
import type { ChatMessage, FetchMessagesOpts, ChatMessagePage, ChatMessageType } from "@/services/chat/api";
import { uploadChatImage } from "@/services/chat/api";
import { ChatWindow } from "./ChatWindow";
import { toast } from "sonner";
import { useNotificationStore } from "@/store/notification-store";

const PAGE_SIZE = 25;
const MAX_IMAGE_MB = 8;
const NEW_MESSAGE_SOUND_SRC = "/mp3/new-message.mp3";
const NEW_MESSAGE_SOUND_VOLUME = 0.05;

interface ChatBubbleProps {
  kind: "order" | "group";
  roomId: string | null;
  enabled: boolean;
  hostName?: string;
  fetchMessages: (opts: FetchMessagesOpts) => Promise<ChatMessagePage>;
  sendMessage: (content: string, type?: ChatMessageType) => Promise<ChatMessage>;
  myId?: string;
  className?: string;
}

const SELF_SENDER_TYPES: ChatMessage["senderType"][] = ["customer", "guest"];

function isMine(msg: ChatMessage, myId?: string) {
  if (myId) return msg.senderId === myId;
  return SELF_SENDER_TYPES.includes(msg.senderType);
}

function sortAsc(list: ChatMessage[]) {
  return [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function ChatBubble({ kind, hostName, roomId, enabled, fetchMessages, sendMessage, myId, className }: ChatBubbleProps) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
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

  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const hasMoreRef = useRef(false);
  hasMoreRef.current = hasMore;
  const loadingMoreRef = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    audioRef.current = new Audio(NEW_MESSAGE_SOUND_SRC);
    audioRef.current.volume = NEW_MESSAGE_SOUND_VOLUME;
  }, []);

  const loadInitial = useCallback(async () => {
    if (!enabled || !roomId) return;
    setInitialLoading(true);
    setLoadError(false);
    try {
      const res = await fetchMessages({ limit: PAGE_SIZE });
      setMessages(sortAsc(res.messages));
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
      const fresh = res.messages.filter(
        (m) => !messagesRef.current.some((existing) => existing.id === m.id)
      );
      if (fresh.length > 0) setMessages((prev) => [...sortAsc(fresh), ...prev]);
      setHasMore(res.hasMore);
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
      const fresh = res.messages.filter(
        (m) => !messagesRef.current.some((existing) => existing.id === m.id)
      );
      if (fresh.length === 0) return;
      setMessages((prev) => sortAsc([...prev, ...fresh]));
    } catch {
      // sẽ retry ở lần onSynced kế tiếp
    }
  }, [enabled, roomId, fetchMessages]);

  useChatSocket({
    kind,
    id: enabled ? roomId : null,
    enabled: enabled && !!roomId,
    onMessage: (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (!isMine(msg, myId)) {
        audioRef.current?.play().catch(() => { });
        if (!openRef.current) {
          setUnreadCount((c) => c + 1);
        }
        // Badge trên tab trình duyệt — chỉ khi user không nhìn vào tab này
        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
          const senderName = kind === "group" ? hostName ?? msg.displayName : msg.displayName;
          useNotificationStore
            .getState()
            .addBgNotif(t("chat_bg_new_message", { name: senderName ?? "" }));
        }
      }
    },
    onRoomClosed: () => setClosed(true),
    onSynced: () => void syncLatest(),
  });

  const toggleOpen = useCallback(() => {
    setOpen((v) => {
      const next = !v;
      if (next) setUnreadCount(0);
      return next;
    });
  }, []);

  const appendMessage = (msg: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
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
      const msg = await sendMessage(url, "image");
      appendMessage(msg);
      void syncLatest();
    } catch (err) {
      console.error("[chat] upload image failed:", err);
      toast.error(t("chat_send_image_failed"));
    } finally {
      setUploadingImage(false);
    }
  };

  if (!enabled) return null;

  return (
    <div className={`fixed bottom-5 right-5 z-[20] flex flex-col items-end gap-3 ${className ?? ""}`}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: "spring", damping: 26, stiffness: 340 }}
            className="w-[min(92vw,500px)] overflow-hidden rounded-3xl border border-black/6 bg-white shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)]"
          >
            <ChatWindow
              key={roomId ?? "none"}
              title={kind === 'group' ? t("chat_group_order_title", { host: hostName ?? 'Guest' }) : t("chat_title")}
              eyebrow={kind === 'group' ? t("chat_group_order_eyebrow") : t("chat_eyebrow")}
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
              myId={myId}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={toggleOpen}
        aria-label={t("chat_bubble_aria_label")}
        className="relative flex size-14 items-center justify-center rounded-full bg-[#1a3c34] text-white shadow-[0_8px_24px_-6px_rgba(26,60,52,0.5)] transition hover:opacity-90"
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
      </button>
    </div>
  );
}