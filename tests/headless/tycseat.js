/* TYC-66 — every hire goes back to their own desk on a reload.
 *
 * Every spawn took the first free desk in `plots` order, and the save
 * remembered only counts. So a reload reseated the roster in schema
 * order — engineers, then BDRs, then AEs, then the Lead Engineer —
 * rather than hire order. The starter room's three flex desks come
 * first in `plots`, and when a BDR or an AE landed on the flex desk the
 * Lead Engineer had been sitting at, spawnVP() found no vp-accepting
 * desk and the promotion (up to $21,500 through CTO) silently vanished:
 * no toast, the team boost gone, the hire panel offering "Promote
 * Engineer → Lead Engineer" for $1,500 again.
 *
 * The exact sequence, which this suite drives with real clicks:
 *   hire 2 engineers (flex desks 1 and 2) → promote the OG to Lead
 *   Engineer (moves to flex desk 3, frees desk 1) → buy the Sales
 *   Corner (two BDR desks) → hire 2 BDRs (BDR #1 takes flex desk 1,
 *   BDR #2 the Sales Corner) → reload.
 *   Pre-fix: engineer → 1, BDR → 2, BDR → 3, Lead Engineer → nowhere.
 *
 * Now each hire's seat rides the save by position and they go back to
 * it; the first free desk is only the fallback for saves that predate
 * the field. Hook-free: the seats are read out of the save itself.
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const SAVE_KEY = 'startup-tycoon-v7';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const source = fs.readFileSync(path.join(__dirname, '../../tycoon/play.html'), 'utf8');

// ── A. source ────────────────────────────────────────────────
{
  ok(/function findDeskFor\(role, seat\)/.test(source) && /function seatOf\(desk\)/.test(source), 'the seat helpers exist');
  for (const f of ['spawnIdeaWorker', 'spawnBDR', 'spawnAE', 'spawnVP']) {
    const body = source.slice(source.indexOf('function ' + f + '('), source.indexOf('function ' + f + '(') + 400);
    ok(/findDeskFor\('[a-z]+', opts\.seat\)/.test(body), `${f} seats through findDeskFor with the saved seat`);
  }
  for (const k of ['ideaWorkerSeats', 'bdrSeats', 'aeSeats', 'vpSeat']) ok(source.includes('p.' + k + ' ='), `the save carries ${k}`);
}

const seatsOf = sv => ({ eng: sv.ideaWorkerSeats, bdr: sv.bdrSeats, ae: sv.aeSeats, vp: sv.vpSeat });

async function boot(browser, save) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 120)));
  await page.addInitScript(([k, v, w]) => {
    if (sessionStorage.getItem('tycseat-seeded')) return;
    sessionStorage.setItem('tycseat-seeded', '1');
    try { localStorage.setItem(k, v); localStorage.setItem(w, '1'); } catch (e) {}
  }, [SAVE_KEY, JSON.stringify(save), 'tycoon:welcomeSeen-v1']);
  await page.goto(BASE + '/tycoon/play.html', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1200);
  // Read the NEXT autosave, so the value reflects the live roster.
  const saved = async () => {
    const since = Date.now();
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(500);
      const sv = await page.evaluate(([k, t]) => { try { const p = JSON.parse(localStorage.getItem(k)); return p.savedAt >= t ? p : null; } catch (e) { return null; } }, [SAVE_KEY, since]);
      if (sv) return sv;
    }
    return null;
  };
  const click = async sel => { await page.keyboard.press('Escape'); await page.click(sel); await page.waitForTimeout(250); };
  return { page, ctx, errs, saved, click };
}

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });

  // 1. The exact sequence from the audit, with real clicks, then a reload.
  {
    const b = await boot(browser, { v: 7, cash: 100000, allTimeCash: 50, prestigeLevel: 0, prestigeMultiplier: 1 });
    await b.click('#hire-btn');
    await b.click('#hire-btn');
    await b.click('#hire-vp-btn');
    const room = await b.page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.room-btn')).find(x => /Sales Corner/.test(x.textContent));
      if (!btn) return false; btn.click(); return true;
    });
    ok(room, 'bought the Sales Corner');
    await b.page.waitForTimeout(250);
    await b.click('#hire-bdr-btn');
    await b.click('#hire-bdr-btn');
    const before = await b.saved();
    ok(before && before.ideaWorkers === 1 && before.bdrCount === 2 && before.vpCount === 1,
      `the roster is 1 engineer, 2 BDRs and a Lead Engineer (${before && [before.ideaWorkers, before.bdrCount, before.vpCount].join('/')})`);
    ok(before && before.vpSeat && Math.abs(before.vpSeat.x) < 0.01 && Math.abs(before.vpSeat.z + 3) < 0.01,
      `the Lead Engineer sits at the third flex desk (${before && JSON.stringify(before.vpSeat)})`);
    ok(before && Array.isArray(before.bdrSeats) && before.bdrSeats.some(s => s && s.x === -4) && before.bdrSeats.some(s => s && s.x === 20),
      `one BDR took the freed flex desk and one the Sales Corner (${before && JSON.stringify(before.bdrSeats)})`);
    const vpLabelBefore = await b.page.evaluate(() => document.getElementById('hire-vp-btn').textContent);

    await b.page.reload({ waitUntil: 'load' });
    await b.page.waitForTimeout(1200);
    const after = await b.saved();
    ok(after && after.vpCount === 1, `the Lead Engineer survives the reload (vpCount ${after && after.vpCount})`);
    ok(after && after.ideaWorkers === 1 && after.bdrCount === 2, 'and so does everyone else');
    ok(after && JSON.stringify(seatsOf(after)) === JSON.stringify(seatsOf(before)),
      `everyone is back at their own desk (${after && JSON.stringify(seatsOf(after))})`);
    const vpLabelAfter = await b.page.evaluate(() => document.getElementById('hire-vp-btn').textContent);
    ok(vpLabelAfter === vpLabelBefore && !/Promote Engineer/.test(vpLabelAfter),
      `the hire panel still offers the next promotion, not a fresh Lead Engineer ("${vpLabelAfter.trim().slice(0, 40)}")`);
    ok(b.errs.length === 0, `no page errors across the hires and reload${b.errs.length ? ' — ' + b.errs[0] : ''}`);
    await b.ctx.close();
  }

  // 2. A save that predates the seat fields still loads (first-free-desk fallback), nobody lost when seats suffice.
  {
    const b = await boot(browser, { v: 7, cash: 0, allTimeCash: 50, ideaWorkers: 2, bdrCount: 0, vpCount: 1, vpTier: 1 });
    const sv = await b.saved();
    ok(sv && sv.ideaWorkers === 2 && sv.vpCount === 1 && sv.vpTier === 1 && sv.vpSeat && sv.ideaWorkerSeats.length === 2,
      `a legacy save seats the roster by fallback and starts remembering seats (${sv && JSON.stringify(seatsOf(sv))})`);
    await b.ctx.close();
  }

  await browser.close();
  ok(pass >= 18, 'suite is populated');
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
