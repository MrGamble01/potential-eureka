/* HV-78 — Patch Shelter said reinforce a sleeping spot, then the tent tore.
 *
 * RECIPES.shelter.desc: "Reinforce a sleeping spot."
 * finishCraft only added +8 warmth. The winter wind still took the
 * tent at the same 15% roll. A Blanket is also +warmth and must not
 * steal the patch — only Patch Shelter reinforces the spot.
 *
 *  A. The recipe still promises a reinforced sleeping spot.
 *  B. Crafting it still wraps +8 warmth.
 *  C. A patched tent survives the winter wind that would tear it,
 *     and the patch is spent.
 *  D. Isolation: no patch, Blanket, and Firewood all still lose the tent.
 *  E. A City Sweep still demolishes a patched tent — the patch is
 *     weather, not the police.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishCraft(shelter) and onNewDay().
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
    if (!sessionStorage.getItem('hvshelter-init')) {
      sessionStorage.setItem('hvshelter-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const src = await page.evaluate(() => {
    const r = RECIPES.find(x => x.id === 'shelter');
    return { desc: r && r.desc, warmth: r && r.gives && r.gives.warmth };
  });
  ok(src && /reinforce a sleeping spot/i.test(src.desc),
    `the Patch Shelter recipe still promises a reinforced sleeping spot (got ${JSON.stringify(src && src.desc)})`);
  ok(src.warmth === 8,
    `the wrap is still +8 warmth (got ${src.warmth})`);

  const crafted = await page.evaluate(() => {
    const r = RECIPES.find(x => x.id === 'shelter');
    G.warmth = 50;
    G.shelterPatched = false;
    G.activeCrafts[r.id] = { start: 0, duration: 0 };
    finishCraft(r);
    return { warmth: G.warmth, patched: !!G.shelterPatched };
  });
  ok(crafted.warmth === 58,
    `crafting still wraps +8 warmth (50 → ${crafted.warmth})`);
  ok(crafted.patched,
    `HV-78: Patch Shelter stamps a patch on the sleeping spot (patched=${crafted.patched})`);

  // Winter wind: days 20 → 21 is season 3, tear chance 15%.
  // Math.random = 0 always tears, and would drop a workbench too.
  const wind = await page.evaluate(() => {
    const park = () => {
      SNAP_CHANCE = 0; G.snapUntil = null;
      G.dog = 1; G.dogMetDay = 99; G.goalIndex = GOALS.length;
      G.arcDone = true; G.arcStage = 3;
      G.lastEventDay = 999; G.friendDay = -1; G.rainBetOn = false;
      G.rayDebt = 0; G.favor = null;
      G.population = 1; G.food = 50; G.warmth = 80; G.morale = 50; G.health = 80;
      G.forecast = 'clear'; G.weather = 'clear';
      G.structures.workbench = false;
      G.structures.garden = false;
      G.structures.soup_kitchen = false;
      G.workers.scrapper = false; G.workers.cook = false;
      G.petitions = {};
    };
    const blow = (days) => {
      const real = Math.random; Math.random = () => 0;
      park();
      G.days = days;
      G.structures.tent = true;
      onNewDay();
      Math.random = real;
      return { tent: !!G.structures.tent, patched: !!G.shelterPatched, season: G.season };
    };

    // days 20–26 → 21–27 after onNewDay, all winter (floor(d/7)%4 === 3).
    G.shelterPatched = true;
    const held = blow(20);

    G.shelterPatched = false;
    const bare = blow(21);

    const rB = RECIPES.find(x => x.id === 'blanket');
    G.activeCrafts[rB.id] = { start: 0, duration: 0 };
    G.shelterPatched = false;
    finishCraft(rB);
    const afterBlanket = !!G.shelterPatched;
    const blanketWind = blow(22);

    const rF = RECIPES.find(x => x.id === 'fire_ration');
    G.activeCrafts[rF.id] = { start: 0, duration: 0 };
    G.shelterPatched = false;
    finishCraft(rF);
    const afterWood = !!G.shelterPatched;
    const woodWind = blow(23);

    return { held, bare, afterBlanket, blanketWind, afterWood, woodWind };
  });
  ok(wind.held.season === 3 && wind.held.tent && !wind.held.patched,
    `HV-78: Patch Shelter keeps the tent up when the wind would tear it (tent=${wind.held.tent}, patched-after=${wind.held.patched}, season=${wind.held.season})`);
  ok(wind.bare.season === 3 && !wind.bare.tent,
    `without a patch the same winter wind still takes the tent (tent=${wind.bare.tent})`);
  ok(!wind.afterBlanket && !wind.blanketWind.tent,
    `a Blanket is +warmth and does not patch — the tent still tears`);
  ok(!wind.afterWood && !wind.woodWind.tent,
    `Firewood is +warmth and does not patch — the tent still tears`);

  const sweep = await page.evaluate(() => {
    G.structures.tent = true;
    G.shelterPatched = true;
    G.packedUp = false; G.garageCover = false; G.structures.stash = false;
    G.structures.soup_kitchen = false; G.structures.workbench = false;
    G.structures.garden = false; G.mural = 0;
    G.scraps = 0; G.food = 0; G.morale = 50;
    EVENTS_BAD.find(e => e.id === 'sweep').effect();
    return { tent: !!G.structures.tent, patched: !!G.shelterPatched };
  });
  ok(!sweep.tent,
    `a City Sweep still demolishes a patched tent — the patch is weather, not the police`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
