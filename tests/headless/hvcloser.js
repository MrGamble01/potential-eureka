/*
 * HV-132 — Biscuit Comes Closer said he fell asleep against the
 * barrel fire, and the camp never woke warmer.
 *
 * The join card: he eats what's offered and falls asleep against
 * the barrel fire. The effect takes two food and lifts morale.
 * G.warmth never moved. Eating is food. The barrel is warmth.
 * Daily keep still buys +3 warmth — the first night against the
 * fire is the join.
 *
 *  A. Source: BISCUIT_JOIN_WARMTH stands; the join effect assigns
 *     warmth. ui.js untouched. Daily keep stays +3.
 *  B. THE SEAM: trigger the join — food down 2, morale up 10, the
 *     barrel up 8. The log names the fire.
 *  C. A Stray Dog does not take the join's warmth. Kind Stranger
 *     is still a food drop, not a dog.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives triggerEvent() on the production dog events.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg  = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const joinAt = loop.indexOf("id:'dog_joins'");
const join = joinAt >= 0 ? loop.slice(joinAt, joinAt + 700) : '';

// --- A. source --------------------------------------------------------
ok(/BISCUIT_JOIN_WARMTH\s*=\s*8/.test(cfg),
   'BISCUIT_JOIN_WARMTH is 8 — the first night against the barrel');
ok(join.length > 0 && /G\.warmth\s*=\s*Math\.min\s*\(\s*100\s*,\s*\(G\.warmth\|\|0\)\s*\+\s*BISCUIT_JOIN_WARMTH\s*\)/.test(join),
   'the join effect assigns warmth from BISCUIT_JOIN_WARMTH');
ok(/barrel fire/.test(join) && /BISCUIT_JOIN_WARMTH/.test(join),
   'the join still names the barrel fire and the warmth');
ok(/G\.warmth\s*=\s*Math\.min\s*\(\s*100\s*,\s*G\.warmth\s*\+\s*3\s*\)/.test(loop),
   'daily keep still buys +3 warmth — the join is the first night');
ok(!/BISCUIT_JOIN_WARMTH/.test(ui) && !/dog_joins/.test(ui),
   'ui.js was not given the join — it still only paints the HUD');

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
    if (!sessionStorage.getItem('hvcloser-init')) {
      sessionStorage.setItem('hvcloser-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  // --- B. the join against the barrel --------------------------------
  const closer = await t(() => {
    const ev = DOG_EVENTS.joins;
    G.food = 10; G.morale = 40; G.warmth = 50;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(ev, true);
    return {
      warm: typeof BISCUIT_JOIN_WARMTH === 'number' ? BISCUIT_JOIN_WARMTH : null,
      food: G.food, morale: G.morale, warmth: G.warmth,
      banner: document.getElementById('ev-title').textContent,
      body: document.getElementById('ev-body').textContent,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  });
  ok(closer.warm === 8 && closer.banner === 'Biscuit Comes Closer',
     `the card is still Biscuit Comes Closer / +8 warmth (${closer.banner}, ${closer.warm})`);
  ok(/barrel fire/i.test(closer.body),
     'the body still lays him against the barrel fire');
  ok(closer.food === 8 && closer.morale === 50,
     `he still eats what's offered and the feeling lands (food ${closer.food}, morale ${closer.morale})`);
  ok(closer.warmth === 58,
     `and the barrel warms the camp (50 → ${closer.warmth})`);
  ok(/barrel|🔥/.test(closer.log) && /\+8/.test(closer.log),
     `the log names the fire (${closer.log.slice(-140)})`);

  // --- C. the stray and Kind Stranger are not the join --------------
  const stray = await t(() => {
    G.food = 10; G.morale = 40; G.warmth = 50;
    triggerEvent(DOG_EVENTS.stray, true);
    return { food: G.food, morale: G.morale, warmth: G.warmth,
      banner: document.getElementById('ev-title').textContent };
  });
  ok(stray.banner === 'A Stray Dog' && stray.warmth === 50 && stray.food === 10 && stray.morale === 44,
     `A Stray Dog watches from the fence — no join warmth (${stray.warmth})`);

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
     `Kind Stranger is still a food drop, not a dog (${stranger.food} food)`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
