/*
 * HV-95 — Pack Up does not survive a reload.
 *
 * The Lookout warning's PACK UP CAMP button costs 5 morale and
 * stashes most of the goods (keep = 0.25). packUpCamp() writes
 * that into the save. loadGame() then throws the pack away:
 *
 *   G.sweepWarned=false; G.packedUp=false;
 *
 * Clearing sweepWarned is the real load reset — a save written
 * mid-warning restores the flag, but the 30s/15s timer died with
 * the old tab, and leaving the flag set blocks every future
 * lookout warning. Unpacking is collateral. The player paid 5
 * morale, refreshed, and the next sweep treats them as unpacked.
 *
 * A new warning also writes G.packedUp=false, so even a pack
 * that survived the reload would be wiped the next time the
 * Lookout calls it. That second write is the same hole for
 * anyone who actually has a Lookout (the only camps that can
 * pack).
 *
 * Distinct from HV-71 (#727): in-session triggerEvent cleared
 * the *warning*. Distinct from HV-77 (#740): the warning
 * overlay burned the day clock.
 *
 * A. Source: loadGame still clears sweepWarned, no longer
 *    assigns packedUp=false. maybeEvent's warning arms no
 *    longer unpack. The sweep effect still honors packedUp
 *    and then clears it. ui.js is not this ticket.
 * B. A packed save comes back packed; the dead warning does not.
 * C. An unpacked save stays unpacked.
 * D. packUpCamp → save → reload keeps packedUp and the spent morale.
 * E. The sweep after that reload keeps 75%.
 * F. A new Lookout warning after the reload does not unpack.
 * Z. Zero page errors.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const save = fs.readFileSync(path.join(ROOT, 'homeless-village/js/save.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const maybeAt = loop.indexOf('function maybeEvent(){');
const maybe = maybeAt >= 0 ? loop.slice(maybeAt, maybeAt + 1600) : '';
const sweepAt = loop.indexOf("id:'sweep'");
const sweep = sweepAt >= 0 ? loop.slice(sweepAt, sweepAt + 1600) : '';

ok(/G\.sweepWarned\s*=\s*false/.test(save),
  'loadGame still clears the dead warning timer');
ok(!/G\.packedUp\s*=\s*false/.test(save),
  'HV-95: loadGame does not unpack a camp that already paid');
ok(maybeAt >= 0 && /lookout/.test(maybe) && /Biscuit/.test(maybe),
  'maybeEvent still arms the Lookout and Biscuit warnings');
ok(!/G\.packedUp\s*=\s*false/.test(maybe),
  'HV-95: a new warning does not unpack a camp that already paid');
ok(/G\.packedUp\s*\?\s*0\.25/.test(sweep) && /G\.packedUp\s*=\s*false/.test(sweep),
  'the sweep still honors the pack, then clears it');
ok(/function packUpCamp\(/.test(ui) && /G\.morale\s*=\s*Math\.max\(0,\s*G\.morale-5\)/.test(ui),
  'ui.js still owns Pack Up — this ticket does not move it');

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);

  async function boot(extra) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
    await page.addInitScript((more) => {
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.setItem('homeless_village_v1', JSON.stringify(Object.assign({
        timeOfDay: 0.2,
        days: 4,
        health: 80,
        warmth: 80,
        food: 30,
        scraps: 40,
        morale: 40,
        fridgeSeeded: true,
      }, more || {})));
    }, extra || {});
    await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(2500);
    return { ctx, page, errs };
  }

  // B — packed save + mid-warning flag
  {
    const { ctx, page, errs } = await boot({ packedUp: true, sweepWarned: true });
    const st = await page.evaluate(() => ({
      packed: !!G.packedUp,
      warned: !!G.sweepWarned,
      morale: G.morale,
    }));
    ok(st.packed === true && st.warned === false,
      `HV-95: a packed save comes back packed; the dead warning does not (packed=${st.packed}, warned=${st.warned})`);
    ok(st.morale === 40, `morale is not refunded or re-spent on load (${st.morale})`);
    ok(errs.length === 0, `packed seed: no page errors${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  // C — isolation
  {
    const { ctx, page, errs } = await boot({ packedUp: false, sweepWarned: false });
    const st = await page.evaluate(() => ({ packed: !!G.packedUp, warned: !!G.sweepWarned }));
    ok(st.packed === false && st.warned === false,
      `an unpacked save stays unpacked (packed=${st.packed})`);
    ok(errs.length === 0, `unpacked seed: no page errors${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  // D/E/F — live pack, reload, sweep, re-warn
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('hvpack-init')) {
        sessionStorage.setItem('hvpack-init', '1');
        localStorage.setItem('hv-intro-seen', '1');
        localStorage.removeItem('homeless_village_v1');
      }
    });
    await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(2500);

    const packed = await page.evaluate(() => {
      G.sweepWarned = true;
      G.packedUp = false;
      G.morale = 50;
      packUpCamp();
      return { packed: !!G.packedUp, morale: G.morale };
    });
    ok(packed.packed === true && packed.morale === 45,
      `packUpCamp still costs 5 morale (packed=${packed.packed}, morale=${packed.morale})`);

    await page.reload({ waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(2500);
    const reloaded = await page.evaluate(() => ({
      packed: !!G.packedUp,
      warned: !!G.sweepWarned,
      morale: G.morale,
    }));
    ok(reloaded.packed === true && reloaded.warned === false && reloaded.morale === 45,
      `HV-95: Pack Up survives a reload (packed=${reloaded.packed}, warned=${reloaded.warned}, morale=${reloaded.morale})`);

    const swept = await page.evaluate(() => {
      const real = Math.random;
      Math.random = () => 0;
      G.scraps = 100; G.food = 100; G.morale = 45;
      G.structures.tent = false; G.structures.soup_kitchen = false;
      G.structures.workbench = false; G.structures.garden = false;
      G.structures.stash = false; G.garageCover = false; G.mural = 0;
      EVENTS_BAD.find(e => e.id === 'sweep').effect();
      Math.random = real;
      const feed = Array.from(document.querySelectorAll('.log-line')).map(el => el.textContent).join('\n');
      return { scraps: G.scraps, food: G.food, packed: !!G.packedUp, feed };
    });
    ok(swept.scraps === 93 && swept.food === 95,
      `HV-95: the sweep after a reload still honors the pack (scraps ${swept.scraps}, food ${swept.food})`);
    ok(/Packing up paid off/.test(swept.feed),
      'the payoff line still lands');
    ok(swept.packed === false, 'the sweep still spends the pack');

    const rearmed = await page.evaluate(() => {
      G.packedUp = true;
      G.sweepWarned = false;
      G.workers.lookout = true;
      G.dog = 0;
      G.days = 5;
      G.rep = 0;
      let n = 0;
      const rolls = [0.4, 0.05];
      const real = Math.random;
      Math.random = () => rolls[Math.min(n++, rolls.length - 1)];
      maybeEvent();
      Math.random = real;
      const out = { packed: !!G.packedUp, warned: !!G.sweepWarned };
      G.sweepWarned = false;
      showSweepWarning(false);
      return out;
    });
    ok(rearmed.warned === true && rearmed.packed === true,
      `HV-95: a new Lookout warning leaves a paid pack in place (packed=${rearmed.packed}, warned=${rearmed.warned})`);

    ok(errs.length === 0, `live pack path: no page errors${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  await browser.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
