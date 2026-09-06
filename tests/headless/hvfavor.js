/*
 * HV-127 — a friend said they won't forget the favor, then affinity
 * never moved.
 *
 * HV-16 posts a friend's ask at dawn. Filling it spends the goods,
 * pays goodwill, and the log says they "won't forget this." Trade,
 * Rest, Borrow, Garage Favor, the Rain Bet and a landed panhandle
 * all call bumpRegular. doFavor — the actual favor — never did.
 * Affinity stayed put. Friendship ran one way.
 *
 *  A. Source: doFavor calls bumpRegular for the friend who asked.
 *  B. The log still says they won't forget; the goods-for-goodwill
 *     trade and +2 rep still pay.
 *  C. Filling Marisol's ask at friendship (5) moves affinity to 6.
 *  D. Ray's ask and Dee's ask bump their own rows, not hers.
 *  E. A short purse is refused; a two-day lapse still goes quietly
 *     unasked; the 3-day cadence still holds.
 *  F. The favor3 goal is on the ladder. Trade still bumps Marisol
 *     (hvregulars isolation). Dee's dawn latch is untouched.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives doFavor() on the production path.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const favorFn = /function doFavor\(\)\{[\s\S]*$/.exec(player);
ok(!!favorFn, 'doFavor is still in player.js');
ok(favorFn && /bumpRegular\s*\(/.test(favorFn[0]),
  'HV-127: doFavor calls bumpRegular so the friend actually remembers');
ok(favorFn && /won\\u2019t forget this/.test(favorFn[0]),
  'the fill log still says they won\'t forget this');

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
    if (!sessionStorage.getItem('hvfavor-init')) {
      sessionStorage.setItem('hvfavor-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  // B — the table, the goal, the goods-for-goodwill trade + rep
  const table = await t(() => {
    const m = FAVORS.marisol, r = FAVORS.ray, d = FAVORS.dee;
    return {
      goal: GOALS.some(g => g.id === 'favor3' && g.target === 3),
      marisol: m && m.need.cans === 3 && m.give.goodwill === 4,
      ray: r && r.need.food === 2 && r.give.goodwill === 3,
      dee: d && d.need.scraps === 2 && d.give.goodwill === 3,
    };
  });
  ok(table.goal && table.marisol && table.ray && table.dee,
    'favor3 is on the ladder; the three asks still trade goods for goodwill');

  const paid = await t(() => {
    const logs = [];
    const oldLog = window.log;
    window.log = m => { logs.push(m); oldLog(m); };
    G.regulars = { marisol: 5, ray: 0, dee: 0 };
    G.favor = { who: 'marisol', day: G.days };
    G.cans = 5; G.goodwill = 1; G.rep = 10; G.favorsDone = 0;
    G.goalIndex = GOALS.length;
    doFavor();
    window.log = oldLog;
    return {
      cans: G.cans, goodwill: G.goodwill, rep: G.rep,
      done: G.favorsDone, open: !!G.favor,
      affinity: G.regulars.marisol,
      forgot: logs.some(m => /won.?t forget this/.test(m)),
    };
  });
  ok(paid.cans === 2 && paid.goodwill === 5 && paid.rep === 12 && paid.done === 1 && !paid.open,
    `3 cans → +4 goodwill and +2 rep (cans ${paid.cans}, gw ${paid.goodwill}, rep ${paid.rep})`);
  ok(paid.forgot, 'the log still says she won\'t forget this');
  ok(paid.affinity === 6,
    `filling the ask moves Marisol 5 → 6, not a frozen 5 (${paid.affinity})`);

  // D — Ray and Dee remember their own asks
  const others = await t(() => {
    G.regulars = { marisol: 5, ray: 5, dee: 5 };
    G.food = 4; G.scraps = 4; G.goodwill = 0; G.rep = 20;
    G.favor = { who: 'ray', day: G.days };
    doFavor();
    const afterRay = { ray: G.regulars.ray, marisol: G.regulars.marisol, dee: G.regulars.dee };
    G.favor = { who: 'dee', day: G.days };
    doFavor();
    return { afterRay, dee: G.regulars.dee, food: G.food, scraps: G.scraps };
  });
  ok(others.afterRay.ray === 6 && others.afterRay.marisol === 5 && others.afterRay.dee === 5,
    `Ray's ask bumps Ray only (ray ${others.afterRay.ray}, marisol ${others.afterRay.marisol})`);
  ok(others.dee === 6 && others.food === 2 && others.scraps === 2,
    `Dee's ask bumps Dee only and spends the 2 scraps (dee ${others.dee})`);

  // E — refuse / lapse / cadence
  const gates = await t(() => {
    G.regulars = { marisol: 5, ray: 0, dee: 0 };
    G.favor = { who: 'marisol', day: 5 };
    G.cans = 1;
    doFavor();
    const short = { open: !!G.favor, cans: G.cans };
    G.days = 7;
    favorLapsed();
    const lapsed = G.favor === null;
    G.favor = null;
    G.lastFavorDay = 10;
    G.days = 12;
    maybePostFavor();
    const early = !!G.favor;
    G.days = 13;
    maybePostFavor();
    const next = G.favor && G.favor.who === 'marisol';
    return { short, lapsed, early, next };
  });
  ok(gates.short.open && gates.short.cans === 1, 'a short purse is refused; the ask stays on the books');
  ok(gates.lapsed, 'a favor left two days goes quietly unasked');
  ok(!gates.early && gates.next, 'the 3-day cadence still holds between asks');

  // F — isolation: Trade still names Marisol; Dee's latch is the same <30
  const iso = await t(() => {
    G.regulars = { marisol: 0, ray: 0, dee: 0 };
    G.cans = 30;
    finishAction(ACTIONS.find(a => a.id === 'trade'));
    const named = G.regulars.marisol;
    const src = String(regularFavorsAtDawn);
    return { named, deeLatch: /G\.health\s*<\s*30/.test(src) };
  });
  ok(iso.named === 1, `Trade still bumps Marisol (affinity ${iso.named})`);
  ok(iso.deeLatch, 'Dee\'s dawn latch is still health < 30 — HV-115 owns the shape');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
