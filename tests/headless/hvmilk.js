/*
 * HV-136 — the fridge-door note said take the milk, and the pot
 * never moved.
 *
 * HV-33: a note taped in the fridge door quotes the camps and the
 * longest hold, then says take the milk, leave a story. Reading it
 * lifts morale by 2. G.food never moved. A story is morale. Milk
 * is food.
 *
 *  A. Source: HVNOTE_FOOD stands; deliverHvNote assigns food.
 *     ui.js untouched. Two morale stays.
 *  B. THE SEAM: a find — morale up 2 and the pot up 2. The log
 *     names the milk.
 *  C. A bridge with no history still gets no note. Kind Stranger
 *     is still a food drop, not a note.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives deliverHvNote() on the production note.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg  = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const ui   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const noteAt = cfg.indexOf('function deliverHvNote()');
const note = noteAt >= 0 ? cfg.slice(noteAt, noteAt + 500) : '';

// --- A. source --------------------------------------------------------
ok(/HVNOTE_FOOD\s*=\s*2/.test(cfg) && /HVNOTE_MORALE\s*=\s*2/.test(cfg),
   'HVNOTE_FOOD is 2 — the milk is food, two morale stays');
ok(note.length > 0 && /G\.food\s*=\s*\(G\.food\|\|0\)\s*\+\s*HVNOTE_FOOD/.test(note),
   'deliverHvNote assigns food from HVNOTE_FOOD');
ok(/Take the milk/.test(cfg) && /HVNOTE_FOOD/.test(note),
   'the note still says take the milk and the find names the food');
ok(!/HVNOTE_FOOD/.test(ui) && !/deliverHvNote/.test(ui),
   'ui.js was not given the note — it still only paints the HUD');

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
    if (!sessionStorage.getItem('hvmilk-init')) {
      sessionStorage.setItem('hvmilk-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-fridge');
      localStorage.removeItem('hv-record');
      localStorage.removeItem('hv-letter');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  // --- B. the find ---------------------------------------------------
  const found = await t(() => {
    saveFridge({ built: true, camps: 3 });
    saveHvRec({ days: 14, beats: 1 });
    G.food = 10; G.morale = 50;
    deliverHvNote();
    return {
      milk: typeof HVNOTE_FOOD === 'number' ? HVNOTE_FOOD : null,
      morale: G.morale, food: G.food, read: loadHvNote().read,
      text: composeHvNote(),
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  });
  ok(found.milk === 2 && /Take the milk/.test(found.text),
     `the note still says take the milk / +2 food (${found.milk})`);
  ok(found.read === 1 && found.morale === 52,
     `a find still leaves a story — morale 50 → ${found.morale}`);
  ok(found.food === 12,
     `and the pot takes the milk (10 → ${found.food})`);
  ok(/milk/i.test(found.log) && /🍞/.test(found.log),
     `the log names the milk (${found.log.slice(-140)})`);

  // --- C. no history, and Kind Stranger is not the note --------------
  const bare = await t(() => {
    localStorage.removeItem('hv-fridge');
    localStorage.removeItem('hv-record');
    localStorage.removeItem('hv-letter');
    G.food = 10; G.morale = 50;
    deliverHvNote();
    return { food: G.food, morale: G.morale, read: loadHvNote().read };
  });
  ok(bare.read === 0 && bare.food === 10 && bare.morale === 50,
     'a bridge with no history still gets no note — the pot stays');

  const stranger = await t(() => {
    const ev = EVENTS_GOOD.find(e => e.id === 'kind_stranger');
    const real = Math.random;
    Math.random = () => 0.5;
    G.food = 0; G.morale = 50; G.goodwill = 10;
    triggerEvent(ev, true);
    Math.random = real;
    return { food: G.food, goodwill: G.goodwill,
      banner: document.getElementById('ev-title').textContent };
  });
  ok(stranger.food > 0 && stranger.goodwill === 10 && stranger.banner === 'Kind Stranger',
     `Kind Stranger is still a food drop, not a note (${stranger.food} food)`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
