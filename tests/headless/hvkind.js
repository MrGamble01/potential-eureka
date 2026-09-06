/*
 * HV-279 — Hand out flyers said the owner is kind, then Word
 * on the Street never heard the shop.
 *
 * The posting: a local shop pays, and the owner is kind.
 * Odd jobs already add +3 rep for honest work. The kind owner
 * is a second system — a shopkeeper who vouches. finishAction
 * treated flyers like Unload at the depot: the honest-work +3
 * and nothing for the shop.
 *
 * Marisol hearing the owner (#845) is not this card. Rain and
 * Gentrification are not this card. Depot is not this card.
 *
 *  A. Source: the odd-job payout names flyers and puts in a word.
 *  B. The posting still says the owner is kind.
 *  C. Flyers move Word one more than honest work.
 *  D. The depot still only gets honest work.
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
ok(/j\.id==='flyers'/.test(oddBlock) && /addRep\(1\)/.test(oddBlock)
    && /kind word/.test(oddBlock),
  'HV-279: flyers put in a kind word after honest work');
ok(/id:'flyers'/.test(config) && /the owner is kind/.test(config),
  'the posting still says the owner is kind');
ok(!/homeless-village\/js\/ui\.js/.test(player),
  'the kind word lives in finishAction — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvkind-init')) {
      sessionStorage.setItem('hvkind-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const flyers = await t(() => {
    G.days = 1;
    G.oddJobDay = -1;
    G.rep = 10;
    G.goodwill = 0;
    G.morale = 40;
    G.regulars = { marisol: 0, ray: 0, dee: 0 };
    finishAction(oddJobAction());
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      job: todaysJob().id,
      rep: G.rep,
      goodwill: G.goodwill,
      morale: G.morale,
      marisol: G.regulars.marisol,
      log,
    };
  });
  ok(flyers.job === 'flyers', 'day 1 is still Hand out flyers');
  ok(flyers.rep === 14 && flyers.goodwill === 3 && flyers.morale === 44,
    `flyers move Word +4 (honest 3 + kind 1) and still pay the shop (rep ${flyers.rep})`);
  ok(/kind word/.test(flyers.log),
    'the feed names the kind word the block heard');
  ok(flyers.marisol === 0,
    'Marisol hearing the owner is not this card');

  const depot = await t(() => {
    G.days = 0;
    G.oddJobDay = -1;
    G.rep = 10;
    G.goodwill = 0;
    finishAction(oddJobAction());
    return { job: todaysJob().id, rep: G.rep, goodwill: G.goodwill };
  });
  ok(depot.job === 'depot' && depot.rep === 13 && depot.goodwill === 5,
    `the depot still only gets honest work (rep ${depot.rep})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
