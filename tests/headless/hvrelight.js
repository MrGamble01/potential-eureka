/*
 * HV-68 — Firewood said keep the barrel burning, then left it dark.
 *
 * Fire Went Out dims the barrel for 30s (G.fireOutUntil). Firewood's
 * card says "Keep the barrel burning." finishCraft only added +10
 * warmth. The lights stayed out until the wall-clock expired. A
 * blanket is also +warmth and must not steal the relight — only
 * firewood feeds the barrel.
 *
 *  A. Source: finishCraft clears fireOutUntil for fire_ration.
 *  B. The recipe still promises to keep the barrel burning.
 *  C. After Fire Went Out, finishing Firewood relights (fireOutUntil
 *     is no longer in the future). Warmth still rises by 10.
 *  D. A Blanket after the same event does not relight.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives triggerEvent + finishCraft on the production path.
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
const finish = /function finishCraft\(r\)\{([\s\S]*?)\n\}/.exec(player);
ok(!!finish, 'finishCraft is still in player.js');
ok(finish && /fire_ration/.test(finish[1]) && /fireOutUntil/.test(finish[1]),
  'HV-68: finishCraft clears fireOutUntil when the recipe is Firewood');
ok(/id:'fire_ration'[\s\S]{0,180}?Keep the barrel burning/.test(cfg),
  'Firewood still promises to keep the barrel burning');

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
    if (!sessionStorage.getItem('hvrelight-init')) {
      sessionStorage.setItem('hvrelight-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const wood = await t(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'fire_out');
    const recipe = RECIPES.find(r => r.id === 'fire_ration');
    G.warmth = 60;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(ev, false);
    const outAfterEvent = Date.now() < (G.fireOutUntil || 0);
    const warmthAfterEvent = G.warmth;
    G.activeCrafts[recipe.id] = { start: Date.now(), duration: 1 };
    finishCraft(recipe);
    return {
      outAfterEvent,
      warmthAfterEvent,
      warmth: G.warmth,
      relit: !((G.fireOutUntil || 0) > Date.now()),
      fireOutUntil: G.fireOutUntil || 0,
      banner: document.getElementById('ev-title').textContent,
      desc: recipe.desc,
    };
  });
  ok(wood.banner === 'Fire Went Out', `the card is still Fire Went Out (${wood.banner})`);
  ok(wood.outAfterEvent, 'Fire Went Out leaves the barrel dark');
  ok(wood.relit, `Firewood relights the barrel (fireOutUntil=${wood.fireOutUntil})`);
  ok(wood.warmth === wood.warmthAfterEvent + 10,
    `Firewood still adds +10 warmth (${wood.warmthAfterEvent} → ${wood.warmth})`);

  const blanket = await t(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'fire_out');
    const recipe = RECIPES.find(r => r.id === 'blanket');
    G.warmth = 60;
    triggerEvent(ev, false);
    const outAfterEvent = Date.now() < (G.fireOutUntil || 0);
    G.activeCrafts[recipe.id] = { start: Date.now(), duration: 1 };
    finishCraft(recipe);
    return {
      outAfterEvent,
      stillOut: Date.now() < (G.fireOutUntil || 0),
      warmth: G.warmth,
    };
  });
  ok(blanket.outAfterEvent && blanket.stillOut,
    'a Blanket after Fire Went Out does not relight the barrel');
  ok(blanket.warmth === 75, `a Blanket still adds +15 warmth (${blanket.warmth})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
