/*
 * Eureka Games — page-load audit harness.
 * Loads every standalone page and every arcade view, records console
 * errors, uncaught page errors, and failed network requests.
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';

const PAGES = [
  '/index.html',
  '/404.html',
  '/drug-lab.html',
  '/homeless-village.html',
  '/hearthvale.html',
  '/voxel-garden.html',
  '/agentic-os.html',
  '/ageofwar/index.html',
  '/tycoon/index.html',
  '/tycoon/play.html',
  '/tycoon/play.html?theme=beagle',
];

// Arcade views reachable from index.html's hash router.
const VIEWS = [
  'arcade', 'snake', 'tetris', 'breakout', 'asteroids', 'game2048',
  'minesweeper', 'connect4', 'word5', 'lightcycles', 'memorymatrix', 'pong', 'stacker', 'vectordefense', 'wordcascade', 'crateescape', 'maze', 'life', 'hof',
  'productivity', 'orgchart',
];

function attach(page, bucket) {
  page.on('console', m => {
    if (m.type() === 'error') bucket.push({ kind: 'console', text: m.text() });
  });
  page.on('pageerror', e => bucket.push({ kind: 'pageerror', text: String(e && e.stack || e) }));
  page.on('requestfailed', r => {
    const f = r.failure();
    bucket.push({ kind: 'requestfailed', text: `${r.url()} :: ${f && f.errorText}` });
  });
  page.on('response', r => {
    if (r.status() >= 400) bucket.push({ kind: 'http' + r.status(), text: r.url() });
  });
}

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader',
           '--enable-unsafe-swiftshader'],
  });

  const results = [];

  for (const path of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const bucket = [];
    attach(page, bucket);
    try {
      await page.goto(BASE + path, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(3500); // let rAF loops / init settle
    } catch (e) {
      bucket.push({ kind: 'navigation', text: String(e.message).split('\n')[0] });
    }
    results.push({ target: path, issues: bucket });
    await ctx.close();
  }

  // Arcade views: one context, walk the hash router.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(1200);
    for (const v of VIEWS) {
      const bucket = [];
      const onConsole = m => { if (m.type() === 'error') bucket.push({ kind: 'console', text: m.text() }); };
      const onErr = e => bucket.push({ kind: 'pageerror', text: String(e && e.stack || e) });
      page.on('console', onConsole);
      page.on('pageerror', onErr);
      try {
        await page.evaluate(v => { location.hash = '#' + v; }, v);
        await page.waitForTimeout(1400);
      } catch (e) {
        bucket.push({ kind: 'switch', text: String(e.message).split('\n')[0] });
      }
      page.off('console', onConsole);
      page.off('pageerror', onErr);
      results.push({ target: 'view:' + v, issues: bucket });
    }
    await ctx.close();
  }

  await browser.close();

  let total = 0;
  for (const r of results) {
    if (!r.issues.length) { console.log(`OK    ${r.target}`); continue; }
    total += r.issues.length;
    console.log(`FAIL  ${r.target}  (${r.issues.length})`);
    for (const i of r.issues) console.log(`        [${i.kind}] ${i.text.slice(0, 400)}`);
  }
  console.log(`\n=== ${total} issue(s) across ${results.length} targets ===`);
})();
