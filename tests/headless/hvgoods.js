/* HV-73 — Deposit Run and Make Room stayed greyed out after you earned
 * the goods for them.
 *
 * Both buttons are gated on the purse, and both read it only inside
 * buildActionUI — which runs at dawn or after a once-a-day action.
 * With the cart built and three cans, the rail said "Deposit run (3🫙)"
 * and greyed the button out. Scavenge up to seven and it still said
 * three, still greyed out, until the next morning. Make Room did the
 * same with the newcomer's 6 food + 4 wood, against a three-day ask.
 *
 *  A. Source-scoped: the refresh lives in player.js and main.js's frame
 *     calls it — ui.js is untouched.
 *  B. Deposit: with the cart and 3 cans the run is greyed out and reads
 *     (3🫙). Seven cans later — no rebuild — it reads (7🫙), is enabled,
 *     and carries the run's tooltip. Back under five, it greys out again.
 *  C. Make Room: an open ask with an empty pantry is greyed out; 6 food
 *     and 4 wood later — no rebuild — a click on the button starts the
 *     welcome.
 *  D. Drift guard: after a refresh, a full buildActionUI paints the same
 *     button (label, tooltip, disabled, opacity) — the mirrored copy in
 *     player.js cannot quietly disagree with ui.js.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives buildActionUI, G, and the live frame loop.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  // A — source-scoped
  const ROOT = path.resolve(__dirname, '..', '..');
  const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
  const main = fs.readFileSync(path.join(ROOT, 'homeless-village/js/main.js'), 'utf8');
  const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
  ok(/function updateGoodsGates\(\)/.test(player), 'player.js defines updateGoodsGates()');
  const frameBody = main.slice(main.indexOf('function frame(ts)'));
  ok(/updateScavengeGate\(\);\s*\n\s*updateGoodsGates\(\);/.test(frameBody),
    'main.js frame() calls updateGoodsGates() right after the scavenge gate');
  ok(!/updateGoodsGates/.test(ui), 'ui.js is untouched by the refresh');

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvgoods-init')) {
      sessionStorage.setItem('hvgoods-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);
  const frames = () => page.waitForTimeout(250);   // a handful of frames for the gate to notice

  const readBtn = id => page.evaluate(id => {
    const b = document.getElementById('action-' + id);
    if (!b) return null;
    return { text: b.textContent.trim(), tip: b.getAttribute('data-tip'), disabled: b.disabled, opacity: b.style.opacity };
  }, id);

  // B — the deposit run follows the live can count
  await t(() => {
    G.structures.cart = true; G.cans = 3; G.depositDay = -9; G.cooldowns = {};
    buildActionUI();
  });
  const short = await readBtn('deposit');
  ok(short && short.disabled && /\(3🫙\)/.test(short.text) && /Not worth the walk/.test(short.tip),
    `with the cart and 3 cans the run is greyed out and reads (3🫙) (got ${JSON.stringify(short)})`);

  // The tell of the old bug: the cans arrive, nothing rebuilds the rail.
  await t(() => { G.cans = 7; });
  await frames();
  const funded = await readBtn('deposit');
  ok(funded && !funded.disabled,
    `HV-73: seven cans later the run is no longer greyed out — no rebuild (disabled=${funded && funded.disabled})`);
  ok(funded && /\(7🫙\)/.test(funded.text),
    `and the label reads the live count (7🫙) (got ${JSON.stringify(funded && funded.text)})`);
  ok(funded && /redemption center/.test(funded.tip) && funded.opacity === '',
    `and it carries the run's tooltip at full opacity (tip=${JSON.stringify(funded && funded.tip)}, opacity=${JSON.stringify(funded && funded.opacity)})`);

  // Back under five — a trade, a theft — and it greys out again.
  await t(() => { G.cans = 2; });
  await frames();
  const drained = await readBtn('deposit');
  ok(drained && drained.disabled && /\(2🫙\)/.test(drained.text) && /Not worth the walk/.test(drained.tip),
    `back under five cans the run greys out again and reads (2🫙) (got ${JSON.stringify(drained)})`);

  // The day guard still wins: a run already made today stays greyed
  // out however many cans come in.
  await t(() => { G.cans = 12; G.depositDay = G.days; });
  await frames();
  const done = await readBtn('deposit');
  ok(done && done.disabled && /✓/.test(done.text) && /rests till dawn/.test(done.tip),
    `a run already made today stays greyed out at 12 cans (got ${JSON.stringify(done)})`);

  // C — make room follows the pantry, and the click goes through
  await t(() => {
    G.depositDay = -9;
    G.newcomerAsk = { day: G.days }; G.food = 0; G.wood = 0; G.population = 2;
    G.structures.tent = true; G.cooldowns = {};
    buildActionUI();
  });
  const bare = await readBtn('newcomer');
  ok(bare && bare.disabled && /A bed takes 6 food and 4 wood/.test(bare.tip),
    `an open ask with an empty pantry is greyed out (got ${JSON.stringify(bare)})`);

  await t(() => { G.food = 6; G.wood = 4; });
  await frames();
  const stocked = await readBtn('newcomer');
  ok(stocked && !stocked.disabled && /edge of the light/.test(stocked.tip) && stocked.opacity === '',
    `HV-73: 6 food and 4 wood later Make Room is live — no rebuild (got ${JSON.stringify(stocked)})`);

  await page.click('#action-newcomer');
  const clicked = await t(() => ({
    job: !!activeJobs.newcomer,
    btnDisabled: document.getElementById('action-newcomer').disabled,
    active: document.getElementById('action-newcomer').classList.contains('active-job'),
  }));
  ok(clicked.job && clicked.btnDisabled && clicked.active,
    `a click on the live button starts the welcome (job=${clicked.job}, busy=${clicked.active})`);
  // While the job runs the gate leaves the button alone (doAction owns it).
  await frames();
  const running = await readBtn('newcomer');
  ok(running && running.disabled, 'the gate does not re-enable a button mid-job');
  await t(() => { delete activeJobs.newcomer; G.newcomerAsk = null; buildActionUI(); });

  // D — drift guard: a refresh and a rebuild paint the same button
  await t(() => {
    G.structures.cart = true; G.cans = 1; G.depositDay = -9;
    G.newcomerAsk = { day: G.days }; G.food = 1; G.wood = 1;
    buildActionUI();
    G.cans = 9; G.food = 8; G.wood = 5;
  });
  await frames();
  const refreshed = { d: await readBtn('deposit'), n: await readBtn('newcomer') };
  await t(() => buildActionUI());
  const rebuilt = { d: await readBtn('deposit'), n: await readBtn('newcomer') };
  ok(JSON.stringify(refreshed.d) === JSON.stringify(rebuilt.d),
    `deposit: the refresh and a full rebuild paint the same button (${JSON.stringify(refreshed.d)})`);
  ok(JSON.stringify(refreshed.n) === JSON.stringify(rebuilt.n),
    `make room: the refresh and a full rebuild paint the same button (${JSON.stringify(refreshed.n)})`);
  // And the short states agree too.
  await t(() => { G.cans = 4; G.food = 5; });
  await frames();
  const refShort = { d: await readBtn('deposit'), n: await readBtn('newcomer') };
  await t(() => buildActionUI());
  const rebShort = { d: await readBtn('deposit'), n: await readBtn('newcomer') };
  ok(JSON.stringify(refShort.d) === JSON.stringify(rebShort.d) && JSON.stringify(refShort.n) === JSON.stringify(rebShort.n),
    'the short states agree between refresh and rebuild as well');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
