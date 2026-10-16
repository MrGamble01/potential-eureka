/*
 * HV-233 — City Sweep said confiscate supplies, then left the
 * scrap guitar on the corner.
 *
 * The guitar recipe is "One set a day on the corner." The sweep
 * card says they destroy shelters and confiscate supplies. A
 * guitar left on the corner is the first thing they take. The
 * effect demolished tents and trampled beds and never touched
 * G.structures.guitar, so Busk a set still rolled after the
 * trucks left.
 *
 * #843 / HV-154 is theft taking the guitar. #840 is the sweep
 * taking the cart. #908 is the sweep taking the coats. This
 * ticket is the sweep vs the guitar itself. ui.js is not this
 * ticket.
 *
 *  A. Source: the sweep effect reads G.structures.guitar and
 *     clears it. The recipe still says on the corner. Theft
 *     is not this card.
 *  B. A live sweep with a guitar standing takes it and names
 *     it. The busk button is gone the same day.
 *  C. The tent still falls. The hole is still never found.
 *     The guitar still falls — it was on the corner, not in
 *     the hole.
 *  D. A garage cover still zeroes loose goods; the guitar
 *     still falls (a corner set, not a loose pile).
 *  E. Theft still leaves the guitar (HV-154). Busk still
 *     pays when the guitar stands.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives the production sweep / theft effects.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const sweep = /id:'sweep'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(loop);
const theft = /id:'theft'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(loop);

ok(/on the corner/.test(cfg) && /destroy shelters and confiscate supplies/.test(loop),
  'the guitar is still on the corner; the sweep still confiscates supplies');
ok(sweep && /G\.structures\.guitar/.test(sweep[1]) && /guitar=false/.test(sweep[1]),
  'HV-233: the sweep effect takes the scrap guitar off the corner');
ok(theft && !/G\.structures\.guitar/.test(theft[1]),
  'Theft is not this card — it does not touch the guitar');
ok(!/structures\.guitar/.test(ui),
  'ui.js untouched — the confiscation lives on the sweep effect');

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
    if (!sessionStorage.getItem('hvgtrsweep-init')) {
      sessionStorage.setItem('hvgtrsweep-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const lifted = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.structures.guitar = true;
    G.structures.tent = true;
    G.structures.stash = false;
    G.garageCover = false;
    G.packedUp = false;
    G.goalIndex = GOALS.length;
    G.food = 20; G.scraps = 20; G.morale = 50;
    buildActionUI();
    const buskBefore = !!document.getElementById('action-busk');
    EVENTS_BAD.find(e => e.id === 'sweep').effect();
    if (typeof buildActionUI === 'function') buildActionUI();
    Math.random = real;
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      guitar: !!G.structures.guitar,
      tent: !!G.structures.tent,
      buskBefore,
      buskAfter: !!document.getElementById('action-busk'),
      named: /guitar/i.test(log),
      scraps: G.scraps,
    };
  });
  ok(lifted.buskBefore, 'with the guitar standing the busk button is on the bar');
  ok(!lifted.guitar && lifted.named,
    `HV-233: a live sweep takes the guitar and names it (guitar ${lifted.guitar})`);
  ok(!lifted.buskAfter, 'the busk button is gone the same day');
  ok(!lifted.tent, 'the tent still falls when both stand');
  ok(lifted.scraps < 20, `goods still leave with them (scraps 20 → ${lifted.scraps})`);

  const hole = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.structures.guitar = true;
    G.structures.stash = true;
    G.garageCover = false;
    G.packedUp = false;
    G.food = 20; G.scraps = 20; G.morale = 50;
    EVENTS_BAD.find(e => e.id === 'sweep').effect();
    Math.random = real;
    return {
      guitar: !!G.structures.guitar,
      stash: !!G.structures.stash,
      scraps: G.scraps,
    };
  });
  ok(hole.stash && !hole.guitar,
    'the hole is still never found — the guitar still falls off the corner');
  ok(hole.scraps > 0 && hole.scraps < 20,
    `a stash still halves the take (scraps ${hole.scraps})`);

  const garage = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.structures.guitar = true;
    G.structures.stash = false;
    G.garageCover = true;
    G.packedUp = false;
    G.food = 20; G.scraps = 20; G.morale = 50;
    EVENTS_BAD.find(e => e.id === 'sweep').effect();
    Math.random = real;
    return {
      guitar: !!G.structures.guitar,
      scraps: G.scraps,
      cover: !!G.garageCover,
    };
  });
  ok(!garage.guitar && garage.scraps === 20 && !garage.cover,
    `a garage cover still zeroes loose goods; the guitar still falls (scraps ${garage.scraps})`);

  const theftLeft = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.structures.guitar = true;
    G.structures.stash = false;
    G.dog = 0;
    G.petitions = {};
    G.cans = 20; G.food = 20; G.scraps = 20; G.morale = 50;
    EVENTS_BAD.find(e => e.id === 'theft').effect();
    Math.random = real;
    return { guitar: !!G.structures.guitar, cans: G.cans };
  });
  ok(theftLeft.guitar && theftLeft.cans < 20,
    'Theft still leaves the guitar — that verb is HV-154');

  const pays = await page.evaluate(() => {
    G.structures.guitar = true;
    G.buskDay = -9;
    G.morale = 50;
    G.goodwill = 0;
    G.weather = 'clear';
    finishAction(buskAction());
    return { gw: G.goodwill, day: G.buskDay, days: G.days };
  });
  ok(pays.gw > 0 && pays.day === pays.days,
    `Busk still pays when the guitar stands (+${pays.gw} goodwill)`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
