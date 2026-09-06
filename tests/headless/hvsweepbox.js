/* HV-96 — Tool Box said the workbench never falls apart,
 * and the sweep smashed it.
 *
 * The Tool Box recipe promises: "the workbench never falls apart
 * again." Dawn wobble already honors that (HV-24). City Sweep still
 * rolled a 50% smash with no toolbox check and logged "Workbench
 * smashed." hvtoolbox never fires the sweep. #742 is sweep cans.
 * #746 is the tent / Patch Shelter.
 *
 * Write-first, hook-free, source-driven.
 *
 * A. The recipe still says never falls apart. The sweep's workbench
 *    roll reads the toolbox. ui.js is not touched. Dawn wobble and
 *    the odd-job +2 stay on HV-24.
 * B. Live: a smash roll with the box leaves the bench standing and
 *    ticks the save tally. Without the box the same roll smashes it.
 *    A tent still falls — that is not this ticket.
 *
 * Named assertion: HV-96: Tool Box said the workbench never falls apart and the sweep smashed it
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg    = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const loop   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui     = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const recAt = cfg.indexOf("id:'toolbox'");
const rec = recAt >= 0 ? cfg.slice(recAt, recAt + 360) : '';
const swAt = loop.indexOf("id:'sweep'");
const sw = swAt >= 0 ? loop.slice(swAt, swAt + 900) : '';
const smashAt = sw.indexOf('workbench');
const smash = smashAt >= 0 ? sw.slice(smashAt, smashAt + 420) : '';

(async () => {
  ok(/never falls apart/i.test(rec),
     `the Tool Box still promises the workbench never falls apart (got ${JSON.stringify((rec.match(/desc:'[^']+'/)||[''])[0])})`);

  ok(/toolbox/.test(smash),
     'the sweep smash honors the toolbox — not a free coin-flip');

  ok(!/toolbox/.test(ui) && !/Workbench smashed/.test(ui),
     'ui.js is not this ticket — it still only paints the craft row');

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.addInitScript(() => {
    try { localStorage.setItem('hv-intro-seen', '1'); } catch (e) {}
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => ({
    intro: !!(document.getElementById('intro-modal') && document.getElementById('intro-modal').classList.contains('open')),
    rec: !!(typeof RECIPES !== 'undefined' && RECIPES.some(r => r.id === 'toolbox')),
    sweep: !!(typeof EVENTS_BAD !== 'undefined' && EVENTS_BAD.some(e => e.id === 'sweep')),
    box: !!G.structures.toolbox,
  }));
  ok(!boot.intro && boot.rec && boot.sweep,
     'a returning camp can build the Tool Box and draw a sweep');
  ok(!boot.box,
     'a fresh camp has no toolbox yet');

  const runSweep = (box) => page.evaluate((box) => {
    const ev = EVENTS_BAD.find(e => e.id === 'sweep');
    const real = Math.random;
    Math.random = () => 0;
    G.structures.workbench = true;
    G.structures.toolbox = box;
    G.structures.tent = true;
    G.structures.soup_kitchen = false;
    G.structures.garden = false;
    G.structures.stash = false;
    G.garageCover = false;
    G.packedUp = false;
    G.benchSaves = 0;
    G.scraps = 20; G.food = 20; G.cans = 20;
    G.morale = 80;
    ev.effect();
    Math.random = real;
    return {
      bench: !!G.structures.workbench,
      tent: !!G.structures.tent,
      saves: G.benchSaves || 0,
    };
  }, box);

  const bare = await runSweep(false);
  ok(!bare.bench,
     `without the box the smash roll still takes the bench (bench ${bare.bench})`);
  ok(!bare.tent,
     `a tent still falls — Patch Shelter is not this ticket (tent ${bare.tent})`);

  const boxed = await runSweep(true);
  ok(boxed.bench && boxed.saves === 1,
     `HV-96: Tool Box said the workbench never falls apart and the sweep smashed it (bench ${boxed.bench}, saves ${boxed.saves})`);
  ok(!boxed.tent,
     'the box does not save the tent');

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
