/* UI-1/UI-2 — every flagship control stays on screen.
 *
 * This suite exists because it did not. Grow Op's 27 buttons were each their
 * own position:fixed element on a horizontal ladder running out to
 * right:3904px; at 1400x900 that put 18 of them off the left edge, clickable
 * by nobody. Voxel Isle's chips climbed to bottom:698px and clipped off the
 * top at 720px tall. Both shipped, for many rounds, because nothing measured
 * geometry — every other suite asserts behaviour through the DOM, which is
 * blind to an element parked at left:-2553.
 *
 * A. Grow Op: all 27 tray buttons on screen at desktop, laptop and phone.
 * B. Voxel Isle: no chip clipped at 900/800/720/650 tall.
 * C. The trays actually wrap/scroll rather than overflowing the viewport.
 * Z. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

// Measure every control's box with it forced visible, so a hidden-but-
// misplaced button is still caught.
const PROBE = (sel) => {
  const out = [];
  document.querySelectorAll(sel).forEach(el => {
    const pd = el.style.display, pv = el.style.visibility;
    el.style.display = 'flex'; el.style.visibility = 'hidden';
    const b = el.getBoundingClientRect();
    el.style.display = pd; el.style.visibility = pv;
    const off = b.right < 1 || b.left > innerWidth - 1 || b.bottom < 1 || b.top > innerHeight - 1;
    const clipped = b.top < 0 || b.bottom > innerHeight || b.left < 0 || b.right > innerWidth;
    out.push({ id: el.id, off, clipped, top: Math.round(b.top), left: Math.round(b.left) });
  });
  return out;
};

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errs = [];

  // A — Grow Op
  for (const vp of [{ width: 1400, height: 900 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await page.goto(BASE + '/drug-lab.html', { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    const r = await page.evaluate(PROBE, '#lab-tray > [id$="-toggle"]');
    const gone = r.filter(x => x.off);
    ok(r.length === 27 && gone.length === 0,
      `Grow Op ${vp.width}x${vp.height}: all ${r.length} tray buttons on screen`
      + (gone.length ? ` — OFF: ${gone.map(g => g.id + '@' + g.left).join(', ')}` : ''));
    await ctx.close();
  }

  // B — Voxel Isle
  for (const h of [900, 800, 720, 650]) {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: h } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
    await page.waitForTimeout(3000);
    const r = await page.evaluate(PROBE, '#vox-tray > [id$="Hud"]');
    const bad = r.filter(x => x.clipped);
    ok(r.length === 19 && bad.length === 0,
      `Voxel Isle 1400x${h}: none of ${r.length} chips clipped`
      + (bad.length ? ` — ${bad.map(b => b.id + '@top=' + b.top).join(', ')}` : ''));
    await ctx.close();
  }

  // C — the trays reflow instead of overflowing
  {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await page.goto(BASE + '/drug-lab.html', { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    const t = await page.evaluate(() => {
      const el = document.getElementById('lab-tray');
      const cs = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      // force every button visible to measure the tray at full extent
      el.querySelectorAll('button').forEach(x => { x.style.display = ''; });
      const b2 = el.getBoundingClientRect();
      const rows = new Set();
      el.querySelectorAll('button').forEach(x => rows.add(Math.round(x.getBoundingClientRect().top)));
      return { wrap: cs.flexWrap, within: b2.left >= -1 && b2.right <= innerWidth + 1,
               rows: rows.size, docScroll: document.documentElement.scrollWidth <= innerWidth + 1 };
    });
    ok(t.wrap === 'wrap-reverse' && t.within && t.rows > 1,
      `the Grow Op tray wraps to ${t.rows} rows and stays inside the viewport`);
    ok(t.docScroll, 'the page itself never scrolls sideways');
    await ctx.close();
  }

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
