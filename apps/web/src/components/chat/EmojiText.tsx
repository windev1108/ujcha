// components/chat/EmojiText.tsx
"use client";
import { Emoji, EmojiStyle } from "emoji-picker-react";
import createEmojiRegex from "emoji-regex";

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