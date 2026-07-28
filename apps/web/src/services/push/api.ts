import { env } from "@/config/env";

export interface PushSubscribePayload {
    endpoint: string;
    p256dh: string;
    auth: string;
    deviceId: string;
    participantId?: string;
}

export async function subscribePush(payload: PushSubscribePayload) {
    const res = await fetch(`${env.API_URL}/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
    });
    if (!res.ok) throw new Error("subscribe_push_failed");
    return res.json();
}

export async function unsubscribePush(endpoint: string) {
    await fetch(`${env.API_URL}/push/subscribe`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
        credentials: "include",
    }).catch(() => { });
}