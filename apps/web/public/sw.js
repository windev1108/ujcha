self.addEventListener("push", (event) => {
  let data = { title: "UjCha", body: "" };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch {
    // Payload không phải JSON hợp lệ (vd nút Test Push của DevTools) — dùng fallback text
    data = { title: "UjCha", body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "UjCha", {
      body: data.body || "",
      icon: "/favicon.png",
      badge: "/favicon-dot.png",
      data: data.url || "/",
      requireInteraction: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data));
});