/* HV-48 — the Bridge Ballad (classic-script page, no hook).
 * A. Constants hv-song/7+1; the 🎸 row and ballad2 goal stand; two
 *    tellings find no tune.
 * B. The dish scales with tellings, cap 5.
 * C. THE SEAM: with the ballad set, a playing pays and ticks the
 *    tally; the same session plays once.
 * D. A rearmed session pays again; two playings complete the goal.
 * Z. Zero page errors.
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
    if (!sessionStorage.getItem('hvballad-init')) {
      sessionStorage.setItem('hvballad-init', '1');
      localStorage.removeItem('hv-storyhour');
      localStorage.removeItem('hv-song');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — no tune yet
  const bare = await t(() => {
    saveHvStory({ tellings: 2 });
    saveHvSong({ plays: 0 });
    const set2 = balladSet();
    balladPlayed = false;
    G.food = 10;
    finishAction({ id: 'ballad' });
    return { key: HVSONG_KEY, base: HVSONG_BASE, per: HVSONG_PER,
      row: ACTIONS.some(a => a.id === 'ballad'),
      goal: GOALS.some(g => g.id === 'ballad2'),
      set2, food: G.food, plays: loadHvSong().plays };
  });
  ok(bare.key === 'hv-song' && bare.base === 7 && bare.per === 1 && bare.row && bare.goal,
    'hv-song at 7+1 — the 🎸 row and the ballad2 goal stand');
  ok(!bare.set2 && bare.food === 10 && bare.plays === 0,
    'two tellings find no tune — the playing refuses');

  // B — the dish scales with the tellings
  const dishes = await t(() => {
    saveHvStory({ tellings: 3 });
    const d3 = balladDish();
    saveHvStory({ tellings: 9 });
    const dCap = balladDish();
    saveHvStory({ tellings: 3 });
    return { d3, dCap, set: balladSet() };
  });
  ok(dishes.d3 === 10 && dishes.dCap === 12 && dishes.set,
    `the dish scales with tellings, capped at 5 (${dishes.d3}, ${dishes.dCap})`);

  // C — the seam
  const seam = await t(() => {
    balladPlayed = false;
    G.food = 10;
    finishAction({ id: 'ballad' });
    const food1 = G.food, plays1 = loadHvSong().plays;
    finishAction({ id: 'ballad' });
    return { food1, plays1, food2: G.food, plays2: loadHvSong().plays };
  });
  ok(seam.food1 === 20 && seam.plays1 === 1,
    `the playing pays and ticks the tally (food ${seam.food1}, plays ${seam.plays1})`);
  ok(seam.food2 === 20 && seam.plays2 === 1, 'the same session plays once');

  // D — rearm and the goal
  const goal = await t(() => {
    balladPlayed = false;
    G.food = 0;
    finishAction({ id: 'ballad' });
    const g = GOALS.find(x => x.id === 'ballad2');
    return { food: G.food, plays: loadHvSong().plays, done: g.value() >= g.target };
  });
  ok(goal.food === 10 && goal.plays === 2 && goal.done,
    'a rearmed session pays again — two playings complete the ballad2 goal');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
