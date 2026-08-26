/* HV-54 — the Empty Hook: the bridge's first standing effect
 * (classic-script page, no hook needed).
 * A. Constants hv-emptyhook/3 sits easing 2; the hook1 goal stands;
 *    two sits hang nothing and the season drain is untouched.
 * B. Hanging it early is refused outright.
 * C. THE SEAM: the third sit hangs it on its own, and the season's
 *    base drain comes down 2 in every season.
 * D. It eases the BASE only — the weather's bite and the snap's extra
 *    are the coat rack's job and stay exactly where they were.
 * E. A second hang is a no-op; the hook survives a reload.
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
    if (!sessionStorage.getItem('hvhook-init')) {
      sessionStorage.setItem('hvhook-init', '1');
      localStorage.removeItem('hv-drycorner');
      localStorage.removeItem('hv-emptyhook');
      localStorage.removeItem('hv-mark');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A
  const bare = await t(() => {
    saveHvDry({ built: true, sits: 2 });
    saveHvHook({ up: false });
    G.season = 0;
    const summer = seasonDrain();
    G.season = 3;
    const winter = seasonDrain();
    return { key: HVHOOK_KEY, at: HVHOOK_AT, ease: HVHOOK_EASE,
      goal: GOALS.some(g => g.id === 'hook1'),
      earned: hookEarned(), up: hookUp(), summer, winter };
  });
  ok(bare.key === 'hv-emptyhook' && bare.at === 3 && bare.ease === 2 && bare.goal,
    'hv-emptyhook at three sits easing 2 — the Empty Hook and its hook1 goal stand');
  ok(!bare.earned && !bare.up && bare.summer === 8 && bare.winter === 18,
    'two sits hang nothing — the season drain is still the bare 8 and 18');

  // B
  const noHang = await t(() => ({ r: maybeHangTheHook(), up: hookUp() }));
  ok(noHang.r === false && !noHang.up,
    'hanging it early is refused outright — it is not something you can force');

  const earned = await t(() => {
    saveHvDry({ built: true, sits: 3 });
    G.season = 3;
    return { earned: hookEarned(), up: hookUp(), winter: seasonDrain() };
  });
  ok(earned.earned && !earned.up && earned.winter === 18,
    'the third sit earns it, but nothing eases until the blanket is on the hook');

  // C
  const hung = await t(() => {
    const r = maybeHangTheHook();
    G.season = 0; const summer = seasonDrain();
    G.season = 1; const autumn = seasonDrain();
    G.season = 3; const winter = seasonDrain();
    return { r, up: hookUp(), summer, autumn, winter, rec: loadHvHook() };
  });
  ok(hung.r === true && hung.up && hung.rec.up === true,
    'hung, and the record says so in its own key');
  ok(hung.winter === 16 && hung.summer === 6 && hung.autumn === 6,
    `every season's base drain comes down exactly 2 (winter 18→${hung.winter}, others 8→${hung.summer})`);

  // D — the coat rack's half of the formula must be untouched.
  const disjoint = await t(() => {
    // The rack blunts the weather's bite and the snap's extra; the
    // hook is written to never reach either.
    const before = { cut: COATS_CUT, snap: SNAP_WARMTH,
      coldBite: WEATHERS.cold.warmth, rainBite: WEATHERS.rain.warmth,
      heatGift: WEATHERS.heat.warmth };
    return before;
  });
  ok(disjoint.cut === 0.5 && disjoint.snap === 10 && disjoint.coldBite === 12
     && disjoint.rainBite === 5 && disjoint.heatGift === -8,
    'the weather bites, the snap extra and the rack cut are all exactly where they were — the hook only moved the base');
  ok(disjoint.heatGift < 0,
    "and a heat wave still gives warmth back rather than taking it — the hook never turned a gift into a drain");

  // E
  const again = await t(() => {
    const r = maybeHangTheHook();
    G.season = 3;
    return { r, up: hookUp(), winter: seasonDrain() };
  });
  ok(again.r === false && again.up && again.winter === 16,
    'it hangs once and stays up — a second hang is a no-op, not a double easing');

  const goal = await t(() => {
    const g = GOALS.find(x => x.id === 'hook1');
    saveHvHook({ up: false });
    const before = g.value();
    saveHvHook({ up: true });
    return { before, after: g.value(), target: g.target };
  });
  ok(goal.before === 0 && goal.after >= goal.target,
    'hanging the hook completes the hook1 goal');

  // The seam, driven for real.
  const seam = await t(() => {
    // The dry corner only answers once three names are on the wall —
    // without that the action refuses before it ever reaches the sit.
    saveHvMark({ names: 3 });
    saveHvDry({ built: true, sits: 2 });
    saveHvHook({ up: false });
    drySat = false;
    G.food = 10;
    finishAction({ id: 'dry' });
    G.season = 3;
    return { sits: loadHvDry().sits, up: hookUp(), winter: seasonDrain() };
  });
  ok(seam.sits === 3 && seam.up && seam.winter === 16,
    'the sit that makes three hangs the hook on its own — no separate button to find');

  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const after = await t(() => {
    G.season = 3;
    return { up: hookUp(), winter: seasonDrain(), earned: hookEarned() };
  });
  ok(after.up && after.winter === 16 && after.earned,
    'the hook survives a reload — this one has no session latch to lose');

  ok(errs.length === 0, `no page errors (${errs.length ? errs[0] : 'clean'})`);

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
