const KEY = "ujcha_device_id";

function randomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `d_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

/** deviceId ổn định theo trình duyệt — backend dùng cho session / fraud. */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id = randomId();
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return randomId();
  }
}
