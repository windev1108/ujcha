// components/chat/EmojiText.tsx
"use client";
import { Emoji, EmojiStyle } from "emoji-picker-react";
import createEmojiRegex from "emoji-regex";
import { useRef } from "react";

function toUnified(emoji: string): string {
    const cps = Array.from(emoji).map((ch) => ch.codePointAt(0)!.toString(16));
    return cps.join("-");
}

function EmojiImg({ emoji, size = 20 }: { emoji: string; size?: number }) {
    return (
        <Emoji
            unified={toUnified(emoji)}
            emojiStyle={EmojiStyle.FACEBOOK}
            size={size}
            // unified không khớp (do fe0f) → thư viện tự không render gì, fallback ký tự gốc
            fallback={() => <span>{emoji}</span> as any}
        />
    );
}

export function EmojiText({ text, className, emojiSize = 40 }: { text: string; className?: string, emojiSize?: number }) {
    const regex = createEmojiRegex();
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
        parts.push(<EmojiImg key={key++} emoji={match[0]} size={emojiSize} />);
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));

    return <span className={className}>{parts}</span>;
}

export function EmojiIcon({ emoji, size = 48 }: { emoji: string; size?: number }) {
    return <EmojiImg emoji={emoji} size={size} />;
}

export function EmojiSyncInput({
    inputRef,
    value,
    onChange,
    placeholder,
    disabled,
    maxLength,
}: {
    inputRef: React.RefObject<HTMLInputElement>;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    disabled?: boolean;
    maxLength?: number;
}) {
    const mirrorRef = useRef<HTMLDivElement>(null);

    const syncScroll = () => {
        if (inputRef.current && mirrorRef.current) {
            mirrorRef.current.scrollLeft = inputRef.current.scrollLeft;
        }
    };

    return (
        <div className="relative min-w-0 flex-1">
            {/* Lớp hiển thị thật — render emoji Facebook-style giống hệt EmojiText trong tin nhắn */}
            <div
                ref={mirrorRef}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre px-3.5 py-2 text-sm text-foreground"
            >
                {value ? <EmojiText text={value} emojiSize={18} /> : null}
            </div>
            {/* Input thật — chữ trong suốt, chỉ giữ lại caret để gõ/focus/paste như bình thường */}
            <input
                ref={inputRef}
                type="text"
                name="ujcha-chat-message"
                autoComplete="off"
                autoCorrect="off"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                value={value}
                onChange={(e) => {
                    onChange(e.target.value);
                    syncScroll();
                }}
                onScroll={syncScroll}
                onKeyUp={syncScroll}
                onClick={syncScroll}
                placeholder={placeholder}
                maxLength={maxLength}
                disabled={disabled}
                className="relative w-full min-w-0 bg-transparent px-3.5 py-2 text-sm text-transparent caret-foreground outline-none placeholder:text-foreground/40 disabled:opacity-60"
            />
        </div>
    );
}