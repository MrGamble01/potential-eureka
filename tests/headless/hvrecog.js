/*
 * HV-135 — Old Friend said someone recognized you, then Word on
 * the Street never heard it.
 *
 * The card is titled Old Friend. The body says "Someone from before
 * recognized you." Recognition is how the neighborhood learns a
 * name — that is G.rep / Word on the Street. The effect only rolled
 * morale and stamped friendDay. The HUD pill never moved.
 *
 * Distinct from HV-65 (hvfriend — the surge fades at dawn) and
 * HV-129 (#810 — the Chalk Star's "word gets around").
 *
 *  A. Source: old_friend still says recognized you; the effect
 *     calls addRep(3); friendDay and the brief fade are untouched.
 *  B. The card is still titled Old Friend.
 *  C. A live fire at rep 10 moves Word on the Street to 13.
 *     Morale still surges. The fade stamp still lands.
 *  D. Kind Stranger is still a food drop — no free +3 rep.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives triggerEvent() on the production event.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const src = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const block = /id:'old_friend'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(src);

ok(!!block, 'old_friend event is still in gameloop.js');
ok(/recognized you/.test(src), 'the card still says someone recognized you');
ok(block && /addRep\s*\(\s*3\s*\)/.test(block[1]),
  'HV-135: Old Friend recognition calls addRep(3)');
ok(block && /G\.friendDay\s*=\s*G\.days/.test(block[1]) && !/setTimeout/.test(block[1]),
  'the dawn fade stamp is still the HV-65 latch — no setTimeout');
ok(!/old_friend/.test(ui) && !/friendDay/.test(ui),
  'ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvrecog-init')) {
      sessionStorage.setItem('hvrecog-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const fired = await t(() => {
    const ev = EVENTS_GOOD.find(e => e.id === 'old_friend');
    const real = Math.random;
    Math.random = () => 0;
    G.rep = 10;
    G.morale = 50;
    G.days = 4;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(ev, true);
    Math.random = real;
    return {
      rep: G.rep,
      morale: G.morale,
      day: G.friendDay,
      banner: document.getElementById('ev-title').textContent,
      body: document.getElementById('ev-body').textContent,
      pill: (document.getElementById('rep-name') || {}).textContent || '',
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  });
  ok(fired.banner === 'Old Friend', `the card is still titled Old Friend (${fired.banner})`);
  ok(/recognized you/i.test(fired.body), 'the body still says someone recognized you');
  ok(fired.rep === 13,
    `HV-135: recognition moves Word on the Street 10 → 13 (rep ${fired.rep})`);
  ok(fired.morale === 62 && fired.day === 4,
    `morale still surges and the fade still stamps the day (morale ${fired.morale}, friendDay ${fired.day})`);
  ok(/briefly/.test(fired.log),
    'the surge still logs as brief');
  ok(/13/.test(fired.pill) || fired.rep === 13,
    `the HUD pill heard it (${fired.pill})`);

  const stranger = await t(() => {
    const ev = EVENTS_GOOD.find(e => e.id === 'kind_stranger');
    const real = Math.random;
    Math.random = () => 0.5;
    G.rep = 10;
    G.food = 0;
    triggerEvent(ev, true);
    Math.random = real;
    return { rep: G.rep, food: G.food };
  });
  ok(stranger.rep === 10 && stranger.food > 0,
    `Kind Stranger is still a food drop, not +3 rep (food=${stranger.food}, rep=${stranger.rep})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
