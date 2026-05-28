const fs = require('fs');
const buf = fs.readFileSync('C:/Users/Admin/AppData/Local/Temp/analy_history.db');
const text = buf.toString('binary');

// Extract all URLs containing analy.dev
const lines = text.split('\x00').join(' ').split('\n');
const analySeen = new Set();
for (let i = 0; i < text.length - 5; i++) {
  if (text.slice(i, i+8) === 'https://') {
    let end = i;
    while (end < Math.min(i + 500, text.length) && text.charCodeAt(end) > 30) end++;
    const url = text.slice(i, end);
    if (url.includes('analy') || url.includes('shopee') || url.includes('grab') || url.includes('foody') || url.includes('deliverynow')) {
      if (!analySeen.has(url.slice(0, 200))) {
        analySeen.add(url.slice(0, 200));
        console.log('URL:', url.slice(0, 200));

        // Decode base64 params
        const urlParam = url.match(/[?&]url=([A-Za-z0-9+/=]+)/);
        const bodyParam = url.match(/[?&]body=([A-Za-z0-9+/=]+)/);
        if (urlParam) {
          try { console.log('  -> url:', Buffer.from(urlParam[1], 'base64').toString('utf8')); } catch {}
        }
        if (bodyParam) {
          try { console.log('  -> body:', Buffer.from(bodyParam[1], 'base64').toString('utf8').slice(0, 300)); } catch {}
        }
        console.log('---');
      }
    }
  }
}
