"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { subscribePush } from "@/services/push/api";
import { getDeviceId } from "@/hooks/useDeviceId";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function usePushSubscription(participantId?: string | null) {
    const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
    const [subscribing, setSubscribing] = useState(false);
    // Luôn giữ giá trị participantId MỚI NHẤT, không phụ thuộc closure cũ
    const participantIdRef = useRef(participantId);
    useEffect(() => { participantIdRef.current = participantId; }, [participantId]);

    useEffect(() => {
        if (typeof window === "undefined" || !("Notification" in window)) {
            setPermission("unsupported");
            return;
        }
        setPermission(Notification.permission);
    }, []);

    const subscribe = useCallback(async (overrideParticipantId?: string | null) => {
        if (!("serviceWorker" in navigator) || !("PushManager" in window) || !VAPID_PUBLIC_KEY) {
            return false;
        }
        setSubscribing(true);
        try {
            const reg = await navigator.serviceWorker.register("/sw.js");
            const perm = await Notification.requestPermission();
            setPermission(perm);
            if (perm !== "granted") return false;

            let sub = await reg.pushManager.getSubscription();
            if (!sub) {
                sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
                });
            }

            const json = sub.toJSON();
            const deviceId = await getDeviceId();
            // Ưu tiên tham số truyền trực tiếp > ref mới nhất > prop lúc hook khởi tạo
            const finalParticipantId = overrideParticipantId ?? participantIdRef.current ?? participantId;

            await subscribePush({
                endpoint: json.endpoint!,
                p256dh: json.keys!.p256dh,
                auth: json.keys!.auth,
                deviceId,
                participantId: finalParticipantId ?? undefined,
            });
            return true;
        } catch (err) {
            console.error("Push subscribe failed:", err);
            return false;
        } finally {
            setSubscribing(false);
        }
    }, [participantId]);

    return { permission, subscribing, subscribe };
}