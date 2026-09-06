/* HV-85 — Theft said Trust no one, then Trade still paid.
 *
 * The Theft card: "Someone raided your stash in the night. Trust no one."
 * The effect took cans / food / scraps and a morale hit. Trade Goods
 * — the action that is trusting someone with the haul — still ran
 * 3 cans → 2 food the same morning.
 *
 * Gentrification (#736) is the corner. This ticket is the handshake.
 *
 *  A. The card still says Trust no one — that is the contract.
 *  B. Theft still takes the pinned haul and the morale hit.
 *  C. After the raid, a funded Trade does not pay, does not start
 *     a job, and does not take the 18s lock.
 *  D. Isolation: no raid, Trade still pays. A new dawn lifts it.
 *     Panhandle is not this stamp (that's the corner).
 *  Z. Zero page errors.
 *
 * Hook-free. Drives EVENTS_BAD.theft.effect, doAction, finishAction.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvtrust-init')) {
      sessionStorage.setItem('hvtrust-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const card = await page.evaluate(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'theft');
    return { title: ev && ev.title, desc: ev && ev.desc };
  });
  ok(card && /trust no one/i.test(card.desc),
    `the Theft card still says Trust no one (got ${JSON.stringify(card && card.desc)})`);

  const raid = await page.evaluate(() => {
    const real = Math.random; Math.random = () => 0.5;
    G.dog = 0; G.structures.stash = false; G.petitions = {};
    G.cans = 20; G.food = 20; G.scraps = 20; G.morale = 50;
    G.days = 5;
    EVENTS_BAD.find(e => e.id === 'theft').effect();
    Math.random = real;
    return {
      cans: G.cans, food: G.food, scraps: G.scraps, morale: G.morale,
      day: G.theftDay, days: G.days,
    };
  });
  ok(raid.cans < 20 && raid.food < 20 && raid.scraps < 20 && raid.morale < 50,
    `theft still takes the haul and the morale hit (cans ${raid.cans}, food ${raid.food}, scraps ${raid.scraps}, morale ${raid.morale})`);
  ok(raid.day === raid.days,
    `HV-85: Theft stamps the day you stop trusting (theftDay=${raid.day}, days=${raid.days})`);

  const after = await page.evaluate(() => {
    G.cans = 6; G.food = 10; G.cooldowns = {};
    delete activeJobs.trade;
    finishAction(ACTIONS.find(a => a.id === 'trade'));
    const paid = { cans: G.cans, food: G.food };

    G.cans = 6; G.food = 10; G.cooldowns = {};
    delete activeJobs.trade;
    const t0 = Date.now();
    doAction(ACTIONS.find(a => a.id === 'trade'));
    const started = !!activeJobs.trade;
    const cd = G.cooldowns.trade ? G.cooldowns.trade - t0 : 0;
    delete activeJobs.trade;

    return { paid, started, cd };
  });
  ok(after.paid.cans === 6 && after.paid.food === 10,
    `HV-85: Theft said trust no one and Trade still paid (cans ${after.paid.cans}, food ${after.paid.food})`);
  ok(!after.started && after.cd < 1000,
    `a distrust Trade starts no job and takes no 18s lock (started=${after.started}, cd=${after.cd})`);

  const iso = await page.evaluate(() => {
    G.theftDay = -1;
    G.cans = 6; G.food = 10; G.cooldowns = {};
    finishAction(ACTIONS.find(a => a.id === 'trade'));
    const clear = { cans: G.cans, food: G.food };

    G.theftDay = 5; G.days = 5;
    G.cans = 6; G.food = 10;
    G.lastEventDay = 999; G.forecast = 'clear'; G.weather = 'clear';
    G.dog = 1; G.dogMetDay = 99; G.goalIndex = GOALS.length;
    G.arcDone = true; G.population = 1; G.food = 50; G.warmth = 80;
    G.structures.tent = false; G.structures.garden = false;
    SNAP_CHANCE = 0; G.snapUntil = null;
    const real = Math.random; Math.random = () => 0.99;
    onNewDay();
    Math.random = real;
    G.cans = 6; G.food = 10; G.cooldowns = {};
    finishAction(ACTIONS.find(a => a.id === 'trade'));
    const dawn = { cans: G.cans, food: G.food, days: G.days, theftDay: G.theftDay };

    G.theftDay = G.days;
    G.goodwill = 0; G.morale = 50;
    const oldR = Math.random; Math.random = () => 0.1;
    finishAction(ACTIONS.find(a => a.id === 'panhandle'));
    Math.random = oldR;
    const pan = { goodwill: G.goodwill };

    return { clear, dawn, pan };
  });
  ok(iso.clear.cans === 3 && iso.clear.food === 12,
    `without a raid, Trade still pays 3 cans → 2 food (cans ${iso.clear.cans}, food ${iso.clear.food})`);
  ok(iso.dawn.cans === 3 && iso.dawn.food === 12,
    `a new dawn lifts the distrust — Trade pays again (day ${iso.dawn.days}, theftDay ${iso.dawn.theftDay})`);
  ok(iso.pan.goodwill > 0,
    `panhandle is not this stamp — the corner still pays after a raid (goodwill ${iso.pan.goodwill})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
