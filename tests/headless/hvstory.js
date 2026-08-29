/* HV-47 — the Fire Story (classic-script page, no hook).
 * A. Constants hv-storyhour/6+1; the 🔥 row and story2 goal stand;
 *    two sits leave the story unlearned.
 * B. The dish scales with sits, cap 5.
 * C. THE SEAM: with the story by heart, a telling pays and ticks
 *    the tally; the same session tells once.
 * D. A rearmed session pays again; two tellings complete the goal.
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
    if (!sessionStorage.getItem('hvstory-init')) {
      sessionStorage.setItem('hvstory-init', '1');
      localStorage.removeItem('hv-bench');
      localStorage.removeItem('hv-storyhour');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — nobody has the story yet
  const bare = await t(() => {
    saveHvBench({ sits: 2 });
    saveHvStory({ tellings: 0 });
    const heart2 = hvStoryByHeart();
    G.storyDay = -1;
    G.food = 10;
    finishAction({ id: 'story' });
    return { key: HVSTORY_KEY, base: HVSTORY_BASE, per: HVSTORY_PER,
      row: ACTIONS.some(a => a.id === 'story'),
      goal: GOALS.some(g => g.id === 'story2'),
      heart2, food: G.food, tellings: loadHvStory().tellings };
  });
  ok(bare.key === 'hv-storyhour' && bare.base === 6 && bare.per === 1 && bare.row && bare.goal,
    'hv-storyhour at 6+1 — the 🔥 row and the story2 goal stand');
  ok(!bare.heart2 && bare.food === 10 && bare.tellings === 0,
    'two sits leave the story unlearned — the telling refuses');

  // B — the dish scales with the sits
  const dishes = await t(() => {
    saveHvBench({ sits: 3 });
    const d3 = hvStoryDish();
    saveHvBench({ sits: 9 });
    const dCap = hvStoryDish();
    saveHvBench({ sits: 3 });
    return { d3, dCap, heart: hvStoryByHeart() };
  });
  ok(dishes.d3 === 9 && dishes.dCap === 11 && dishes.heart,
    `the dish scales with sits, capped at 5 (${dishes.d3}, ${dishes.dCap})`);

  // C — the seam
  const seam = await t(() => {
    G.storyDay = -1;
    G.food = 10;
    finishAction({ id: 'story' });
    const food1 = G.food, tellings1 = loadHvStory().tellings;
    finishAction({ id: 'story' });
    return { food1, tellings1, food2: G.food, tellings2: loadHvStory().tellings };
  });
  ok(seam.food1 === 19 && seam.tellings1 === 1,
    `the telling pays and ticks the tally (food ${seam.food1}, tellings ${seam.tellings1})`);
  ok(seam.food2 === 19 && seam.tellings2 === 1, 'the same session tells once');

  // D — rearm and the goal
  const goal = await t(() => {
    G.storyDay = -1;
    G.food = 0;
    finishAction({ id: 'story' });
    const g = GOALS.find(x => x.id === 'story2');
    return { food: G.food, tellings: loadHvStory().tellings, done: g.value() >= g.target };
  });
  ok(goal.food === 9 && goal.tellings === 2 && goal.done,
    'a rearmed session pays again — two tellings complete the story2 goal');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
