/*
 * HV-261 — Someone new stands at the edge of the firelight,
 * then a rainy dawn still brought them to wait.
 *
 * The ask is a stranger at the edge of the light. Rain already
 * keeps people off the sidewalk. The post never read the sky.
 *
 * An ask already standing still holds through rain. A clear
 * respected dawn still opens one. A named snap is not this card.
 * ui.js is not this ticket.
 *
 *  A. Source: newcomerAtDawn returns on rain before it posts.
 *  B. A rainy eligible dawn leaves no ask and names the rain.
 *  C. A clear eligible dawn still opens one.
 *  D. An ask already standing still holds through rain.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives production newcomerAtDawn.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const at = loop.indexOf('function newcomerAtDawn()');
const body = at >= 0 ? loop.slice(at, at + 900) : '';

ok(/edge of the firelight/.test(loop),
  'the ask still says someone stands at the edge of the firelight');
ok(/weather==='rain'/.test(body) && /kept the stranger moving/.test(body),
  'HV-261: newcomerAtDawn keeps the edge empty in the rain');
ok(!/snapActive/.test(body),
  'a named snap is not this card');
ok(!/homeless-village\/js\/ui\.js/.test(loop),
  'the cut lives on the dawn ask — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvedge-init')) {
      sessionStorage.setItem('hvedge-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const dry = await t(() => {
    G.days = 20;
    G.newcomerLastDay = -9;
    G.newcomerAsk = null;
    G.rep = 60;
    G.structures.tent = true;
    G.population = 2;
    G.weather = 'clear';
    G.snapUntil = null;
    const captured = [];
    const prev = window.log;
    window.log = function (m) { captured.push(String(m)); prev(m); };
    newcomerAtDawn();
    window.log = prev;
    return { ask: !!G.newcomerAsk, last: captured[captured.length - 1] || '', lastDay: G.newcomerLastDay };
  });
  ok(dry.ask && dry.lastDay === 20,
    `a clear eligible dawn still opens one (ask=${dry.ask})`);
  ok(/edge of the firelight/.test(dry.last),
    `the dry log still names the firelight (${dry.last})`);

  const wet = await t(() => {
    G.days = 30;
    G.newcomerLastDay = -9;
    G.newcomerAsk = null;
    G.rep = 60;
    G.structures.tent = true;
    G.population = 2;
    G.weather = 'rain';
    G.snapUntil = null;
    const captured = [];
    const prev = window.log;
    window.log = function (m) { captured.push(String(m)); prev(m); };
    newcomerAtDawn();
    window.log = prev;
    return { ask: !!G.newcomerAsk, last: captured[captured.length - 1] || '', lastDay: G.newcomerLastDay };
  });
  ok(!wet.ask && wet.lastDay === -9,
    `HV-261: a rainy eligible dawn leaves no ask (ask=${wet.ask}, lastDay=${wet.lastDay})`);
  ok(/kept the stranger moving/.test(wet.last),
    `the last line names the rain (${wet.last})`);

  const held = await t(() => {
    G.days = 31;
    G.newcomerAsk = { day: 30 };
    G.newcomerLastDay = 30;
    G.weather = 'rain';
    newcomerAtDawn();
    return { ask: !!G.newcomerAsk, day: G.newcomerAsk && G.newcomerAsk.day };
  });
  ok(held.ask && held.day === 30,
    `an ask already standing still holds through rain (day=${held.day})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
