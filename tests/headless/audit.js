/*
 * Eureka Games — page-load audit harness.
 * Loads every standalone page and every arcade view, records console
 * errors, uncaught page errors, and failed network requests.
 *
 * QA-24 — why this file now CLASSIFIES instead of just counting.
 *
 * For many rounds this harness reported "12 issue(s) across 32 targets"
 * and that number was treated as the pass condition. Enumerating the
 * twelve finally showed what they were: every single one is caused by
 * the sandbox this runs in, and not one is caused by a page.
 *
 *   8 x fonts.googleapis.com  ERR_CONNECTION_RESET
 *   2 x api.github.com        ERR_CERT_AUTHORITY_INVALID
 *   2 x localhost:3001        ERR_CONNECTION_REFUSED
 *
 * Both external hosts answer 200 to curl through the agent proxy; it is
 * headless Chromium that does not trust the proxy's CA. The localhost
 * pair is agentic-os.html correctly probing for its local dev backend,
 * which is not running here — on the deployed https site that probe is
 * already suppressed as mixed content.
 *
 * So the number could never go down, which made it useless as a signal:
 * a real product error appearing would simply have made it thirteen,
 * and a real one REPLACING an environmental one would have passed
 * silently at twelve. The gate is now "zero product issues", which can
 * actually be met and actually means something. Environmental issues
 * are still printed — they are context, not noise to hide — but they do
 * not gate.
 *
 * The classifier is deliberately narrow. It is not "ignore network
 * errors": a same-origin failure is always the site's problem, and
 * ERR_CONNECTION_REFUSED counts as environmental only for the one
 * documented local backend. Anything it cannot positively explain is
 * a product issue.
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const BASE_ORIGIN = new URL(BASE).origin;

// A failure is environmental only when it can be positively explained by
// this sandbox. Each rule says which, and why.
const ENVIRONMENTAL = [
  {
    why: 'cross-origin host blocked by the sandbox network policy (curl reaches it through the agent proxy; headless Chromium does not)',
    test: t => /net::ERR_CONNECTION_RESET/.test(t) && isCrossOrigin(t),
  },
  {
    why: "the agent proxy's CA is not in headless Chromium's trust store",
    test: t => /net::ERR_CERT_AUTHORITY_INVALID/.test(t) && isCrossOrigin(t),
  },
  {
    why: 'agentic-os.html probing its local dev backend, which is not running here (correctly suppressed as mixed content on the deployed https site)',
    test: t => /net::ERR_CONNECTION_REFUSED/.test(t) && /\blocalhost:3001\b/.test(t),
  },
  {
    // Chromium logs a bare console line alongside each of the above. It
    // carries no URL, so it can only be matched on its exact wording;
    // anything with more to say than this is a product issue.
    why: "Chromium's own console echo of a network failure above",
    test: t => /^Failed to load resource: net::ERR_(CONNECTION_RESET|CERT_AUTHORITY_INVALID|CONNECTION_REFUSED)$/.test(t.trim()),
  },
];

function isCrossOrigin(text) {
  const m = text.match(/https?:\/\/[^\s]+/);
  if (!m) return false;
  try { return new URL(m[0]).origin !== BASE_ORIGIN; } catch (e) { return false; }
}

function classify(issue) {
  for (const rule of ENVIRONMENTAL) {
    if (rule.test(issue.text)) return { env: true, why: rule.why };
  }
  return { env: false };
}

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

  let product = 0, env = 0;
  const envWhy = new Map();
  for (const r of results) {
    const sorted = r.issues.map(i => ({ ...i, c: classify(i) }));
    const bad = sorted.filter(i => !i.c.env);
    const meh = sorted.filter(i => i.c.env);
    product += bad.length;
    env += meh.length;
    for (const i of meh) envWhy.set(i.c.why, (envWhy.get(i.c.why) || 0) + 1);

    if (!bad.length && !meh.length) { console.log(`OK    ${r.target}`); continue; }
    if (!bad.length) {
      // Environmental only: say so plainly rather than printing FAIL for
      // something no change to this repo could ever fix.
      console.log(`ENV   ${r.target}  (${meh.length} environmental)`);
      for (const i of meh) console.log(`        [${i.kind}] ${i.text.slice(0, 300)}`);
      continue;
    }
    console.log(`FAIL  ${r.target}  (${bad.length} product${meh.length ? `, ${meh.length} environmental` : ''})`);
    for (const i of bad) console.log(`        [${i.kind}] ${i.text.slice(0, 400)}`);
    for (const i of meh) console.log(`        (env) [${i.kind}] ${i.text.slice(0, 300)}`);
  }

  if (env) {
    console.log(`\n--- ${env} environmental issue(s), not gating: ---`);
    for (const [why, n] of envWhy) console.log(`      ${n} x ${why}`);
  }
  console.log(`\n=== ${product} product issue(s) across ${results.length} targets ===`);
  // The gate is product issues only. Environmental ones are printed for
  // context and deliberately do not fail the run: nothing in this repo
  // can fix headless Chromium not trusting the agent proxy's CA.
  process.exit(product ? 1 : 0);
})();
