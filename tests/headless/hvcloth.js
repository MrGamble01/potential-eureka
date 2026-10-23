/*
 * The Spark Shop sells a supper cloth. Homeless Village builds a
 * real soup kitchen. The cloth has to land on that awning.
 *
 * Camp economy stays put: the pot is still wood 10, scraps 8,
 * cans 5, goodwill 5, and raising the mesh does not spend.
 * The salvaged corner awning stays scraps 4, cans 2.
 *
 *  A. The recipe lines and the structure hook are unchanged.
 *  B. A bare kitchen is the old brown plane and has no hem.
 *  C. A worn supper cloth recolors the plane and shows the hem.
 *  D. Tearing the kitchen and raising it again keeps the cloth.
 *  E. Taking the cloth off and raising the kitchen returns the brown plane.
 *  F. Wood, scraps, cans, goodwill, food, and sparks do not move.
 *  Z. Zero page errors.
 *
 * Hook-free. Builds through refreshStructures(), the same call craft uses.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const config = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const scene = fs.readFileSync(path.join(ROOT, 'homeless-village/js/scene.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'homeless-village.html'), 'utf8');
const soupLine = config.split('\n').filter(function (line) { return line.indexOf("id:'soup_kitchen'") >= 0; })[0] || '';
const awningLine = config.split('\n').filter(function (line) { return line.indexOf("id:'awning'") >= 0; })[0] || '';
ok(soupLine.indexOf('cost:{wood:10,scraps:8,cans:5,goodwill:5}') >= 0
  && soupLine.indexOf("gives:{structure:'soup_kitchen'}") >= 0
  && soupLine.indexOf('time:15000') >= 0,
  'the soup kitchen is still wood 10, scraps 8, cans 5, goodwill 5');
ok(awningLine.indexOf('cost:{scraps:4,cans:2}') >= 0,
  'the salvaged corner awning is still scraps 4, cans 2');
ok(loop.indexOf('buildSoupKitchen(0,-6)') >= 0 && loop.indexOf('kitchen-supper') < 0 && loop.indexOf('sparks') < 0,
  'the camp still raises the kitchen at (0,-6) and the loop does not know the shop');
ok(scene.indexOf('SOUP_AWNING_BARE=0x7a4820') >= 0 && scene.indexOf("name='soup-awning-hem'") >= 0
  && scene.indexOf('EurekaCosmetics.look') >= 0 && scene.indexOf('opacity:.85') >= 0,
  'the awning stays the bare brown plane unless a shop look is worn');
ok(html.indexOf('/js/cosmetics.js') >= 0, 'Homeless Village loads the shop');

function purse(worn) {
  const career = {
    sparks: 80,
    owned: worn ? { 'kitchen-supper': 1700000000000 } : {},
    equipped: worn ? { kitchen: 'kitchen-supper' } : {},
    xp: 0,
  };
  return JSON.stringify({ v: 1, games: {}, career: career });
}

async function openCamp(browser, worn) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
  await page.addInitScript((doc) => {
    localStorage.setItem('hv-intro-seen', '1');
    localStorage.removeItem('homeless_village_v1');
    localStorage.setItem('eureka-progress', doc);
  }, purse(worn));
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => typeof refreshStructures === 'function' && !!window.EurekaCosmetics, { timeout: 15000 });
  return { ctx: ctx, page: page, errs: errs };
}

function campState() {
  const recipe = (typeof RECIPES !== 'undefined' ? RECIPES : []).filter(function (r) { return r.id === 'soup_kitchen'; })[0];
  const awning = (typeof RECIPES !== 'undefined' ? RECIPES : []).filter(function (r) { return r.id === 'awning'; })[0];
  const plane = soupKitchenMesh && soupKitchenMesh.getObjectByName('soup-awning');
  const hem = soupKitchenMesh && soupKitchenMesh.getObjectByName('soup-awning-hem');
  let mint = -1;
  try {
    const rt = new THREE.WebGLRenderTarget(700, 450);
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    const buf = new Uint8Array(700 * 450 * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, 700, 450, buf);
    renderer.setRenderTarget(null);
    rt.dispose();
    mint = 0;
    for (let i = 0; i < buf.length; i += 4) {
      const r = buf[i], g = buf[i + 1], b = buf[i + 2];
      // The unlit hem is #3ef0d0. Barrel fire and the brown plane fail this.
      if (r > 40 && r < 90 && g > 220 && b > 180 && b < 230) mint++;
    }
  } catch (e) { mint = -1; }
  const look = window.EurekaCosmetics && EurekaCosmetics.look ? EurekaCosmetics.look() : null;
  return {
    wood: G.wood, scraps: G.scraps, cans: G.cans, goodwill: G.goodwill, food: G.food,
    cost: recipe && recipe.cost,
    gives: recipe && recipe.gives,
    time: recipe && recipe.time,
    awningCost: awning && awning.cost,
    plane: plane ? plane.material.color.getHex() : null,
    opacity: plane ? plane.material.opacity : null,
    hem: hem ? hem.material.color.getHex() : null,
    look: look && look.kitchen ? look.kitchen.id : null,
    sparks: look ? look.sparks : null,
    mint: mint,
    kitchen: !!soupKitchenMesh,
  };
}

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  try {
    const bare = await openCamp(browser, false);
    await bare.page.evaluate(() => {
      G.wood = 40; G.scraps = 30; G.cans = 20; G.goodwill = 12; G.food = 6;
      G.structures.soup_kitchen = true;
      refreshStructures();
    });
    const bareRead = await bare.page.evaluate(campState);
    ok(bareRead.kitchen && bareRead.plane === 0x7a4820 && bareRead.opacity === 0.85
      && bareRead.hem == null && bareRead.mint === 0 && bareRead.look == null,
      'a bare kitchen is the brown plane with no hem (' + bareRead.plane + ', mint ' + bareRead.mint + ')');
    ok(bareRead.wood === 40 && bareRead.scraps === 30 && bareRead.cans === 20 && bareRead.goodwill === 12
      && bareRead.food === 6 && bareRead.sparks === 80
      && bareRead.cost && bareRead.cost.wood === 10 && bareRead.cost.scraps === 8
      && bareRead.cost.cans === 5 && bareRead.cost.goodwill === 5
      && bareRead.gives && bareRead.gives.structure === 'soup_kitchen' && bareRead.time === 15000
      && bareRead.awningCost && bareRead.awningCost.scraps === 4 && bareRead.awningCost.cans === 2,
      'raising a bare kitchen does not spend the pot or the corner awning');
    ok(bare.errs.length === 0, 'bare camp has zero page errors' + (bare.errs[0] ? ' — ' + bare.errs[0] : ''));
    await bare.ctx.close();

    const worn = await openCamp(browser, true);
    const wornRead = await worn.page.evaluate(() => {
      G.wood = 40; G.scraps = 30; G.cans = 20; G.goodwill = 12; G.food = 6;
      G.structures.soup_kitchen = true;
      refreshStructures();
      const before = { wood: G.wood, scraps: G.scraps, cans: G.cans, goodwill: G.goodwill, food: G.food };
      G.structures.soup_kitchen = false;
      refreshStructures();
      const down = !soupKitchenMesh;
      G.structures.soup_kitchen = true;
      refreshStructures();
      return { before: before, down: down };
    });
    const afterTear = await worn.page.evaluate(campState);
    ok(wornRead.down && afterTear.kitchen && afterTear.look === 'kitchen-supper'
      && afterTear.plane === 0xe23b6a && afterTear.hem === 0x3ef0d0 && afterTear.mint >= 40
      && afterTear.opacity === 0.85,
      'the supper cloth colors the awning and the hem (plane ' + afterTear.plane
        + ' hem ' + afterTear.hem + ' look ' + afterTear.look + ' mint ' + afterTear.mint + ')');
    ok(afterTear.wood === wornRead.before.wood && afterTear.scraps === wornRead.before.scraps
      && afterTear.cans === wornRead.before.cans && afterTear.goodwill === wornRead.before.goodwill
      && afterTear.food === wornRead.before.food && afterTear.sparks === 80
      && afterTear.cost.wood === 10 && afterTear.cost.scraps === 8
      && afterTear.cost.cans === 5 && afterTear.cost.goodwill === 5
      && afterTear.awningCost.scraps === 4 && afterTear.awningCost.cans === 2,
      'wearing the cloth and raising the kitchen again leaves camp numbers and sparks alone');

    const off = await worn.page.evaluate(() => {
      const spent = EurekaCosmetics.unequip('kitchen');
      G.structures.soup_kitchen = false;
      refreshStructures();
      G.structures.soup_kitchen = true;
      refreshStructures();
      return { ok: !!(spent && spent.ok), sparks: spent && spent.sparks };
    });
    const bareAgain = await worn.page.evaluate(campState);
    ok(off.ok && off.sparks === 80 && bareAgain.look == null && bareAgain.plane === 0x7a4820
      && bareAgain.hem == null && bareAgain.mint === 0
      && bareAgain.wood === 40 && bareAgain.cans === 20 && bareAgain.goodwill === 12,
      'taking the cloth off returns the brown awning and spends nothing');
    ok(worn.errs.length === 0, 'worn camp has zero page errors' + (worn.errs[0] ? ' — ' + worn.errs[0] : ''));
    await worn.ctx.close();
  } finally {
    await browser.close();
  }
  console.log(pass + ' passed, ' + fail + ' failed');
  if (fail) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
