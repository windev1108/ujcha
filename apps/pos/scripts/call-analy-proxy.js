const https = require('https');

const TOKEN = 'eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjb25ndW5nLnRhcGhvYUBnbWFpbC5jb20iLCJpc3MiOiJhcHAiLCJpYXQiOjE3Nzc3MzEyOTAsImV4cCI6MTA0MTc3MzEyOTB9.smmTL2nA9oFlQqhpzy-ZcfuBBVywWS8x5jYgwheaXzl0H-a66KbJifW5Ivu8vX-24nFEt-K1gbdyyBlQXnvc4g';

// From the browser history, Analy calls gmerchant.deliverynow.vn via internal proxy
// Try the proxy with Analy JWT
const grabBody = Buffer.from(JSON.stringify({
  order_filter_type: 10,
  next_item_id: '',
  request_count: 5,
  sort_type: 5,
})).toString('base64');

const grabUrl = Buffer.from('https://gmerchant.deliverynow.vn/api/v5/order/get_list').toString('base64');
const proxyUrl = `/?url=${grabUrl}&body=${grabBody}`;

function req(host, path, method, headers, body) {
  return new Promise((resolve) => {
    const opts = {
      hostname: host,
      path,
      method: method || 'GET',
      headers: { ...headers },
      rejectUnauthorized: false,
    };
    const r = https.request(opts, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    r.on('error', e => resolve({ status: 0, body: e.message }));
    if (body) r.write(body);
    r.end();
  });
}

async function main() {
  console.log('=== Test 1: GrabFood orders via Analy proxy (GET) ===');
  const r1 = await req('internal-service-ais-cl.analy.dev', proxyUrl, 'GET', {
    'Authorization': `Bearer ${TOKEN}`,
    'Accept': 'application/json',
  });
  console.log('Status:', r1.status);
  console.log('Body:', r1.body.slice(0, 500));

  console.log('\n=== Test 2: GrabFood orders via Analy proxy (POST) ===');
  const r2 = await req('internal-service-ais-cl.analy.dev', proxyUrl, 'POST', {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }, JSON.stringify({ order_filter_type: 10, next_item_id: '', request_count: 5, sort_type: 5 }));
  console.log('Status:', r2.status);
  console.log('Body:', r2.body.slice(0, 500));

  console.log('\n=== Test 3: GrabFood merchant info ===');
  const grabInfoUrl = Buffer.from('https://gmerchant.deliverynow.vn/api/v4/restaurant/get_merchant_info').toString('base64');
  const r3 = await req('internal-service-ais-cl.analy.dev', `/?url=${grabInfoUrl}`, 'GET', {
    'Authorization': `Bearer ${TOKEN}`,
    'Accept': 'application/json',
  });
  console.log('Status:', r3.status);
  console.log('Body:', r3.body.slice(0, 500));

  // Also try ShopeeFood via proxy
  console.log('\n=== Test 4: ShopeeFood merchant via Analy proxy ===');
  const spfUrl = Buffer.from('https://merchant.shopeefood.vn/api/v1/restaurant/detail').toString('base64');
  const r4 = await req('internal-service-ais-cl.analy.dev', `/?url=${spfUrl}`, 'GET', {
    'Authorization': `Bearer ${TOKEN}`,
    'Accept': 'application/json',
  });
  console.log('Status:', r4.status);
  console.log('Body:', r4.body.slice(0, 500));
}

main().catch(console.error);
