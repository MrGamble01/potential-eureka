/*
 * HV-144 — the community shelf said spare socks, and a wet dawn
 * still bit the same.
 *
 * HV-39: at six camps the fridge grows a community shelf —
 * blankets, spare socks, a working can opener. #808 paid the
 * blankets as welcome warmth. #828 paid the can opener as an
 * extra can on a successful scavenge. The welcome log still
 * names the socks. Nothing read fridgeHasShelf() when dawn
 * took health for a camp that woke under 20 warmth.
 *
 * Socks are feet, not fire and not a can. A bitter dawn's
 * health bite comes in half while the shelf stands.
 *
 *  A. Source: HV-39 still names socks; FRIDGE_SHELF_SOCK and
 *     shelfSockBite exist; onNewDay's warmth<20 bite uses them.
 *  B. shelfSockBite(10) is 5; a board-only fridge does not cut.
 *  C. Live dawn, pinned roll 0 (bite 5): no shelf 50→45;
 *     sixth-camp shelf 50→47 and the log names the socks.
 *  D. Hunger bite (food 0, warmth high) is unchanged by socks.
 *  E. Kind Stranger is still a food drop. Sanitation still +1.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives onNewDay / fridgeHasShelf / triggerEvent.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const main = fs.readFileSync(path.join(ROOT, 'homeless-village/js/main.js'), 'utf8');

ok(/spare socks|socks, a can opener|socks, a working can opener/i.test(cfg),
  'HV-39 still names spare socks on the community shelf');
ok(/blankets, socks, a working can opener/.test(main),
  'the sixth-camp welcome still names the socks');
ok(/FRIDGE_SHELF_SOCK/.test(cfg) && /function shelfSockBite\s*\(/.test(cfg),
  'HV-144: FRIDGE_SHELF_SOCK and shelfSockBite are named in config.js');
ok(/shelfSockBite\s*\(/.test(loop) && /warmth\s*<\s*20/.test(loop),
  'HV-144: onNewDay\'s warmth<20 bite goes through shelfSockBite');

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
    if (!sessionStorage.getItem('hvsocks-init')) {
      sessionStorage.setItem('hvsocks-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-festival');
      localStorage.removeItem('hv-fridge');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  const helper = await t(() => ({
    fn: typeof shelfSockBite === 'function',
    sock: typeof FRIDGE_SHELF_SOCK === 'number' ? FRIDGE_SHELF_SOCK : null,
    ten: typeof shelfSockBite === 'function' ? shelfSockBite(10) : null,
    five: typeof shelfSockBite === 'function' ? shelfSockBite(5) : null,
  }));
  ok(helper.fn && helper.sock === 0.5,
    'HV-144: shelfSockBite is a named helper (FRIDGE_SHELF_SOCK = 0.5)');
  ok(helper.ten === 5 && helper.five === 3,
    `HV-144: shelfSockBite halves a 10-bite to 5 and ceils a 5-bite to 3 (${helper.ten}, ${helper.five})`);

  const dawn = await t(() => {
    const park = function () {
      SNAP_CHANCE = 0;
      G.snapUntil = null;
      G.friendDay = -1;
      G.dog = 0;
      G.workers = { scrapper: false, builder: false, cook: false, lookout: false };
      G.structures.garden = false;
      G.structures.pantry = false;
      G.structures.tent = false;
      G.structures.workbench = false;
      G.structures.coats = false;
      G.structures.compost = false;
      G.structures.barrel = false;
      G.structures.soup_kitchen = false;
      G.petitions = {};
      G.population = 1;
      G.food = 40;
      G.morale = 50;
      G.rep = 0;
      G.goalIndex = GOALS.length;
      G.lastEventDay = G.days + 9;
      G.forecast = 'clear';
      G.weather = 'clear';
      G.season = 0;
      G.rayDebt = 0;
      G.rainBetOn = false;
      G.mural = 0;
    };
    const run = function (fridge) {
      saveFridge(fridge);
      park();
      G.warmth = 15;
      G.health = 50;
      const real = Math.random;
      Math.random = () => 0;
      onNewDay();
      Math.random = real;
      return {
        health: G.health,
        warmth: G.warmth,
        shelf: fridgeHasShelf(),
        log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
      };
    };
    const none = run({ built: true, camps: 3 });
    const shelf = run({ built: true, camps: 6 });
    return { none, shelf };
  });
  ok(dawn.none.shelf === false && dawn.shelf.shelf === true,
    'board-only is not the shelf; six camps is');
  ok(dawn.none.health === 45,
    `HV-144: a board-only bitter dawn still takes the full 5 (50 → ${dawn.none.health})`);
  ok(dawn.shelf.health === 47,
    `HV-144: spare socks cut the same roll to 3 (50 → ${dawn.shelf.health})`);
  ok(/socks/i.test(dawn.shelf.log) && !/socks/i.test(dawn.none.log),
    'the shelf dawn names the socks; the board-only dawn does not');

  const hunger = await t(() => {
    const run = function (fridge) {
      saveFridge(fridge);
      SNAP_CHANCE = 0;
      G.snapUntil = null;
      G.friendDay = -1;
      G.dog = 0;
      G.workers = { scrapper: false, builder: false, cook: false, lookout: false };
      G.structures.garden = false;
      G.structures.pantry = false;
      G.structures.tent = false;
      G.structures.workbench = false;
      G.structures.coats = false;
      G.structures.soup_kitchen = false;
      G.petitions = {};
      G.population = 1;
      G.food = 0;
      G.warmth = 80;
      G.health = 50;
      G.morale = 50;
      G.rep = 0;
      G.goalIndex = GOALS.length;
      G.lastEventDay = G.days + 9;
      G.forecast = 'clear';
      G.weather = 'clear';
      G.season = 0;
      G.rayDebt = 0;
      G.rainBetOn = false;
      G.mural = 0;
      const real = Math.random;
      Math.random = () => 0;
      onNewDay();
      Math.random = real;
      return G.health;
    };
    return { none: run({ built: true, camps: 3 }), shelf: run({ built: true, camps: 6 }) };
  });
  ok(hunger.none === hunger.shelf && hunger.none === 46,
    `HV-144: socks do not touch the empty-larder bite (both ${hunger.none} / ${hunger.shelf})`);

  const stranger = await t(() => {
    const ev = EVENTS_GOOD.find(e => e.id === 'kind_stranger');
    const real = Math.random;
    Math.random = () => 0.5;
    G.goodwill = 10; G.food = 0; G.health = 50;
    triggerEvent(ev, true);
    Math.random = real;
    return { goodwill: G.goodwill, food: G.food, health: G.health };
  });
  ok(stranger.goodwill === 10 && stranger.food > 0 && stranger.health === 50,
    `Kind Stranger is still a food drop, not socks (food=${stranger.food})`);

  const sanitation = await t(() => {
    saveFridge({ built: false, camps: 0 });
    SNAP_CHANCE = 0;
    G.snapUntil = null;
    G.friendDay = -1;
    G.dog = 0;
    G.workers = { scrapper: false, builder: false, cook: false, lookout: false };
    G.structures.garden = false;
    G.structures.pantry = false;
    G.structures.tent = false;
    G.structures.workbench = false;
    G.structures.soup_kitchen = false;
    G.petitions = { sanitation: true };
    G.population = 1;
    G.food = 40;
    G.warmth = 80;
    G.health = 50;
    G.morale = 50;
    G.rep = 0;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days + 9;
    G.forecast = 'clear';
    G.weather = 'clear';
    G.season = 0;
    G.rayDebt = 0;
    G.rainBetOn = false;
    G.mural = 0;
    const real = Math.random;
    Math.random = () => 0.9;
    onNewDay();
    Math.random = real;
    return G.health;
  });
  ok(sanitation === 51,
    `Sanitation still wakes +1 on a warm dawn (50 → ${sanitation})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
