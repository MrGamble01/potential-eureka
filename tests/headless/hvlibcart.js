/*
 * HV-151 — the Shopping Cart said it was liberated, then the
 * sweep left it standing.
 *
 * The cart recipe is "A liberated cart with a true wheel." The
 * sweep card says police confiscate supplies. A stolen cart is
 * the first thing they take. The effect demolished tents and
 * trampled beds and never touched G.structures.cart, so the
 * deposit run still rolled after the trucks left.
 * #839 is cardboard (a pile). #755 is the button appearing.
 * This is the cart itself.
 *
 *  A. Source: the sweep effect reads G.structures.cart and
 *     clears it. The recipe still says liberated.
 *  B. A sweep with a cart standing takes it.
 *  C. The hole is still never found. The tent still falls.
 *  D. A garage cover still zeroes loose goods; the cart still
 *     falls (goods, not a vehicle).
 *  E. Deposit still pays when the cart stands.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives the production sweep effect().
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
const sweep = /id:'sweep'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(loop);
ok(/liberated cart/.test(cfg) && /confiscate supplies/.test(loop),
  'the cart is still liberated; the sweep still confiscates supplies');
ok(sweep && /G\.structures\.cart/.test(sweep[1]) && /cart=false/.test(sweep[1]),
  'HV-151: the sweep effect takes the liberated cart');

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
    if (!sessionStorage.getItem('hvlibcart-init')) {
      sessionStorage.setItem('hvlibcart-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const lifted = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.structures.cart = true;
    G.structures.tent = true;
    G.structures.stash = true;
    G.structures.garden = false;
    G.structures.soup_kitchen = false;
    G.structures.workbench = false;
    G.garageCover = false;
    G.packedUp = false;
    G.food = 10; G.scraps = 10; G.cans = 10;
    EVENTS_BAD.find(e => e.id === 'sweep').effect();
    Math.random = real;
    return {
      cart: !!G.structures.cart,
      tent: !!G.structures.tent,
      stash: !!G.structures.stash,
      named: /cart/i.test(Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n')),
    };
  });
  ok(!lifted.cart && lifted.named,
    `HV-151: a sweep takes the liberated cart (cart ${lifted.cart})`);
  ok(!lifted.tent && lifted.stash,
    'the tent still falls; the hole is still never found');

  const covered = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.structures.cart = true;
    G.structures.tent = true;
    G.structures.stash = false;
    G.structures.garden = false;
    G.structures.soup_kitchen = false;
    G.structures.workbench = false;
    G.garageCover = true;
    G.packedUp = false;
    G.food = 10; G.scraps = 10;
    EVENTS_BAD.find(e => e.id === 'sweep').effect();
    Math.random = real;
    return { cart: !!G.structures.cart, tent: !!G.structures.tent, food: G.food, scraps: G.scraps };
  });
  ok(covered.food === 10 && covered.scraps === 10 && !covered.tent && !covered.cart,
    `a garage cover still zeroes loose goods and the cart still falls (food ${covered.food}, cart ${covered.cart})`);

  const haul = await page.evaluate(() => {
    G.structures.cart = true;
    G.cans = 20;
    G.goodwill = 0;
    G.rep = 0;
    G.depositDay = -9;
    G.days = 3;
    G.goalIndex = GOALS.length;
    G.deposits = 0;
    finishAction({ id: 'deposit', cooldown: 0, time: 0 });
    return { cans: G.cans, gw: G.goodwill, deposits: G.deposits };
  });
  ok(haul.cans === 0 && haul.gw === 10 && haul.deposits === 1,
    `deposit still pays when the cart stands (cans ${haul.cans}, gw ${haul.gw})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
