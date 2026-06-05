export async function startGrabWebLogin(): Promise<{ sessionId: string }> {
  const res = await fetch("/api/grab/weblogin", { method: "POST" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<{ sessionId: string }>;
}

export async function pollGrabWebLogin(sessionId: string): Promise<{
  status: "pending" | "done" | "error";
  cookie?: string;
  merchantId?: string;
  merchantGroupId?: string;
  error?: string;
}> {
  const res = await fetch(`/api/grab/weblogin?sessionId=${encodeURIComponent(sessionId)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<{
    status: "pending" | "done" | "error";
    cookie?: string;
    merchantId?: string;
    merchantGroupId?: string;
    error?: string;
  }>;
}

export async function fetchGrabMenu(
  authCookie: string,
  merchantId?: string,
  merchantGroupId?: string,
): Promise<unknown> {
  const res = await fetch("/api/grab/menu", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authCookie, merchantId, merchantGroupId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}
