/* VOX-49 — the Bare Line: the shore's first standing effect
 * (classic-script page, no hook needed).
 * A. Constants vox-bareline/3 sits adding +0.2; the ach stands; two
 *    sittings hang nothing and WORKER_SPEED() is untouched.
 * B. Hanging it early is refused outright.
 * C. THE SEAM: the third sitting hangs it, and every hand quickens.
 * D. It ADDS to the Tavern's step rather than replacing it — proved
 *    with the tavern both absent and present.
 * E. A second hang is a no-op; the line survives a reload.
 * Z. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };
const near = (a, b) => Math.abs(a - b) < 1e-9;

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('voxline-init')) {
      sessionStorage.setItem('voxline-init', '1');
      localStorage.removeItem('vox-longshed');
      localStorage.removeItem('vox-bareline');
      localStorage.removeItem('vox-mark');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A
  const bare = await t(() => {
    saveShed({ built: true, sits: 2 });
    saveLine({ up: false });
    state.buildings = state.buildings || {};
    delete state.buildings.tavern;
    return { key: LINE_KEY, at: LINE_AT, step: LINE_SPEED,
      ach: ACH.some(a => a[0] === 'bare_line'),
      earned: lineEarned(), up: lineUp(), bonus: lineSpeedBonus(),
      speed: WORKER_SPEED() };
  });
  ok(bare.key === 'vox-bareline' && bare.at === 3 && bare.step === 0.2 && bare.ach,
    'vox-bareline at three sittings adding +0.2 — the Bare Line is registered');
  ok(!bare.earned && !bare.up && bare.bonus === 0 && near(bare.speed, 1.9),
    'two sittings hang nothing — hands still walk at the bare 1.9');

  // B
  const noHang = await t(() => ({ r: maybeHangTheLine(), up: lineUp(), speed: WORKER_SPEED() }));
  ok(noHang.r === false && !noHang.up && near(noHang.speed, 1.9),
    'hanging it early is refused outright — it is not something you can force');

  const earned = await t(() => {
    saveShed({ built: true, sits: 3 });
    return { earned: lineEarned(), up: lineUp(), speed: WORKER_SPEED() };
  });
  ok(earned.earned && !earned.up && near(earned.speed, 1.9),
    'the third sitting earns it, but nobody moves quicker until the coil is on the cleat');

  // C
  const hung = await t(() => {
    const r = maybeHangTheLine();
    return { r, up: lineUp(), bonus: lineSpeedBonus(), speed: WORKER_SPEED(), rec: loadLine() };
  });
  ok(hung.r === true && hung.up && hung.rec.up === true,
    'hung, and the record says so in its own key');
  ok(hung.bonus === 0.2 && near(hung.speed, 2.1),
    `every hand on the isle quickens from 1.9 to ${hung.speed} — forever, on every isle`);

  // D — it must ADD to the tavern rather than replace it.
  const stacks = await t(() => {
    state.buildings.tavern = true;
    const withTavern = WORKER_SPEED();
    saveLine({ up: false });
    const tavernOnly = WORKER_SPEED();
    saveLine({ up: true });
    delete state.buildings.tavern;
    const lineOnly = WORKER_SPEED();
    saveLine({ up: false });
    const neither = WORKER_SPEED();
    saveLine({ up: true });
    return { withTavern, tavernOnly, lineOnly, neither };
  });
  ok(near(stacks.neither, 1.9) && near(stacks.tavernOnly, 2.1) && near(stacks.lineOnly, 2.1),
    `the tavern alone and the line alone are each worth the same step (${stacks.tavernOnly}, ${stacks.lineOnly})`);
  ok(near(stacks.withTavern, 2.3) && near(stacks.withTavern - stacks.tavernOnly, 0.2),
    `and together they stack rather than overlapping (tavern ${stacks.tavernOnly} + line = ${stacks.withTavern})`);

  // E
  const again = await t(() => ({ r: maybeHangTheLine(), up: lineUp(), speed: WORKER_SPEED() }));
  ok(again.r === false && again.up && near(again.speed, 2.1),
    'it hangs once and stays up — a second hang is a no-op, not a double step');

  const achv = await t(() => {
    const a = ACH.find(x => x[0] === 'bare_line');
    saveLine({ up: false });
    const before = a[3]();
    saveLine({ up: true });
    return { before, after: a[3]() };
  });
  ok(!achv.before && achv.after, 'hanging the line crowns The Bare Line');

  // The seam, driven for real.
  const seam = await t(() => {
    saveMark({ knots: 3 });
    saveShed({ built: true, sits: 2 });
    saveLine({ up: false });
    shedSat = false;
    state.coins = 5000;
    useLongShed();
    return { sits: loadShed().sits, up: lineUp(), speed: WORKER_SPEED() };
  });
  ok(seam.sits === 3 && seam.up && near(seam.speed, 2.1),
    'the sitting that makes three hangs the line on its own — no separate chip to find');

  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const after = await t(() => ({ up: lineUp(), bonus: lineSpeedBonus(), earned: lineEarned() }));
  ok(after.up && after.bonus === 0.2 && after.earned,
    'the line survives a reload — it carries to every isle that rises after');

  ok(errs.length === 0, `no page errors (${errs.length ? errs[0] : 'clean'})`);

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
