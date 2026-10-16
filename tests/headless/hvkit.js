/*
 * HV-254 — City Sweep said confiscate supplies, then left the tool box.
 *
 * The Tool Box is good tools, oiled and kept. City Sweep says they
 * destroy shelters and confiscate supplies. A kit sitting in camp is
 * a supply. The raid smashed tents and took scraps and food, and left
 * the box on the bench.
 *
 * The workbench-never-falls-apart perk is not this card. Guitar,
 * coats, radio, and rainfall are not this card. Theft leaving the
 * box is not this card.
 *
 *  A. Source: the Tool Box is still a kit of tools.
 *  B. Source: the sweep effect takes the box.
 *  C. A camp with a box loses it on the sweep.
 *  D. No box: the sweep still takes goods and does not invent a kit.
 *  E. The odd-job bonus is gone once the box is gone.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives triggerEvent() on the production sweep card.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const config = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const sweepAt = loop.indexOf("id:'sweep'");
const snapAt = loop.indexOf("id:'cold_snap'");
const sweepBlock = sweepAt >= 0 && snapAt > sweepAt ? loop.slice(sweepAt, snapAt) : '';
const boxRec = /id:'toolbox'[\s\S]{0,280}?desc:'([^']+)'/.exec(config);

ok(!!boxRec && /tools/.test(boxRec[1]),
  'the Tool Box still claims good tools, oiled and kept');
ok(sweepAt >= 0 && /confiscate supplies/.test(sweepBlock),
  'the sweep card still says they confiscate supplies');
ok(/structures\.toolbox\s*=\s*false/.test(sweepBlock),
  'HV-254: the sweep effect takes the tool box');
ok(!/homeless-village\/js\/ui\.js/.test(loop) && !/homeless-village\/js\/ui\.js/.test(config),
  'the raid lives on the sweep card — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvkit-init')) {
      sessionStorage.setItem('hvkit-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const raid = await t(() => {
    const real = Math.random; Math.random = () => 0.5;
    G.structures.toolbox = true;
    G.structures.tent = false;
    G.structures.soup_kitchen = false;
    G.structures.workbench = true;
    G.structures.garden = false;
    G.garageCover = false;
    G.packedUp = false;
    G.dog = 0;
    G.scraps = 20; G.food = 20; G.morale = 50;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(EVENTS_BAD.find(e => e.id === 'sweep'), false);
    Math.random = real;
    const lines = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    return {
      box: G.structures.toolbox,
      bench: G.structures.workbench,
      scraps: G.scraps,
      food: G.food,
      log: lines.join(' '),
    };
  });
  ok(!raid.box,
    `HV-254: the sweep takes the tool box (box=${raid.box})`);
  ok(/tool box/.test(raid.log),
    `the log names the kit (${raid.log.slice(-80)})`);
  ok(raid.bench,
    `a 0.5 roll still leaves the workbench (bench=${raid.bench})`);
  ok(raid.scraps < 20 && raid.food < 20,
    `the sweep still takes goods (scraps=${raid.scraps}, food=${raid.food})`);

  const bare = await t(() => {
    const real = Math.random; Math.random = () => 0.5;
    const heard = [];
    const realLog = window.log;
    window.log = function (msg) { heard.push(String(msg)); return realLog.apply(this, arguments); };
    G.structures.toolbox = false;
    G.structures.tent = false;
    G.structures.soup_kitchen = false;
    G.structures.workbench = false;
    G.structures.garden = false;
    G.garageCover = false;
    G.packedUp = false;
    G.scraps = 20; G.food = 20; G.morale = 50;
    triggerEvent(EVENTS_BAD.find(e => e.id === 'sweep'), false);
    window.log = realLog;
    Math.random = real;
    return {
      box: G.structures.toolbox,
      scraps: G.scraps,
      named: heard.filter(l => /tool box/i.test(l)).length,
    };
  });
  ok(!bare.box && bare.scraps < 20 && bare.named === 0,
    `no box: the sweep still takes goods and does not invent a kit (scraps=${bare.scraps}, named=${bare.named})`);

  const bonus = await t(() => {
    G.days = 3;
    G.structures.toolbox = false;
    G.oddJobDay = -1;
    G.goodwill = 0;
    finishAction(oddJobAction());
    return { gw: G.goodwill, job: todaysJob().id };
  });
  ok(bonus.job === 'scrapyd' && bonus.gw === 0,
    `once the box is gone the odd-job bonus is gone (gw=${bonus.gw})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
