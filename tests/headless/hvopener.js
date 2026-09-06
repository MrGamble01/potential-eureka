/*
 * HV-143 — the community shelf said a working can opener, and
 * Scavenge never felt it.
 *
 * HV-39's shelf is blankets, spare socks, and a can opener that
 * works. The sixth camp starts seven goodwill known. #808 is the
 * blankets (fresh-camp warmth). The can opener never touched a
 * dumpster. A pinned haul that pays 2 cans without the shelf still
 * pays 2 cans with it.
 *
 *  A. Source: the scavenge success branch reads fridgeHasShelf and
 *     writes extra cans. Config still names the can opener.
 *  B. No shelf: pinned haul is 2 cans. With the shelf: 3 cans.
 *  C. An empty dumpster stays empty — the opener does not invent a can.
 *  D. Forage is unchanged. Board-only (no shelf) stays at 2 cans.
 *  E. The sixth camp is still seven goodwill known (hvshelf A).
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction({id:'scavenge'}) on the production path.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const scav = /if\(a\.id==='scavenge'\)\{([\s\S]*?)\} else if\(a\.id==='forage'\)/.exec(player);
ok(!!scav, 'the scavenge branch is still in finishAction');
ok(scav && /fridgeHasShelf\s*\(/.test(scav[1]) && /G\.cans/.test(scav[1]),
  'HV-143: scavenge writes extra cans when the shelf’s can opener is out');
ok(/can opener that works/.test(cfg) && /FRIDGE_SHELF_CAN/.test(cfg),
  'the shelf still names a can opener that works, and the bonus is a named constant');

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
    if (!sessionStorage.getItem('hvopener-init')) {
      sessionStorage.setItem('hvopener-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-fridge');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  // r=0.5: not empty (0.5 < 0.2 is false); rand(0,3)=2 cans; rand(1,4)=3 scraps
  const haul = (shelf) => page.evaluate((has) => {
    if (has) saveFridge({ built: true, camps: 6 });
    else saveFridge({ built: false, camps: 0 });
    const real = Math.random;
    Math.random = () => 0.5;
    G.season = 0;
    G.weather = 'clear';
    G.regulars = { marisol: 0, ray: 0, dee: 0 };
    G.dumpsterLockDay = -1;
    G.cans = 10;
    G.scraps = 10;
    G.food = 10;
    finishAction({ id: 'scavenge', cooldown: 0, time: 0 });
    Math.random = real;
    return { cans: G.cans, scraps: G.scraps, food: G.food, shelf: fridgeHasShelf() };
  }, shelf);

  const bare = await haul(false);
  ok(!bare.shelf && bare.cans === 12 && bare.scraps === 13,
    `no shelf: pinned haul is +2 cans +3 scraps (10 → ${bare.cans}/${bare.scraps})`);

  const shelved = await haul(true);
  ok(shelved.shelf && shelved.cans === 13 && shelved.scraps === 13,
    `HV-143: the can opener adds +1 can (10 → ${shelved.cans}, scraps stay ${shelved.scraps})`);

  const empty = await t(() => {
    saveFridge({ built: true, camps: 6 });
    const real = Math.random;
    Math.random = () => 0.01;          // empty roll (.01 < .2)
    G.season = 0; G.weather = 'clear';
    G.regulars = { marisol: 0, ray: 0, dee: 0 };
    G.dumpsterLockDay = -1;
    G.cans = 10; G.scraps = 10; G.food = 10;
    finishAction({ id: 'scavenge', cooldown: 0, time: 0 });
    Math.random = real;
    const feed = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return { cans: G.cans, scraps: G.scraps, empty: /Nothing today/.test(feed) };
  });
  ok(empty.empty && empty.cans === 10 && empty.scraps === 10,
    'an empty dumpster stays empty — the opener does not invent a can');

  const forage = await t(() => {
    saveFridge({ built: true, camps: 6 });
    const real = Math.random;
    Math.random = () => 0.5;
    G.wood = 10; G.cardboard = 10;
    finishAction({ id: 'forage', cooldown: 0, time: 0 });
    Math.random = real;
    return { wood: G.wood, card: G.cardboard };
  });
  ok(forage.wood > 10 && forage.card > 10,
    `Forage Area is unchanged (${forage.wood - 10} wood, ${forage.card - 10} cardboard)`);

  const board = await haul(false);
  ok(!board.shelf && board.cans === 12,
    `board-less / no shelf stays at +2 cans (${board.cans})`);

  const welcome = await t(() => {
    saveFridge({ built: true, camps: 6 });
    return { seed: fridgeSeedNow(), at: FRIDGE_SHELF_AT, has: fridgeHasShelf() };
  });
  ok(welcome.has && welcome.seed === 7 && welcome.at === 6,
    'the sixth camp is still seven goodwill known — hvshelf A holds');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
