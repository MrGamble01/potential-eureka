/*
 * HV-180 — Hot Meal said Feed a community member, then a dead barrel
 * still cooked it.
 *
 * The recipe is "Feed a community member." Fire Went Out said the
 * barrel fire died overnight. It's cold and dark. Firewood is the
 * relight (HV-69). A Blanket is +warmth and does not cook. Hot Meal
 * still spent the food and paid +3 goodwill on a dark barrel.
 *
 *  A. Source: doCraft refuses a Hot Meal while fireOutUntil is live;
 *     ui.js is untouched.
 *  B. The recipe still promises to feed someone. Fire Went Out still
 *     kills the barrel.
 *  C. A pinned dead-barrel Hot Meal spends nothing and pays nothing.
 *  D. Firewood still relights. A Blanket still bundles in the dark.
 *  E. A lit barrel still cooks the meal.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives triggerEvent + doCraft on the production path.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const craft = /function doCraft\(r\)\{([\s\S]*?)\n\}/.exec(player);
ok(!!craft, 'doCraft is still in player.js');
ok(craft && /meal/.test(craft[1]) && /fireOutUntil/.test(craft[1]),
  'HV-180: doCraft refuses a Hot Meal on a dead barrel');
ok(/id:'meal'[\s\S]{0,160}?Feed a community member/.test(cfg),
  'Hot Meal still promises to feed someone');
ok(/id:'fire_out'[\s\S]{0,200}?barrel fire died/.test(loop),
  'Fire Went Out still kills the barrel');
ok(!/fireOutUntil/.test(ui) || !/meal/.test(ui),
  'ui.js untouched — the refuse lives on doCraft');

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
    if (!sessionStorage.getItem('hvmealfire-init')) {
      sessionStorage.setItem('hvmealfire-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const darkMeal = await page.evaluate(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'fire_out');
    const meal = RECIPES.find(r => r.id === 'meal');
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    G.food = 10; G.cans = 5; G.goodwill = 4; G.warmth = 60;
    G.activeCrafts = {};
    triggerEvent(ev, false);
    const out = Date.now() < (G.fireOutUntil || 0);
    doCraft(meal);
    if (G.activeCrafts.meal) finishCraft(meal);
    return {
      out,
      banner: document.getElementById('ev-title').textContent,
      desc: meal.desc,
      food: G.food,
      cans: G.cans,
      goodwill: G.goodwill,
      flying: !!G.activeCrafts.meal,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  });
  ok(darkMeal.banner === 'Fire Went Out' && /Feed a community member/.test(darkMeal.desc),
    `the cards still say Fire Went Out / Feed a community member`);
  ok(darkMeal.out, 'Fire Went Out leaves the barrel dark');
  ok(darkMeal.food === 10 && darkMeal.cans === 5 && darkMeal.goodwill === 4 && !darkMeal.flying,
    `HV-180: a dead barrel spends nothing (food ${darkMeal.food}, gw ${darkMeal.goodwill})`);
  ok(/hot meal/i.test(darkMeal.log),
    `the log names the uncooked meal (${darkMeal.log.slice(-90)})`);

  const wood = await page.evaluate(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'fire_out');
    const recipe = RECIPES.find(r => r.id === 'fire_ration');
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    G.wood = 10; G.warmth = 40;
    G.activeCrafts = {};
    triggerEvent(ev, false);
    const out = Date.now() < (G.fireOutUntil || 0);
    const w1 = G.warmth;
    G.activeCrafts[recipe.id] = { start: Date.now(), duration: 1 };
    finishCraft(recipe);
    return { out, relit: !((G.fireOutUntil || 0) > Date.now()), dW: G.warmth - w1 };
  });
  ok(wood.out && wood.relit && wood.dW === 10,
    `Firewood still relights (${wood.relit}, Δwarmth ${wood.dW})`);

  const blanket = await page.evaluate(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'fire_out');
    const recipe = RECIPES.find(r => r.id === 'blanket');
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    G.scraps = 10; G.cardboard = 10; G.warmth = 40;
    G.activeCrafts = {};
    triggerEvent(ev, false);
    const w1 = G.warmth;
    G.activeCrafts[recipe.id] = { start: Date.now(), duration: 1 };
    finishCraft(recipe);
    return {
      out: Date.now() < (G.fireOutUntil || 0),
      dW: G.warmth - w1,
    };
  });
  ok(blanket.out && blanket.dW === 15,
    `a Blanket still bundles in the dark (Δwarmth ${blanket.dW}, out ${blanket.out})`);

  const lit = await page.evaluate(() => {
    const meal = RECIPES.find(r => r.id === 'meal');
    G.fireOutUntil = 0;
    G.food = 10; G.cans = 5; G.goodwill = 4;
    G.activeCrafts = {};
    G.activeCrafts[meal.id] = { start: Date.now(), duration: 1 };
    finishCraft(meal);
    return { goodwill: G.goodwill, food: G.food, cans: G.cans };
  });
  ok(lit.goodwill === 7,
    `a lit barrel still cooks the meal (gw ${lit.goodwill})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
