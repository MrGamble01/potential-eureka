/* HV-64 — Soup Night is judged before the dawn food drain.
 *
 * The Soup Kitchen promises "1 food each" (craft desc + HV-10 comment).
 * onNewDay() used to subtract population*1.5 food first, then ask
 * soupNightAtDawn() whether the pot could feed everyone. A camp of 2
 * with 2 food — exactly the promise — woke to a cold pot.
 * hvsoup.js only calls soupNightAtDawn() in isolation, so it never
 * saw the seam.
 *
 * Hook-free. Reverting the call order fails the named assertion.
 * A pantry short of 1-each still stays cold (the other direction).
 *
 * A. Source: soupNightAtDawn() is called before the pop*1.5 drain.
 * B. 2 residents, 2 food through onNewDay() serves soup night.
 * C. 2 residents, 1 food is still a cold pot.
 * D. Isolated soupNightAtDawn math is unchanged (1 food each).
 * Z. Zero page errors. ui.js untouched.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const cfg  = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const ui   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const onAt = loop.indexOf('function onNewDay(){');
const onEnd = loop.indexOf('function bumpRegular');
const onSrc = onAt >= 0 && onEnd > onAt ? loop.slice(onAt, onEnd) : '';

ok(onAt >= 0 && /function soupNightAtDawn\(/.test(loop),
  'onNewDay and soupNightAtDawn still live in gameloop.js');

const soupCall = onSrc.indexOf('soupNightAtDawn()');
const drainAt = onSrc.search(/G\.food\s*=\s*Math\.max\(0,\s*G\.food\s*-\s*G\.population\s*\*\s*1\.5\)/);
ok(soupCall >= 0 && drainAt >= 0 && soupCall < drainAt,
  'HV-64: soup night is judged before the dawn food drain');

ok(/1 food each/.test(cfg) && /feeds everyone at dusk/.test(cfg),
  'the Soup Kitchen still promises 1 food each');

ok(!/soupNightAtDawn/.test(ui) && !/population\*1\.5/.test(ui),
  'ui.js is untouched — no soup/drain rewrite');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.addInitScript(() => {
    localStorage.setItem('hv-intro-seen', '1');
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2200);

  async function dawnSoup(food, pop) {
    return page.evaluate(([stock, mouths]) => {
      const logs = [];
      const oldLog = window.log;
      window.log = m => { logs.push(String(m)); oldLog(m); };
      const oldR = Math.random;
      Math.random = () => 0.99;
      G.structures.soup_kitchen = true;
      G.structures.garden = false;
      G.structures.tent = false;
      G.structures.workbench = false;
      G.structures.coats = false;
      G.workers = Object.assign({}, G.workers, { cook: 0, scrapper: 0 });
      G.dog = 0;
      G.regulars = { marisol: 0, ray: 0, dee: 0 };
      G.rainBetOn = false;
      G.rayDebt = 0;
      G.snapUntil = null;
      G.petitions = {};
      G.weather = 'clear';
      G.forecast = 'clear';
      G.population = mouths;
      G.food = stock;
      G.health = 80;
      G.warmth = 80;
      G.morale = 50;
      G.soupNights = 0;
      G.lastEventDay = G.days + 99;
      G.lastDeeDay = G.days;
      onNewDay();
      Math.random = oldR;
      window.log = oldLog;
      return {
        food: G.food,
        nights: G.soupNights,
        hot: logs.some(m => /Soup night/.test(m)),
        cold: logs.some(m => /pot stayed cold/.test(m)),
      };
    }, [food, pop]);
  }

  // B — named assertion. Revert the call order and 2 food / 2 mouths
  // wakes to a cold pot (drain 2-3=0, then soup asks for 2).
  {
    const st = await dawnSoup(2, 2);
    ok(st.nights === 1 && st.hot && !st.cold,
      `HV-64: 1 food each still serves soup night through dawn (nights=${st.nights}, hot=${st.hot}, cold=${st.cold}, food=${st.food})`);
  }

  // C — a pantry short of 1-each is still a cold pot.
  {
    const st = await dawnSoup(1, 2);
    ok(st.nights === 0 && st.cold && !st.hot,
      `a pantry short of 1-each stays cold (nights=${st.nights}, cold=${st.cold})`);
  }

  // D — isolated helper math is unchanged.
  {
    const iso = await page.evaluate(() => {
      const oldR = Math.random; Math.random = () => 0.99;
      G.structures.soup_kitchen = true;
      G.population = 4; G.food = 20; G.morale = 50; G.health = 60; G.soupNights = 0;
      soupNightAtDawn();
      Math.random = oldR;
      return { food: G.food, nights: G.soupNights };
    });
    ok(iso.food === 16 && iso.nights === 1,
      `isolated soupNightAtDawn still costs 1 food each (food=${iso.food}, nights=${iso.nights})`);
  }

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
