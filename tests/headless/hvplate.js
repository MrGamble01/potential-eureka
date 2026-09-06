/*
 * HV-128 — Beloved at 75 never gets the dawn plate.
 *
 * config.js says Beloved at 75 means some mornings a neighbor leaves
 * something at the fence. repAtDawn() decayed first: addRep(-1) then
 * checked repTier()>=3. A camp that just became Beloved (rep 75) woke
 * as Respected (74) and the gift never rolled. hvrep F seeds 76 so
 * the suite never saw the edge.
 *
 *  A. Source: the gift gate still lives in repAtDawn; decay still
 *     happens; the gift is judged while the camp is still Beloved.
 *     ui.js is not this ticket.
 *  B. Live at 75: pin Math.random [0.1, 0.4] (gift hits, plate).
 *     After repAtDawn: a plate, food >= 1, repGiftDay is today.
 *     Word still fades 75→74 after the gift.
 *  C. Isolation 76: same pins still leave a plate and decay 76→75
 *     (hvrep F).
 *  D. Same-day cap: a second dawn the same day does not gift again.
 *  E. Known 30 and Respected 50 do not get the plate.
 *  F. The envelope branch still pays at 75.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives repAtDawn() on the production path.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const fnStart = loop.indexOf('function repAtDawn()');
ok(fnStart >= 0, 'repAtDawn is still in gameloop.js');
const fnEnd = loop.indexOf('\nfunction ', fnStart + 1);
const fn = fnStart >= 0 ? loop.slice(fnStart, fnEnd > fnStart ? fnEnd : undefined) : '';
const giftAt = fn.indexOf('repTier()>=3');
const decayAt = fn.indexOf('addRep(-1)');
ok(giftAt >= 0 && /repGiftDay/.test(fn) && /Math\.random\(\)<\.2/.test(fn),
  'the Beloved gift gate is still in repAtDawn (tier 3, once a day, 20%)');
ok(decayAt >= 0 && /G\.days>1/.test(fn),
  'word still fades a point each dawn after day 1');
ok(giftAt >= 0 && decayAt >= 0 && giftAt < decayAt,
  'HV-128: the gift is judged before word fades');
ok(/at:75,\s*name:'Beloved'/.test(cfg),
  'Beloved still begins at 75');
ok(!/function repAtDawn/.test(ui) && !/repGiftDay/.test(ui),
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
    if (!sessionStorage.getItem('hvplate-init')) {
      sessionStorage.setItem('hvplate-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const dawn = (rep, extra) => page.evaluate(({ rep, extra }) => {
    const logs = [];
    const oldLog = window.log;
    window.log = m => { logs.push(m); oldLog(m); };
    const oldR = Math.random;
    let q = extra.rolls.slice();
    Math.random = () => (q.length ? q.shift() : 0.5);
    G.rep = rep;
    G.days = extra.days;
    G.repGiftDay = extra.giftDay;
    G.food = extra.food;
    G.goodwill = extra.goodwill;
    const food0 = G.food;
    const gw0 = G.goodwill;
    repAtDawn();
    Math.random = oldR;
    window.log = oldLog;
    return {
      rep: G.rep,
      food: G.food,
      foodDelta: G.food - food0,
      goodwill: G.goodwill,
      gwDelta: G.goodwill - gw0,
      giftDay: G.repGiftDay,
      plate: logs.some(m => /covered plate/.test(m)),
      envelope: logs.some(m => /envelope/.test(m)),
      fade: logs.some(m => /Word fades/.test(m) && /Respected/.test(m)),
    };
  }, { rep, extra });

  // B. Beloved at the threshold still gets the plate, then word fades.
  const at75 = await dawn(75, {
    days: 12, giftDay: -1, food: 0, goodwill: 10, rolls: [0.1, 0.4],
  });
  ok(at75.plate && at75.foodDelta >= 1 && at75.giftDay === 12,
    `HV-128: Beloved at 75 still gets the dawn plate (+${at75.foodDelta} food)`);
  ok(at75.rep === 74 && at75.fade,
    `word still fades 75→74 after the gift (rep=${at75.rep})`);

  // C. Isolation: 76 still gifts then decays to 75 (hvrep F).
  const at76 = await dawn(76, {
    days: 13, giftDay: -1, food: 0, goodwill: 10, rolls: [0.1, 0.4],
  });
  ok(at76.plate && at76.foodDelta >= 1 && at76.rep === 75 && at76.giftDay === 13,
    `a 76 dawn still leaves a plate and decays 76→75 (rep=${at76.rep}, +${at76.foodDelta})`);

  // D. Same-day cap: a second call the same day decays only.
  const second = await dawn(at76.rep, {
    days: 13, giftDay: at76.giftDay, food: at76.food, goodwill: 10, rolls: [0.1, 0.4],
  });
  ok(second.rep === 74 && second.foodDelta === 0 && !second.plate && second.giftDay === 13,
    'no second gift the same day (decay only)');

  // E. Known / Respected never roll the fence gift.
  const known = await dawn(30, {
    days: 14, giftDay: -1, food: 0, goodwill: 10, rolls: [0.1, 0.4],
  });
  const respected = await dawn(50, {
    days: 14, giftDay: -1, food: 0, goodwill: 10, rolls: [0.1, 0.4],
  });
  ok(known.rep === 29 && known.foodDelta === 0 && !known.plate && known.giftDay === -1,
    `Known 30 does not get the plate (rep=${known.rep})`);
  ok(respected.rep === 49 && respected.foodDelta === 0 && !respected.plate && respected.giftDay === -1,
    `Respected 50 does not get the plate (rep=${respected.rep})`);

  // F. Envelope branch still pays at the Beloved threshold.
  const env = await dawn(75, {
    days: 15, giftDay: -1, food: 0, goodwill: 10, rolls: [0.1, 0.6],
  });
  ok(env.envelope && env.gwDelta >= 2 && !env.plate && env.giftDay === 15 && env.rep === 74,
    `the envelope still pays at 75 (+${env.gwDelta} goodwill)`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
