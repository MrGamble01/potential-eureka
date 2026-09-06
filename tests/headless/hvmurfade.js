/* HV-110 — Word faded, and the unfinished mural went with it.
 *
 * The session button is labeled Paint the mural (N/4). The tooltip
 * says one session a day on the underpass wall. Known unlocks the
 * first panel. After that, a dawn's −1 fade can drop the camp back
 * to A Stranger — and muralAvailable() hid the button with panels
 * still bare. The wall does not retire until the fourth panel is up.
 *
 *  A. Source: muralAvailable stays true on an in-progress wall
 *     even when word has faded below Known.
 *  B. The tooltip still says one session a day.
 *  C. Fresh: mural 0, a stranger, no button.
 *  D. Known (25) shows the button. A stranger at 24 still does not.
 *  E. After panel 1, word at 24 — the button stays, and a session
 *     still paints panel 2.
 *  F. Four panels still retire the button.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives muralAvailable / buildActionUI / finishAction.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const avail = /function muralAvailable\(\)\{([^}]+)\}/.exec(cfg);
ok(!!avail, 'muralAvailable is still in config.js');
ok(avail && /\(G\.mural\s*\|\|\s*0\)\s*>\s*0/.test(avail[1]),
  'HV-110: an in-progress mural stays offered after word fades');
ok(/One session a day on the underpass wall/.test(cfg),
  'the tooltip still says one session a day');

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
    if (!sessionStorage.getItem('hvmurfade-init')) {
      sessionStorage.setItem('hvmurfade-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const tip = await t(() => muralAction().tooltip);
  ok(/one session a day/i.test(tip),
    `the live tooltip still says one session a day (${tip.slice(0, 60)})`);

  const fresh = await t(() => {
    G.rep = 0; G.mural = 0; G.muralDay = -1;
    buildActionUI();
    return { btn: !!document.getElementById('action-mural'), avail: muralAvailable() };
  });
  ok(!fresh.btn && !fresh.avail, 'fresh camp: a stranger with no paint has no session');

  const known = await t(() => {
    G.rep = 25; G.mural = 0;
    buildActionUI();
    const at25 = !!document.getElementById('action-mural');
    G.rep = 24;
    buildActionUI();
    const at24 = !!document.getElementById('action-mural');
    return { at25, at24, label: document.getElementById('action-mural') && document.getElementById('action-mural').textContent };
  });
  ok(known.at25 && !known.at24,
    'Known unlocks the first panel; 24 rep with no paint still hides it');

  const faded = await t(() => {
    G.rep = 25; G.mural = 0; G.muralDay = -1; G.days = 3;
    G.scraps = 10; G.morale = 50; G.goalIndex = GOALS.length;
    buildActionUI();
    finishAction(muralAction());
    const afterPaint = { mural: G.mural, rep: G.rep };
    G.rep = 24;
    buildActionUI();
    const btn = document.getElementById('action-mural');
    G.days = 4; G.muralDay = -1;
    finishAction(muralAction());
    return {
      afterPaint,
      fadedBtn: !!btn,
      fadedLabel: btn ? btn.textContent.trim() : '',
      fadedAvail: muralAvailable(),
      mural: G.mural,
      scraps: G.scraps,
    };
  });
  ok(faded.afterPaint.mural === 1,
    `the first session paints panel 1 (mural ${faded.afterPaint.mural})`);
  ok(faded.fadedBtn && faded.fadedAvail && /1\/4/.test(faded.fadedLabel),
    `HV-110: word at 24 still offers Paint the mural (1/4) (${faded.fadedLabel})`);
  ok(faded.mural === 2 && faded.scraps === 6,
    `and the faded session still paints panel 2 (mural ${faded.mural}, scraps ${faded.scraps})`);

  const done = await t(() => {
    G.rep = 20; G.mural = 4; G.scraps = 10;
    buildActionUI();
    return { btn: !!document.getElementById('action-mural'), avail: muralAvailable() };
  });
  ok(!done.btn && !done.avail, 'four panels still retire the button, faded or not');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
