(function () {
  'use strict';

  const SKIP = ['_ga', '_gid', '_fbp', '_fb', '_dd', '_hp2', '_gcl'];

  function countCookies() {
    return document.cookie.split(';').filter(c => {
      const name = c.trim().split('=')[0] ?? '';
      return !SKIP.some(p => name.startsWith(p));
    }).length;
  }

  function injectButton() {
    if (document.getElementById('__ujcha_grab_btn')) return;
    if (!document.body) return;

    const count = countCookies();
    const btn   = document.createElement('button');
    btn.id      = '__ujcha_grab_btn';
    btn.textContent = count > 0
      ? `✓ Đã bắt ${count} cookie — Xác nhận lấy session`
      : '✓ Xác nhận đã đăng nhập — Lấy session';

    btn.style.cssText = [
      'position:fixed', 'bottom:20px', 'right:20px', 'z-index:2147483647',
      'background:#00b14f', 'color:#fff', 'border:none',
      'padding:12px 20px', 'border-radius:12px',
      'font-size:14px', 'font-weight:700', 'cursor:pointer',
      'box-shadow:0 4px 12px rgba(0,0,0,0.3)',
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif',
      'transition:opacity .15s',
    ].join(';');

    // Refresh cookie count every second
    const ticker = setInterval(() => {
      if (!document.getElementById('__ujcha_grab_btn')) { clearInterval(ticker); return; }
      const n = countCookies();
      if (!btn.disabled) {
        btn.textContent = n > 0
          ? `✓ Đã bắt ${n} cookie — Xác nhận lấy session`
          : '✓ Xác nhận đã đăng nhập — Lấy session';
      }
    }, 1000);

    btn.onclick = function () {
      btn.textContent = 'Đang lấy…';
      btn.disabled    = true;
      btn.style.opacity = '0.7';
      clearInterval(ticker);

      const cookieStr = document.cookie;

      // Gửi về web-admin qua postMessage (window.opener = tab web-admin đã mở popup này)
      if (window.opener) {
        try {
          window.opener.postMessage({ type: 'grab-session', cookie: cookieStr }, '*');
          btn.textContent = '✓ Đã gửi! Đang đóng cửa sổ…';
          setTimeout(() => window.close(), 800);
          return;
        } catch (_) { /* opener bị xóa */ }
      }

      // Fallback: relay URL lưu trong window.name (được truyền từ web-admin)
      const relay = window.name;
      if (relay && relay.startsWith('http')) {
        fetch(relay, { method: 'POST', mode: 'no-cors', body: cookieStr })
          .then(() => {
            btn.textContent = '✓ Đã gửi session!';
            setTimeout(() => window.close(), 800);
          })
          .catch(() => {
            btn.textContent = '✗ Lỗi gửi — thử lại';
            btn.disabled    = false;
            btn.style.opacity = '1';
          });
        return;
      }

      btn.textContent = '✗ Không tìm thấy relay — thử lại';
      btn.disabled    = false;
      btn.style.opacity = '1';
    };

    document.body.appendChild(btn);
  }

  // Inject ngay khi trang load xong
  injectButton();

  // Re-inject khi SPA navigate (GrabFood là React SPA)
  const observer = new MutationObserver(() => injectButton());
  observer.observe(document.body, { childList: true, subtree: false });
})();
