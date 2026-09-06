/* HV-84 — Tent said a roof of sorts, then dawn bit like the open.
 *
 * RECIPES.tent.desc: "A roof of sorts."
 * finishCraft added +20 warmth and flipped the structure. Every
 * dawn still took the full season drain — winter 18, otherwise 8 —
 * as if the camp still slept in the open. Coat Rack is weather and
 * snap. The Empty Hook is −2 on the base, for good. Blanket is one
 * night. The tent is the roof, and it never touched the night.
 *
 *  A. The recipe still promises a roof. The +20 wrap stays.
 *  B. seasonDrain() is still 8 / 18 — hvhook's contract is the hook.
 *  C. A standing tent halves that night's base drain (80→76 spring,
 *     80→71 winter). The tent is still standing.
 *  D. Isolation: no tent is still 80→72. The tent does not blunt
 *     a cold day's weather bite (coats do).
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishCraft(tent) and onNewDay().
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
    if (!sessionStorage.getItem('hvtent-init')) {
      sessionStorage.setItem('hvtent-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-emptyhook');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const src = await page.evaluate(() => {
    const r = RECIPES.find(x => x.id === 'tent');
    G.season = 0; const spring = seasonDrain();
    G.season = 3; const winter = seasonDrain();
    return {
      desc: r && r.desc,
      warmth: r && r.gives && r.gives.warmth,
      structure: r && r.gives && r.gives.structure,
      spring, winter,
    };
  });
  ok(src && /a roof of sorts/i.test(src.desc),
    `the Tent recipe still promises a roof of sorts (got ${JSON.stringify(src && src.desc)})`);
  ok(src.warmth === 20 && src.structure === 'tent',
    `the wrap is still +20 warmth and a tent structure (got +${src.warmth}, ${src.structure})`);
  ok(src.spring === 8 && src.winter === 18,
    `seasonDrain() is still the bare 8 / 18 — the hook's contract (spring ${src.spring}, winter ${src.winter})`);

  const wrap = await page.evaluate(() => {
    G.structures.workbench = true;
    G.structures.tent = false;
    const r = RECIPES.find(x => x.id === 'tent');
    G.warmth = 40;
    G.activeCrafts[r.id] = { start: 0, duration: 0 };
    finishCraft(r);
    return { warmth: G.warmth, tent: !!G.structures.tent };
  });
  ok(wrap.warmth === 60 && wrap.tent,
    `crafting still wraps +20 and pitches the tent (40 → ${wrap.warmth}, tent=${wrap.tent})`);

  const dawn = await page.evaluate(() => {
    const park = () => {
      SNAP_CHANCE = 0; G.snapUntil = null;
      G.dog = 1; G.dogMetDay = 99; G.goalIndex = GOALS.length;
      G.arcDone = true; G.arcStage = 3;
      G.lastEventDay = 999; G.friendDay = -1; G.rainBetOn = false;
      G.rayDebt = 0; G.favor = null;
      G.population = 1; G.food = 50; G.morale = 50; G.health = 80;
      G.structures.workbench = false;
      G.structures.garden = false;
      G.structures.soup_kitchen = false;
      G.structures.coats = false;
      G.workers.scrapper = false; G.workers.cook = false;
      G.petitions = {};
      if (typeof saveHvHook === 'function') saveHvHook({ up: false });
    };
    const blow = (days, forecast, tent, warmth0) => {
      const real = Math.random; Math.random = () => 0.99;
      park();
      G.days = days;
      G.forecast = forecast;
      G.weather = 'clear';
      G.structures.tent = tent;
      G.warmth = warmth0;
      onNewDay();
      Math.random = real;
      return {
        warmth: G.warmth,
        tent: !!G.structures.tent,
        season: G.season,
        weather: G.weather,
      };
    };

    const roofSpring = blow(1, 'clear', true, 80);
    const openSpring = blow(1, 'clear', false, 80);
    const roofWinter = blow(20, 'clear', true, 80);
    const openWinter = blow(20, 'clear', false, 80);
    const roofCold = blow(1, 'cold', true, 90);

    return { roofSpring, openSpring, roofWinter, openWinter, roofCold };
  });

  ok(dawn.roofSpring.season === 0 && dawn.roofSpring.tent && dawn.roofSpring.warmth === 76,
    `HV-84: a standing tent halves the spring night (80 → ${dawn.roofSpring.warmth}, tent=${dawn.roofSpring.tent})`);
  ok(dawn.openSpring.warmth === 72 && !dawn.openSpring.tent,
    `without a tent the same spring dawn is still 80 → 72 (got ${dawn.openSpring.warmth})`);
  ok(dawn.roofWinter.season === 3 && dawn.roofWinter.tent && dawn.roofWinter.warmth === 71,
    `a standing tent halves the winter night (80 → ${dawn.roofWinter.warmth})`);
  ok(dawn.openWinter.warmth === 62 && !dawn.openWinter.tent,
    `without a tent winter is still 80 → 62 (got ${dawn.openWinter.warmth})`);
  ok(dawn.roofCold.weather === 'cold' && dawn.roofCold.warmth === 74,
    `the tent does not blunt the weather's bite — spring roof 4 + cold 12 = 16, 90 → ${dawn.roofCold.warmth}`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
