/* HV-86 — Kind Stranger left a bag of food and the morale never made the log.
 *
 * The card is a small mercy: "Someone left a bag of food near the
 * bridge." The effect pays food AND morale — rand(3,8) food,
 * rand(5,10) morale. The log only counts the crate:
 *   log('Found donated food. +'+f+' food.');
 *
 * Good Weather, in the same pool, honestly says "Warmth and morale
 * up." Kind Stranger moves the HUD in silence. A player who reads
 * the log — the thing that confirms what just happened — is told
 * they found food. The mercy never shows up.
 *
 * Distinct from HV-78 Rest (an action receipt), HV-70 Found $5
 * (a goodwill amount), and HV-67 Good Weather (the sky itself).
 *
 * This suite is write-first and source-driven.
 *
 *  A. The card is still in the good-event pool — guards the guard.
 *  B. Source: the effect still applies morale, and its log() names
 *     morale. ui.js is not this ticket.
 *  C. Live: a pinned drop (Math.random = 0) pays +3 food and +5
 *     morale, and the log says morale +5. Food still moves.
 *     Reverting the log to food-only fails the named line.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives EVENTS_GOOD.kind_stranger.effect.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const kindAt = loop.indexOf("id:'kind_stranger'");
const kind = kindAt >= 0 ? loop.slice(kindAt, kindAt + 520) : '';
const kindLog = (kind.match(/log\(([^)]+)\)/) || [])[1] || '';

(async () => {
  ok(kindAt >= 0 && /id:'kind_stranger'/.test(kind),
     'Kind Stranger is still in the good-event pool — guards the guard');

  ok(/bag of food/i.test(kind) && /G\.morale\s*=/.test(kind),
     'the card is still a bag of food, and the effect still applies morale');

  ok(/morale/i.test(kindLog),
     `the Kind Stranger log names the morale it paid (got ${kindLog})`);

  ok(!/kind_stranger/.test(ui) && !/Found donated food/.test(ui),
     'ui.js is not this ticket — it still only paints the log line it is given');

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvkind-init')) {
      sessionStorage.setItem('hvkind-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const live = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0;
    G.food = 10;
    G.morale = 50;
    G.goalIndex = GOALS.length;
    const ev = EVENTS_GOOD.find(e => e.id === 'kind_stranger');
    ev.effect();
    Math.random = real;
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return { food: G.food, morale: G.morale, log };
  });

  ok(live.food === 13,
     `a pinned drop still pays +3 food (10 → ${live.food})`);
  ok(live.morale === 55,
     `and +5 morale — rand(5,10) at 0 is 5 (50 → ${live.morale})`);
  ok(/morale\s*\+5/i.test(live.log),
     `HV-86: Kind Stranger's log counts the morale it paid (log has ${JSON.stringify(live.log.slice(-140))})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
