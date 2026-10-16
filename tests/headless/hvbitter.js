/*
 * HV-252 — Coat Rack said bitter dawns cut half as deep, then the
 * Cold Snap card still hit the full warmth.
 *
 * The rack's card is donated coats on a rail — on bitter dawns the
 * cold cuts half as deep. Dawn weather already uses COATS_CUT. The
 * Cold Snap event is the hardest cold in the game and subtracted
 * rand(20,35) warmth with the coats still hanging.
 *
 * Rain triggering the rack is not this card. Sweep or theft leaving
 * the rail is not this card. The named-snap dawn drain (hvcoats) is
 * not this card. Kind Stranger is still a food drop.
 *
 *  A. Source: the rack still claims half as deep; the cut is 0.5.
 *  B. Source: the Cold Snap effect applies COATS_CUT to the warmth hit.
 *  C. A pinned card without coats still drops 28 warmth (roll 0.5).
 *  D. The same roll with coats drops 14 and ticks the tally.
 *  E. Health still falls. Kind Stranger is still a food drop.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives triggerEvent() on the production cold_snap card.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const config = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const snapAt = loop.indexOf("id:'cold_snap'");
const theftAt = loop.indexOf("id:'theft'");
const snapBlock = snapAt >= 0 && theftAt > snapAt ? loop.slice(snapAt, theftAt) : '';
const coatRec = /id:'coats'[\s\S]{0,280}?desc:'([^']+)'/.exec(config);

ok(!!coatRec && /half as deep/.test(coatRec[1]),
  'the Coat Rack still claims the cold cuts half as deep');
ok(/COATS_CUT\s*=\s*0\.5/.test(config),
  'COATS_CUT is still half');
ok(/Temperature drops hard/.test(snapBlock),
  'the Cold Snap card still says temperature drops hard');
ok(/COATS_CUT/.test(snapBlock) && /structures\.coats/.test(snapBlock),
  'HV-252: the Cold Snap effect applies the rack to the warmth hit');
ok(!/homeless-village\/js\/ui\.js/.test(loop) && !/homeless-village\/js\/ui\.js/.test(config),
  'the cut lives on the Cold Snap card — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvbitter-init')) {
      sessionStorage.setItem('hvbitter-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const hit = (coats) => page.evaluate((coats) => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.structures.coats = !!coats;
    G.coldCut = 0;
    G.warmth = 90; G.health = 80; G.morale = 70;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(EVENTS_BAD.find(e => e.id === 'cold_snap'), false);
    Math.random = real;
    const lines = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    return {
      warmth: G.warmth,
      health: G.health,
      morale: G.morale,
      ticks: G.coldCut,
      last: lines[lines.length - 1] || '',
      log: lines.join(' '),
    };
  }, coats);

  const bare = await hit(false);
  ok(bare.warmth === 62,
    `without coats a 0.5 roll drops 28 warmth (90 → ${bare.warmth})`);
  ok(bare.health < 80,
    `health still falls without the rack (${bare.health})`);
  ok(bare.ticks === 0,
    `a bare rail does not tick the tally (${bare.ticks})`);

  const rack = await hit(true);
  ok(rack.warmth === 76,
    `HV-252: coats halve the card — 28 → 14 (90 → ${rack.warmth})`);
  ok(rack.ticks === 1,
    `the rack ticks the bitter-dawn tally (${rack.ticks})`);
  ok(rack.health < 80,
    `health still falls with the rack (${rack.health})`);
  ok(/half as deep|Coats off the rack/.test(rack.log),
    `the log names the rack (${rack.last})`);

  const stranger = await page.evaluate(() => {
    const ev = EVENTS_GOOD.find(e => e.id === 'kind_stranger');
    const real = Math.random;
    Math.random = () => 0.5;
    G.goodwill = 10; G.food = 0; G.warmth = 90;
    triggerEvent(ev, true);
    Math.random = real;
    return { goodwill: G.goodwill, food: G.food, warmth: G.warmth };
  });
  ok(stranger.goodwill === 10 && stranger.food > 0 && stranger.warmth === 90,
    `Kind Stranger is still a food drop, not a snap (${stranger.food} food)`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
