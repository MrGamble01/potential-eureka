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

  // D — no duplicate element ids anywhere. HV-50 named its action `panel`,
  // and action buttons get id="action-"+id, so it collided with the
  // #action-panel container div: invalid HTML, and the button silently
  // inherited the panel's absolute-positioned CSS from the day it shipped.
  for (const pg of ['homeless-village.html', 'drug-lab.html', 'voxel-garden.html',
                    'tycoon/play.html', 'hearthvale.html', 'ageofwar/index.html', 'index.html']) {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await page.goto(BASE + '/' + pg, { waitUntil: 'load' });
    await page.waitForTimeout(3000);
    const dups = await page.evaluate(() => {
      const seen = new Map();
      document.querySelectorAll('[id]').forEach(el => seen.set(el.id, (seen.get(el.id) || 0) + 1));
      return [...seen.entries()].filter(([, c]) => c > 1).map(([id, c]) => `${id} x${c}`);
    });
    ok(dups.length === 0, `${pg}: no duplicate element ids${dups.length ? ' — ' + dups.join(', ') : ''}`);
    await ctx.close();
  }

  // E — Homeless Village: every action and craft button reachable on desktop.
  // Both side columns were "centred, height = content"; seven rounds of new
  // ACTIONS rows later the list stood 1035px tall in a 900px viewport and the
  // last rows sat under #bottom-bar. A control counts as reachable if it is
  // hittable, or becomes hittable once scrolled into its own container.
  for (const vp of [{ width: 1400, height: 900 }, { width: 1280, height: 720 }]) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
    await page.waitForTimeout(3000);
    const stuck = await page.evaluate(() => {
      const hittable = el => {
        const b = el.getBoundingClientRect();
        if (b.width < 2 || b.height < 2) return false;
        const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
        if (cx < 1 || cx > innerWidth - 1 || cy < 1 || cy > innerHeight - 1) return false;
        const hit = document.elementFromPoint(cx, cy);
        return !!hit && (hit === el || el.contains(hit));
      };
      const out = [];
      document.querySelectorAll('#action-list button, #craft-list button, .craft-item').forEach(el => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none') return;
        if (hittable(el)) return;
        try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
        if (!hittable(el)) out.push(el.id || el.className);
      });
      return out;
    });
    ok(stuck.length === 0,
      `Homeless Village ${vp.width}x${vp.height}: every action and craft button reachable`
      + (stuck.length ? ` — stuck: ${stuck.join(', ')}` : ''));
    await ctx.close();
  }

  // F — no visible control may be covered by another at its own centre.
  // Tycoon's phone corner was stacked by eye: #next-action-card is full-width
  // at bottom:78px and 56px tall with z-index 95, and #sprint-btn sat at
  // bottom:72px underneath it, so Sprint's centre was never clickable — with
  // #tp-toggle (z 120) over the top of both. Voxel Isle pinned #topbar and
  // #back at top:10px each, and at phone width the chips covered five nav
  // buttons. Zero-sized elements are skipped: buttons inside a collapsed
  // sidebar section report 0x0 and elementFromPoint then names the canvas,
  // which is an artifact of probing, not a covered control.
  for (const [pg, wait] of [['tycoon/play.html', 3200], ['voxel-garden.html', 3500]]) {
    for (const vp of [{ width: 390, height: 844, m: true }, { width: 1400, height: 900, m: false }]) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.m, hasTouch: vp.m, deviceScaleFactor: vp.m ? 2 : 1,
      });
      const page = await ctx.newPage();
      page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
      await page.goto(BASE + '/' + pg, { waitUntil: 'load' });
      await page.waitForTimeout(wait);
      // stand the intro overlay down, as a player would
      await page.evaluate(() => {
        document.querySelectorAll('body *').forEach(el => {
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.position !== 'fixed') return;
          const b = el.getBoundingClientRect();
          if (b.width >= innerWidth * 0.9 && b.height >= innerHeight * 0.9) el.style.display = 'none';
        });
      });
      await page.waitForTimeout(300);
      const covered = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('button,[onclick],[role="button"]').forEach(el => {
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden'
              || parseFloat(cs.opacity) === 0 || cs.pointerEvents === 'none') return;
          const b = el.getBoundingClientRect();
          if (b.width < 2 || b.height < 2) return;                 // collapsed section
          if (b.right < 1 || b.left > innerWidth - 1
              || b.bottom < 1 || b.top > innerHeight - 1) return;  // scrolled out of a panel
          const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
          const hit = document.elementFromPoint(cx, cy);
          if (hit && hit !== el && !el.contains(hit)) {
            out.push(`${el.id || el.className} <- ${hit.id || hit.className || hit.tagName}`);
          }
        });
        return out;
      });
      ok(covered.length === 0,
        `${pg} ${vp.width}x${vp.height}: no visible control covered at its centre`
        + (covered.length ? ` — ${covered.join(', ')}` : ''));
      await ctx.close();
    }
  }

  // G — Startup Tycoon's IPO button must actually be revealable.
  // #ipo-btn is hidden by its stylesheet rule, and checkIPOAvailable() used
  // to "show" it with `style.display = ''` — which clears the *inline*
  // property and lets the stylesheet's `none` apply again. The button never
  // appeared at any cash level, and since its click handler is the only
  // caller of openIPOModal, prestige was unreachable. It also has to survive
  // being revealed: #ipo-btn sits at bottom:18/right:18 and #tp-toggle was in
  // the same corner with z-index 120 over it.
  {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await page.goto(BASE + '/tycoon/play.html', { waitUntil: 'load' });
    await page.waitForTimeout(3200);
    await page.evaluate(() => {
      document.querySelectorAll('body *').forEach(el => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.position !== 'fixed') return;
        const b = el.getBoundingClientRect();
        if (b.width >= innerWidth * 0.9 && b.height >= innerHeight * 0.9) el.style.display = 'none';
      });
    });
    const r = await page.evaluate(() => {
      const el = document.getElementById('ipo-btn');
      if (!el) return { missing: true };
      // the old, broken reveal
      el.style.display = '';
      const clearedStillHidden = getComputedStyle(el).display === 'none';
      // the reveal the game performs now
      el.style.display = 'block';
      const b = el.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      const shown = getComputedStyle(el).display !== 'none' && b.width > 2 && b.height > 2;
      const owns = !!hit && (hit === el || el.contains(hit));
      const tp = document.getElementById('tp-toggle');
      const bt = tp.getBoundingClientRect();
      const ix = Math.min(b.right, bt.right) - Math.max(b.left, bt.left);
      const iy = Math.min(b.bottom, bt.bottom) - Math.max(b.top, bt.top);
      return { clearedStillHidden, shown, owns, overlaps: ix > 0 && iy > 0 };
    });
    ok(!r.missing && r.clearedStillHidden,
      'the IPO button is stylesheet-hidden, so clearing the inline style cannot reveal it');
    ok(!r.missing && r.shown && r.owns,
      'revealed with a real display value, the IPO button is visible and owns its own centre');
    ok(!r.missing && !r.overlaps,
      'the revealed IPO button does not collide with the camera toggle');
    await ctx.close();
  }

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
