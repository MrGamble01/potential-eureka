/*
 * HV-258 — Gentrification said harassment from locals is increasing,
 * then Trade still paid the quiet-corner swap.
 *
 * The card says locals. Trade is dealing with locals — 3 cans → 2
 * food. The effect only cut morale and goodwill. The swap stayed
 * fair.
 *
 * Theft × trade is not this card. Gentrify × panhandle / flyers /
 * busk / Word are not this card. A quiet corner still pays 3 → 2.
 * ui.js is not this ticket.
 *
 *  A. Source: gentrify stamps the day; trade halves while it holds.
 *  B. After the card, 3 cans pay 1 food and the log names hostility.
 *  C. A quiet corner still pays 3 → 2.
 *  D. Theft does not sour the swap.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives production triggerEvent + finishAction.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const tradeAt = player.indexOf("a.id==='trade'");
const trade = tradeAt >= 0 ? player.slice(tradeAt, tradeAt + 900) : '';
const gentAt = loop.indexOf("id:'gentrify'");
const gent = gentAt >= 0 ? loop.slice(gentAt, gentAt + 500) : '';

ok(/Harassment from locals is increasing/.test(loop),
  'gentrify still says harassment from locals is increasing');
ok(/gentrifyDay\s*=\s*G\.days/.test(gent) && /hostile/.test(trade) && /fed=hostile\?1:2/.test(trade),
  'HV-258: gentrify stamps the day and trade halves while it holds');
ok(!/gentrifyDay/.test(player.slice(player.indexOf("a.id==='panhandle'"), player.indexOf("a.id==='rest'"))) ,
  'panhandle is not this card');
ok(!/homeless-village\/js\/ui\.js/.test(player) && !/homeless-village\/js\/ui\.js/.test(loop),
  'the cut lives on the event and the swap — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvharass-init')) {
      sessionStorage.setItem('hvharass-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const quiet = await t(() => {
    G.gentrifyDay = -9;
    G.cans = 3; G.food = 0;
    G.goalIndex = GOALS.length;
    finishAction({ id: 'trade' });
    const lines = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    return { food: G.food, cans: G.cans, last: lines[lines.length - 1] || '' };
  });
  ok(quiet.food === 2 && quiet.cans === 0,
    `a quiet corner still pays 3 → 2 (food=${quiet.food})`);
  ok(/Traded 3 cans → 2 food/.test(quiet.last),
    `the quiet log still names the fair swap (${quiet.last})`);

  const sour = await t(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'gentrify');
    const real = Math.random;
    Math.random = () => 0.5;
    G.days = 8; G.morale = 80; G.goodwill = 20;
    G.goalIndex = GOALS.length;
    triggerEvent(ev, false);
    Math.random = real;
    G.cans = 3; G.food = 0;
    finishAction({ id: 'trade' });
    const lines = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    return {
      day: G.gentrifyDay,
      food: G.food,
      cans: G.cans,
      last: lines[lines.length - 1] || '',
    };
  });
  ok(sour.day === 8,
    `gentrify stamps the day (${sour.day})`);
  ok(sour.food === 1 && sour.cans === 0,
    `HV-258: after the card, 3 cans pay 1 food (food=${sour.food})`);
  ok(/hostile/i.test(sour.last),
    `the last line names the hostility (${sour.last})`);

  const theft = await t(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'theft');
    G.gentrifyDay = -9;
    G.dog = 0; G.structures.stash = false;
    G.cans = 10; G.food = 10; G.scraps = 10; G.morale = 80;
    const real = Math.random;
    Math.random = () => 0.5;
    ev.effect();
    Math.random = real;
    G.cans = 3; G.food = 0;
    finishAction({ id: 'trade' });
    return { food: G.food, gentrifyDay: G.gentrifyDay };
  });
  ok(theft.food === 2 && theft.gentrifyDay === -9,
    `theft is not this card — the swap stays 3 → 2 (food=${theft.food})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
