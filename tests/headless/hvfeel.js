/*
 * HV-123 — the Long Memory said the fire feels it and never
 * warmed the barrel.
 *
 * HV-32: outlast the standing mark once a session and "the fire
 * feels it." recordDays raised morale and logged the line. The
 * barrel never moved. Morale is the camp's chin. The fire is the
 * barrel. A beaten morning that does not warm it is a lie.
 *
 *  A. Source: the beat branch assigns warmth; HVREC_WARMTH stands;
 *     ui.js is untouched. Morale still moves.
 *  B. The first dawns open the memory silently — warmth stays put.
 *  C. THE MORNING: a fresh session outlasting the mark warms the
 *     barrel and still lifts morale. The log names the fire.
 *  D. A longer hold the same session stays quiet. Kind Stranger
 *     is still a food drop, not a beaten morning.
 *  E. Groceries under the chalk star are still food.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives recordDays() on the production seam.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const ui  = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const recAt = cfg.indexOf('function recordDays(d){');
const rec = recAt >= 0 ? cfg.slice(recAt, recAt + 1400) : '';
const beatAt = rec.indexOf('if(!hvRecRung && hvRecMark>0 && d>hvRecMark)');
const beat = beatAt >= 0 ? rec.slice(beatAt, beatAt + 700) : '';

// --- A. source --------------------------------------------------------
ok(recAt >= 0 && /HVREC_WARMTH\s*=\s*8/.test(cfg),
   'HVREC_WARMTH is 8 — a beaten morning feeds the barrel');
ok(/HVREC_MORALE\s*=\s*3/.test(cfg),
   'HVREC_MORALE is still 3 — the chin still lifts');
ok(/the fire feels it/.test(cfg),
   'the Long Memory still says the fire feels it');

ok(beat.length > 0 && /G\.warmth\s*=\s*Math\.min\s*\(\s*100\s*,\s*\(G\.warmth\|\|0\)\s*\+\s*HVREC_WARMTH\s*\)/.test(beat),
   'the beat branch assigns warmth from HVREC_WARMTH');
ok(/G\.morale\s*=\s*Math\.min\s*\(\s*100\s*,\s*\(G\.morale\|\|0\)\s*\+\s*HVREC_MORALE\s*\)/.test(beat),
   'the beat branch still assigns morale');
ok(/HVREC_WARMTH/.test(beat) && /\+\s*'🔥'|\+HVREC_WARMTH/.test(beat),
   'the beaten-morning log names the fire');

ok(!/HVREC_WARMTH/.test(ui) && !/function recordDays/.test(ui),
   'ui.js was not given the record — it still only paints the HUD');

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvfeel-init')) {
      sessionStorage.setItem('hvfeel-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-record');
      localStorage.removeItem('hv-plaque');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const fresh = await t(() => ({
    key: HVREC_KEY, morale: HVREC_MORALE, warmth: HVREC_WARMTH,
    goal: GOALS.some(g => g.id === 'record2'),
    seam: onNewDay.toString().includes('recordDays'),
  }));
  ok(fresh.key === 'hv-record' && fresh.morale === 3 && fresh.warmth === 8 && fresh.goal && fresh.seam,
     'hv-record at +3 morale / +8 warmth — the record2 goal stands, the dawn seam reports');

  // --- B. first dawns stay quiet --------------------------------------
  const first = await t(() => {
    const m0 = G.morale, w0 = G.warmth;
    recordDays(5);
    return { r: loadHvRec(), rung: hvRecRung, morale: G.morale !== m0, warmth: G.warmth !== w0 };
  });
  ok(first.r.days === 5 && first.r.beats === 0 && !first.rung && !first.morale && !first.warmth,
     'the first dawns open the memory silently — morale and warmth stay put');

  const climb = await t(() => {
    const m0 = G.morale, w0 = G.warmth;
    recordDays(8);
    return { r: loadHvRec(), rung: hvRecRung, morale: G.morale !== m0, warmth: G.warmth !== w0 };
  });
  ok(climb.r.days === 8 && !climb.rung && !climb.morale && !climb.warmth,
     'later dawns climb it silently within the session');

  // --- C. the beaten morning warms the barrel -------------------------
  const morning = await t(() => {
    hvRecMark = null; hvRecRung = false;
    recordDays(3);
    const mark = hvRecMark;
    G.morale = 50; G.warmth = 50;
    G.goalIndex = GOALS.length;
    recordDays(mark + 1);
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' ');
    return { mark, beats: loadHvRec().beats, rung: hvRecRung,
      morale: G.morale, warmth: G.warmth, log };
  });
  ok(morning.rung && morning.beats === 1 && morning.morale === 53 && morning.warmth === 58,
     `outlasting the standing mark warms the barrel and lifts the chin (warmth ${morning.warmth}, morale ${morning.morale})`);
  ok(/fire feels it/.test(morning.log) && /\+8/.test(morning.log),
     `the log names the fire (${morning.log.slice(-120)})`);

  // --- D. same session stays quiet; Kind Stranger is food --------------
  const again = await t(() => {
    const w0 = G.warmth, m0 = G.morale, b0 = loadHvRec().beats;
    recordDays((loadHvRec().days || 0) + 4);
    return { warmth: G.warmth, morale: G.morale, beats: loadHvRec().beats, w0, m0, b0 };
  });
  ok(again.warmth === again.w0 && again.morale === again.m0 && again.beats === again.b0,
     'a longer hold the same session stays quiet');

  const stranger = await t(() => {
    const ev = EVENTS_GOOD.find(e => e.id === 'kind_stranger');
    const real = Math.random;
    Math.random = () => 0.5;
    G.warmth = 50; G.food = 0; G.goodwill = 10;
    triggerEvent(ev, true);
    Math.random = real;
    return { warmth: G.warmth, food: G.food, goodwill: G.goodwill,
      banner: document.getElementById('ev-title').textContent };
  });
  ok(stranger.warmth === 50 && stranger.food > 0 && stranger.goodwill === 10 && stranger.banner === 'Kind Stranger',
     `Kind Stranger is still a food drop, not a beaten morning (food=${stranger.food})`);

  // --- E. the chalk star still leaves groceries -----------------------
  const star = await t(() => {
    saveHvRec({ days: 5, beats: 3 });
    saveHvStar({ cheers: 0 });
    hvRecMark = null; hvRecRung = false;
    G.food = 10; G.warmth = 40;
    recordDays(6);
    return { food: G.food, warmth: G.warmth, cheers: loadHvStar().cheers };
  });
  ok(star.food === 13 && star.cheers === 1 && star.warmth === 48,
     `groceries under the star are still +3 food, and that morning still warms the barrel (food ${star.food}, warmth ${star.warmth})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
