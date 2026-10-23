const { chromium } = require('playwright');
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

(async () => {
  const src = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  ok(!/await cache\.put\(url, res\)/.test(src), 'precache does not store the fetch response as-is');
  ok(!/const copy = res\.clone\(\)/.test(src), 'navigate does not clone the raw response into the cache');
  const fn = src.match(/function settledResponse\(res\) \{[\s\S]*?\n\}/);
  ok(!!fn, 'sw.js settles a redirected response before caching it');
  if (!fn) {
    console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
    process.exit(1);
  }

  const server = http.createServer((req, res) => {
    if (req.url === '/ageofwar/') {
      res.writeHead(308, { Location: '/ageofwar/index.html' });
      res.end();
      return;
    }
    if (req.url === '/ageofwar/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!doctype html><title>Age of War</title><p id="war">present</p>');
      return;
    }
    if (req.url === '/sw.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(fn[0] + `
self.addEventListener('install', (e) => e.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.mode !== 'navigate') return;
  if (new URL(req.url).pathname !== '/ageofwar/') return;
  event.respondWith((async () => {
    let res = await fetch(req);
    if (res.type === 'opaqueredirect' || !res.ok) {
      res = await fetch('/ageofwar/', { cache: 'reload', redirect: 'follow' });
    }
    const stored = settledResponse(res);
    const cache = await caches.open('swredirect');
    if (stored) await cache.put('/ageofwar/', stored.clone());
    const hit = await cache.match('/ageofwar/');
    if (!stored || (hit && hit.redirected)) {
      return new Response('cached redirected', { status: 500, headers: { 'Content-Type': 'text/plain' } });
    }
    return stored;
  })());
});
`);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><title>gate</title>');
  });
  const port = await listen(server);
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const errs = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 180)));
    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load' });
    await page.evaluate(() => navigator.serviceWorker.register('/sw.js'));
    await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 10000 });
    const landed = await page.goto('http://127.0.0.1:' + port + '/ageofwar/', { waitUntil: 'load', timeout: 10000 });
    const text = await page.locator('#war').innerText();
    const hit = await page.evaluate(async () => {
      const cached = await caches.open('swredirect').then((c) => c.match('/ageofwar/'));
      return { redirected: cached ? cached.redirected : null, status: cached ? cached.status : 0 };
    });
    ok(landed && landed.status() === 200 && text === 'present', 'a redirected /ageofwar/ still opens (' + (landed && landed.status()) + ')');
    ok(hit.redirected === false && hit.status === 200, 'the cached navigate response is not a redirect (' + hit.redirected + ')');
    ok(errs.length === 0, 'no page errors' + (errs[0] ? ' — ' + errs[0] : ''));
  } finally {
    await browser.close();
    server.close();
  }
  console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
