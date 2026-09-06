/* HV-103 — the HUD said 0 food, and dawn skipped the empty larder.
 *
 * Intro: "so does an empty larder." The dawn check is `G.food<=0`.
 * A camp of one drains 1.5 food. Two bowls become 0.5. updateHUD
 * floors that to 0. The larder looks empty. The check still sees
 * half a bowl and walks away.
 *
 * hvintro pins the 20% warmth line. It never asks what the HUD
 * shows when the drain leaves a fraction.
 *
 *  A. The intro still blames an empty larder, and the HUD still
 *     floors food.
 *  B. A lone mouth, two bowls: after dawn the pot is 0.5 and the
 *     pill reads 0.
 *  C. Named: that dawn still hits health — the empty larder.
 *  D. Isolation: 2.5 bowls become 1. The pill reads 1. No hit.
 *     A true 0 still hits (the old `<=0` path).
 *  Z. Zero page errors.
 *
 * Hook-free. Drives onNewDay() and updateHUD().
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvlarder-init')) {
      sessionStorage.setItem('hvlarder-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const intro = await page.evaluate(() => {
    const body = document.getElementById('intro-body');
    return { copy: body ? body.innerText : '', floors: /Math\.floor\(G\.food\)/.test(String(updateHUD)) };
  });
  ok(/empty larder/i.test(intro.copy),
    `the intro still blames an empty larder (got ${JSON.stringify((intro.copy.match(/[^.]*larder[^.]*\./i)||[''])[0])})`);
  ok(intro.floors, 'the HUD still floors the food pill');

  const dawn = (food0) => page.evaluate((food0) => {
    const real = Math.random;
    Math.random = () => 0.5; // rand(4,10) → 7
    G.population = 1; G.dog = 0; G.food = food0; G.health = 80; G.warmth = 90;
    G.morale = 50; G.rep = 0; G.snapUntil = null; G.days = 1;
    G.structures.tent = false; G.structures.garden = false;
    G.structures.soup_kitchen = false; G.structures.workbench = false;
    G.structures.toolbox = false; G.structures.barrel = false;
    G.structures.pantry = false; G.workers.scrapper = false; G.workers.cook = false;
    G.forecast = 'clear'; G.lastEventDay = G.days + 5;
    G.petitions = {}; G.friendDay = -1;
    onNewDay();
    updateHUD();
    Math.random = real;
    return {
      food: G.food,
      health: G.health,
      hud: document.getElementById('stat-food').textContent,
    };
  }, food0);

  const half = await dawn(2);
  ok(half.food === 0.5 && half.hud === '0',
    `a lone mouth, two bowls: pot ${half.food}, pill ${half.hud}`);
  ok(half.health === 73,
    `HV-103: the HUD said 0 food and dawn still skipped the empty larder (health ${half.health})`);

  const one = await dawn(2.5);
  ok(one.food === 1 && one.hud === '1' && one.health === 80,
    `2.5 bowls become 1 — the pill reads 1, no hit (food ${one.food}, health ${one.health})`);

  const empty = await dawn(1);
  ok(empty.food === 0 && empty.hud === '0' && empty.health === 73,
    `a true 0 still hits (food ${empty.food}, health ${empty.health})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
