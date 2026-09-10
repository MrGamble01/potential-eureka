/*
 * HV-256 — Community Grant said civic, then a rainy delivery
 * still paid a dry-day crate.
 *
 * The grant is a one-time neighborhood drop: +8 food, +8 wood,
 * +8 scraps delivered. Rain soaks an outdoor crate. The petition
 * still paid the full dry-day load.
 *
 * Kind Stranger rain is not this card. The potluck is not this
 * card. Grant × sweep (#919) is confiscation, not weather. A
 * clear delivery still pays +8. Heat is not this card. ui.js
 * is not this ticket.
 *
 *  A. Source: the grant still claims +8 food / wood / scraps.
 *  B. Source: a rainy delivery halves the crate.
 *  C. A rainy grant pays +4 / +4 / +4.
 *  D. A clear grant still pays +8 / +8 / +8.
 *  E. Kind Stranger rain is still a full food drop.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives the production doPetition('grant').
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
const grantAt = player.indexOf("if(id==='grant')");
const grant = grantAt >= 0 ? player.slice(grantAt, grantAt + 700) : '';

ok(/id:'grant'/.test(config) && /\+8 food, \+8 wood, \+8 scraps delivered/.test(config),
  'the grant is still +8 food, +8 wood, +8 scraps delivered');
ok(/weather==='rain'/.test(grant) && /gf=4/.test(grant),
  'HV-256: a rainy delivery halves the crate');
ok(!/homeless-village\/js\/ui\.js/.test(player) && !/homeless-village\/js\/ui\.js/.test(config),
  'the cut lives on doPetition — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvgrant-init')) {
      sessionStorage.setItem('hvgrant-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const wet = await t(() => {
    G.rep = 50; G.goodwill = 30;
    G.food = 0; G.wood = 0; G.scraps = 0;
    G.weather = 'rain';
    G.petitions = {};
    G.goalIndex = GOALS.length;
    doPetition('grant');
    const lines = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    return {
      food: G.food, wood: G.wood, scraps: G.scraps, goodwill: G.goodwill,
      won: !!G.petitions.grant,
      last: lines[lines.length - 1] || '',
    };
  });
  ok(wet.won && wet.goodwill === 0,
    `a rainy grant still spends 30 goodwill and wins the row (${wet.goodwill})`);
  ok(wet.food === 4 && wet.wood === 4 && wet.scraps === 4,
    `HV-256: a rainy crate is +4 / +4 / +4 (${wet.food}/${wet.wood}/${wet.scraps})`);
  ok(/rain/i.test(wet.last),
    `the last line names the rain (${wet.last})`);

  const dry = await t(() => {
    G.rep = 50; G.goodwill = 30;
    G.food = 0; G.wood = 0; G.scraps = 0;
    G.weather = 'clear';
    G.petitions = {};
    doPetition('grant');
    return { food: G.food, wood: G.wood, scraps: G.scraps, goodwill: G.goodwill };
  });
  ok(dry.food === 8 && dry.wood === 8 && dry.scraps === 8 && dry.goodwill === 0,
    `a clear crate is still +8 / +8 / +8 (${dry.food}/${dry.wood}/${dry.scraps})`);

  const heat = await t(() => {
    G.rep = 50; G.goodwill = 30;
    G.food = 0; G.wood = 0; G.scraps = 0;
    G.weather = 'heat';
    G.petitions = {};
    doPetition('grant');
    return { food: G.food, wood: G.wood, scraps: G.scraps };
  });
  ok(heat.food === 8 && heat.wood === 8 && heat.scraps === 8,
    `heat is not this card — the crate is still +8 (${heat.food}/${heat.wood}/${heat.scraps})`);

  const stranger = await t(() => {
    const ev = EVENTS_GOOD.find(e => e.id === 'kind_stranger');
    const real = Math.random;
    Math.random = () => 0.5;
    G.weather = 'rain'; G.food = 0; G.morale = 50;
    G.goalIndex = GOALS.length;
    triggerEvent(ev, true);
    Math.random = real;
    return { food: G.food };
  });
  ok(stranger.food === 6,
    `Kind Stranger rain is still a full food drop (food=${stranger.food})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
