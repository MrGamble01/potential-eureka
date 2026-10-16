/*
 * HV-245 — Word on the Street said Respected halves the complaint
 * calls that bring sweeps, then the trucks still came two-thirds
 * as often.
 *
 * config.js promises the perk: "Respected halves the complaint calls
 * that bring sweeps." maybeEvent multiplied the .18 sweep gate by
 * .67 — a third less, not half. hvrep's 0.15 roll sits above both
 * .18×.67 (.1206) and .18×.5 (.09), so that suite never saw the lie.
 *
 * Known lifting panhandle odds is not this card. Beloved fence-post
 * gifts are not this card. A stranger's full .18 gate is not this card.
 *
 *  A. Source: the Respected comment still says halves.
 *  B. Source: maybeEvent multiplies the sweep gate by .5, not .67.
 *  C. A stranger still gets the trucks on a .10 roll.
 *  D. Respected lets that same .10 roll pass by (half of .18 is .09).
 *  E. A .08 roll still warns Respected — half is not zero.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives maybeEvent() on the production row.
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
const maybeAt = loop.indexOf('function maybeEvent()');
const poolAt = loop.indexOf('var bm=G.season');
const maybeBlock = maybeAt >= 0 && poolAt > maybeAt ? loop.slice(maybeAt, poolAt) : '';

ok(/Respected halves the complaint/.test(config),
  'Word on the Street still says Respected halves the complaint calls');
ok(maybeAt >= 0 && /repTier\(\)\s*>=\s*2/.test(maybeBlock),
  'maybeEvent still reads Respected before it rolls the trucks');
ok(/\.18\s*\*\s*\(repTier\(\)\s*>=\s*2\s*\?\s*\.5\s*:\s*1\)/.test(maybeBlock),
  'HV-245: the sweep gate is half (.5) once the camp is Respected');
ok(!/\.67/.test(maybeBlock),
  'HV-245: the one-third cut (.67) is gone from the sweep gate');
ok(!/homeless-village\/js\/ui\.js/.test(loop) && !/homeless-village\/js\/ui\.js/.test(config),
  'the cut lives in maybeEvent — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvhalf-init')) {
      sessionStorage.setItem('hvhalf-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const roll = (rep, sweepRoll) => page.evaluate(({ rep, sweepRoll }) => {
    const oldR = Math.random;
    const q = [0.5, sweepRoll];
    let i = 0;
    Math.random = () => (i < q.length ? q[i++] : 0.99);
    G.days = 10;
    G.rep = rep;
    G.workers.lookout = true;
    G.dog = 0;
    G.sweepWarned = false;
    G.packedUp = false;
    if (typeof showSweepWarning === 'function') showSweepWarning(false);
    maybeEvent();
    const warned = !!G.sweepWarned;
    G.sweepWarned = false;
    if (typeof showSweepWarning === 'function') showSweepWarning(false);
    const ev = document.getElementById('event-overlay');
    if (ev) ev.style.display = 'none';
    Math.random = oldR;
    return { warned, tier: repTier() };
  }, { rep, sweepRoll });

  // .10 is the lie: under the stranger's .18, under .18×.67 (.1206),
  // and over half (.09). hvrep's .15 roll never sat in this window.
  const stranger = await roll(0, 0.10);
  ok(stranger.tier === 0 && stranger.warned,
    `a stranger still gets the trucks on a .10 roll (warned=${stranger.warned})`);

  const respected = await roll(50, 0.10);
  ok(respected.tier === 2 && !respected.warned,
    `HV-245: Respected lets the same .10 roll pass by (warned=${respected.warned})`);

  const stillHalf = await roll(50, 0.08);
  ok(stillHalf.tier === 2 && stillHalf.warned,
    `a .08 roll still warns Respected — half of .18 is .09, not zero (warned=${stillHalf.warned})`);

  const strangerHigh = await roll(0, 0.17);
  ok(strangerHigh.tier === 0 && strangerHigh.warned,
    `a stranger's full .18 gate still fires at .17 (warned=${strangerHigh.warned})`);

  // Known (tier 1) is not Respected — the half-cut must not start at 25.
  const known = await roll(25, 0.10);
  ok(known.tier === 1 && known.warned,
    `Known is not this card — a .10 roll still warns at 25 rep (warned=${known.warned})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
