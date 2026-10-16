/* HV-89 — the Shopping Cart said the deposit run is possible.
 *
 * Recipe: "Makes the deposit run possible: haul every can to the
 * redemption center in one trip." finishCraft grants the structure,
 * rebuilds the craft list, and never calls buildActionUI. The deposit
 * button is born only inside that rebuild — dawn, or another once-a-day
 * verb. Craft the cart at noon with eight cans on the ground and the
 * rail still has no run. Distinct from HV-73 (a button that is already
 * on the rail staying grey after you earn the cans).
 *
 * The guitar and a first hire are the same hole: Busk and Hold a camp
 * meeting also wait for a rebuild that never comes.
 *
 * Hook-free. Reverting the rail rebuild fails the named hold. ui.js
 * untouched: it still only paints the list when asked.
 *
 * A. Source: cart copy still promises the deposit run; finishCraft and
 *    hireWorker ask the rail to rebuild; ui.js was not given a new API.
 * B. finishCraft(cart) with enough cans puts a live Deposit run on the
 *    rail. Isolation: a blanket does not. The guitar puts Busk on.
 *    A first hire puts the meeting on.
 * Z. Zero page errors.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg    = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const ui     = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

ok(/id:'cart'[\s\S]{0,280}deposit run possible/.test(cfg),
  'Shopping Cart copy still promises the deposit run');

const finishAt = player.indexOf('function finishCraft');
const finishEnd = finishAt >= 0 ? player.indexOf('\nfunction ', finishAt + 1) : -1;
const finish = finishAt >= 0 ? player.slice(finishAt, finishEnd > 0 ? finishEnd : finishAt + 400) : '';
ok(finishAt >= 0 && /buildCraftUI\(\)/.test(finish),
  'finishCraft still rebuilds the craft list after a recipe lands');
ok(/buildActionUI\(\)/.test(finish),
  'finishCraft also rebuilds the action rail — that is where the deposit run is born');

const hireAt = player.indexOf('function hireWorker');
const hireEnd = hireAt >= 0 ? player.indexOf('\nfunction ', hireAt + 1) : -1;
const hire = hireAt >= 0 ? player.slice(hireAt, hireEnd > 0 ? hireEnd : hireAt + 400) : '';
ok(/buildActionUI\(\)/.test(hire),
  'hireWorker rebuilds the rail too — a first hire is what unlocks the meeting');
ok(!/function finishCraft|function hireWorker/.test(ui),
  'ui.js was not given a craft/hire API — it still only paints the list when asked');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.addInitScript(() => { try { localStorage.setItem('hv-intro-seen', '1'); } catch (e) {} });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const blanket = await page.evaluate(() => {
    G.structures.cart = false;
    G.structures.guitar = false;
    G.structures.workbench = true;
    G.cans = 8;
    G.population = 1;
    G.activeCrafts.blanket = { start: Date.now() - 50, duration: 1 };
    finishCraft(RECIPES.find(r => r.id === 'blanket'));
    const btn = document.getElementById('action-deposit');
    return { cart: !!G.structures.cart, btn: !!btn };
  });
  ok(!blanket.cart && !blanket.btn,
    `a blanket does not invent a deposit run (cart=${blanket.cart}, btn=${blanket.btn})`);

  const cart = await page.evaluate(() => {
    G.structures.cart = false;
    G.structures.workbench = true;
    G.cans = 8;
    G.depositDay = -9;
    G.activeCrafts.cart = { start: Date.now() - 50, duration: 1 };
    finishCraft(RECIPES.find(r => r.id === 'cart'));
    const btn = document.getElementById('action-deposit');
    return {
      cart: !!G.structures.cart,
      btn: !!btn,
      disabled: btn ? !!btn.disabled : null,
      label: btn ? btn.textContent.replace(/\s+/g, ' ').trim() : '',
    };
  });
  ok(cart.cart, 'finishCraft actually grants the cart');
  ok(cart.btn && cart.disabled === false,
    `HV-89: crafting the cart puts the deposit run on the rail (btn=${cart.btn}, disabled=${cart.disabled}, label=${JSON.stringify(cart.label)})`);

  const guitar = await page.evaluate(() => {
    G.structures.guitar = false;
    G.structures.workbench = true;
    G.buskDay = -9;
    G.activeCrafts.guitar = { start: Date.now() - 50, duration: 1 };
    finishCraft(RECIPES.find(r => r.id === 'guitar'));
    const btn = document.getElementById('action-busk');
    return { guitar: !!G.structures.guitar, btn: !!btn, disabled: btn ? !!btn.disabled : null };
  });
  ok(guitar.guitar && guitar.btn && guitar.disabled === false,
    `the guitar is the same hole — Busk lands on the rail (btn=${guitar.btn}, disabled=${guitar.disabled})`);

  const meet = await page.evaluate(() => {
    G.population = 1;
    G.peakPopulation = 1;
    G.goodwill = 20;
    G.workers.cook = false;
    G.meetingDay = -9;
    hireWorker('cook');
    const btn = document.getElementById('action-meeting');
    return { pop: G.population, hired: !!G.workers.cook, btn: !!btn };
  });
  ok(meet.hired && meet.pop === 2 && meet.btn,
    `a first hire puts the camp meeting on the rail (pop=${meet.pop}, btn=${meet.btn})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
