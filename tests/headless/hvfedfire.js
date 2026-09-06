/*
 * HV-162 — Firewood said keep the barrel burning, then
 * Fire Went Out still killed it overnight.
 *
 * Firewood's card says keep the barrel burning. Fire Went
 * Out says the barrel fire died overnight. HV-69 relights
 * a fire that is already out. The overnight death never
 * asked whether you stacked wood last night — the card
 * still landed, warmth still dropped, the lights still
 * went dark.
 *
 * #744 is the 30-second timer. #747 is dawn saying the
 * fire held after the card. #842 is the sky staying a
 * scorcher. This is the stack you already paid for.
 *
 *  A. Source: Firewood still keeps the barrel burning;
 *     the fire_out effect reads fireFedDay; finishCraft
 *     stamps it on fire_ration.
 *  B. A live stack, then the overnight card: warmth
 *     holds, the lights stay on, the log names the wood.
 *  C. No stack: warmth still drops and the barrel goes
 *     dark.
 *  D. A Blanket is also +warmth and must not stamp the
 *     feed — the overnight card still bites.
 *  E. HV-69 still relights an unfed fire that already
 *     went out.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishCraft + the production effect.
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
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const finish = /function finishCraft\(r\)\{([\s\S]*?)\n\}/.exec(player);
const fireOut = /id:'fire_out'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(loop);
ok(/id:'fire_ration'[\s\S]{0,180}?Keep the barrel burning/.test(cfg)
  && /died overnight/.test(loop),
  'Firewood still keeps the barrel burning; Fire Went Out still died overnight');
ok(finish && /fire_ration/.test(finish[1]) && /fireFedDay/.test(finish[1]),
  'HV-162: finishCraft stamps fireFedDay when the recipe is Firewood');
ok(fireOut && /fireFedDay/.test(fireOut[1]),
  'HV-162: the overnight card reads whether the barrel was fed');

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
    if (!sessionStorage.getItem('hvfedfire-init')) {
      sessionStorage.setItem('hvfedfire-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const held = await page.evaluate(() => {
    const recipe = RECIPES.find(r => r.id === 'fire_ration');
    const ev = EVENTS_BAD.find(e => e.id === 'fire_out');
    G.days = 5;
    G.warmth = 70;
    G.goalIndex = GOALS.length;
    G.fireOutUntil = 0;
    G.activeCrafts[recipe.id] = { start: Date.now(), duration: 1 };
    finishCraft(recipe);
    const stamped = G.fireFedDay === 5;
    G.days = 6;
    G.warmth = 70;
    ev.effect();
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      stamped,
      warmth: G.warmth,
      dark: Date.now() < (G.fireOutUntil || 0),
      named: /firewood|stacked|kept the barrel/i.test(log),
    };
  });
  ok(held.stamped && held.warmth === 70 && !held.dark && held.named,
    'HV-162: a stacked night holds warmth, keeps the lights, and names the wood');

  const unfed = await page.evaluate(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'fire_out');
    G.fireFedDay = -9;
    G.days = 8;
    G.warmth = 70;
    G.fireOutUntil = 0;
    ev.effect();
    return {
      warmth: G.warmth,
      dark: Date.now() < (G.fireOutUntil || 0),
    };
  });
  ok(unfed.warmth < 70 && unfed.dark,
    'an unfed barrel still dies overnight');

  const blanket = await page.evaluate(() => {
    const recipe = RECIPES.find(r => r.id === 'blanket');
    const ev = EVENTS_BAD.find(e => e.id === 'fire_out');
    G.days = 9;
    G.fireFedDay = -9;
    G.warmth = 70;
    G.activeCrafts[recipe.id] = { start: Date.now(), duration: 1 };
    finishCraft(recipe);
    const stamped = G.fireFedDay === 9;
    G.days = 10;
    G.warmth = 70;
    G.fireOutUntil = 0;
    ev.effect();
    return {
      stamped,
      warmth: G.warmth,
      dark: Date.now() < (G.fireOutUntil || 0),
    };
  });
  ok(!blanket.stamped && blanket.warmth < 70 && blanket.dark,
    'a Blanket does not stamp the feed; the overnight card still bites');

  const relight = await page.evaluate(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'fire_out');
    const recipe = RECIPES.find(r => r.id === 'fire_ration');
    G.fireFedDay = -9;
    G.days = 11;
    G.warmth = 60;
    ev.effect();
    const dark = Date.now() < (G.fireOutUntil || 0);
    G.activeCrafts[recipe.id] = { start: Date.now(), duration: 1 };
    finishCraft(recipe);
    return {
      dark,
      relit: !((G.fireOutUntil || 0) > Date.now()),
    };
  });
  ok(relight.dark && relight.relit,
    'HV-69 still relights an unfed fire that already went out');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
