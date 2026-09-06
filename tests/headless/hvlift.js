/*
 * HV-231 — Unload at the depot said a morning of honest lifting,
 * then Word on the Street never heard the honest day.
 *
 * The posting: a morning of honest lifting. The deposit run already
 * names industry when the block notices (+1 Word per 10 cans). The
 * depot odd job paid the same honest-work +3 every posting gets and
 * never named Word. Flyers' kind owner is HV-279 / #922 — that
 * card already puts in a shop word. Cold morning and night are
 * not this card.
 *
 *  A. Source: the odd-job payout names depot and notices industry.
 *  B. The posting still says honest lifting.
 *  C. Depot moves Word one more than honest work.
 *  D. Flyers still get the kind-owner Word, not industry.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction on the production odd-job row.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const config = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const oddAt = player.indexOf("} else if(a.id==='oddjob'){");
const muralAt = player.indexOf("} else if(a.id==='mural'){");
const oddBlock = oddAt >= 0 && muralAt > oddAt ? player.slice(oddAt, muralAt) : '';

ok(oddAt >= 0 && /addRep\(3\)/.test(oddBlock),
  'odd jobs still pay the honest-work +3 Word');
ok(/j\.id==='depot'/.test(oddBlock) && /addRep\(1\)/.test(oddBlock)
    && /notices industry/.test(oddBlock),
  'HV-231: the depot notices industry after honest work');
ok(/id:'depot'/.test(config) && /honest lifting/.test(config),
  'the posting still says a morning of honest lifting');
ok(!/homeless-village\/js\/ui\.js/.test(player),
  'the industry word lives in finishAction — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvlift-init')) {
      sessionStorage.setItem('hvlift-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const depot = await t(() => {
    G.days = 0;
    G.oddJobDay = -1;
    G.rep = 10;
    G.goodwill = 0;
    finishAction(oddJobAction());
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      job: todaysJob().id,
      rep: G.rep,
      goodwill: G.goodwill,
      log,
    };
  });
  ok(depot.job === 'depot', 'day 0 is still Unload at the depot');
  ok(depot.rep === 14 && depot.goodwill === 5,
    `depot moves Word +4 (honest 3 + industry 1) and still pays the lift (rep ${depot.rep})`);
  ok(/notices industry/.test(depot.log),
    'the feed names the industry the block noticed');

  const flyers = await t(() => {
    G.days = 1;
    G.oddJobDay = -1;
    G.rep = 10;
    G.goodwill = 0;
    G.morale = 40;
    finishAction(oddJobAction());
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return { job: todaysJob().id, rep: G.rep, goodwill: G.goodwill, log };
  });
  ok(flyers.job === 'flyers' && flyers.rep === 14 && flyers.goodwill === 3
      && !/notices industry/.test(flyers.log),
    `flyers still get the kind-owner Word (HV-279) — not industry (rep ${flyers.rep})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
