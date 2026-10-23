/*
 * The Spark Shop sells a lantern canvas. Homeless Village builds a
 * real tent. The canvas has to land on that mesh.
 *
 * Camp economy stays put: the tent recipe is still cardboard 8,
 * scraps 6, wood 3, warmth 20, and raising the mesh does not spend.
 *
 *  A. The recipe line and the structure hook are unchanged.
 *  B. A bare tent is the old green cloth and has no fly.
 *  C. A worn lantern canvas recolors the cloth and shows the fly.
 *  D. Tearing the tent and raising it again keeps the worn canvas.
 *  E. Taking the canvas off and raising the tent returns the green cloth.
 *  F. Sparks, cardboard, scraps, wood, and warmth do not move.
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
const recipeLine = config.split('\n').filter(function (line) { return line.indexOf("id:'tent'") >= 0; })[0] || '';
ok(recipeLine.indexOf('cost:{cardboard:8,scraps:6,wood:3}') >= 0
  && recipeLine.indexOf("gives:{structure:'tent',warmth:20}") >= 0
  && recipeLine.indexOf('time:10000') >= 0,
  'the tent recipe is still cardboard 8, scraps 6, wood 3, warmth 20');
ok(loop.indexOf('buildTent(-4,-2)') >= 0 && loop.indexOf('tent-lantern') < 0 && loop.indexOf('sparks') < 0,
  'the camp still raises the tent at (-4,-2) and the loop does not know the shop');
ok(scene.indexOf('TENT_BARE=0x2a4030') >= 0 && scene.indexOf("name='tent-fly'") >= 0
  && scene.indexOf('EurekaCosmetics.look') >= 0,
  'the tent cloth stays bare green unless a shop look is worn');
ok(html.indexOf('/js/cosmetics.js') >= 0, 'Homeless Village loads the shop');

function purse(worn) {
  const career = {
    sparks: 80,
    owned: worn ? { 'tent-lantern': 1700000000000 } : {},
    equipped: worn ? { tent: 'tent-lantern' } : {},
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
  return { ctx, page, errs };
}

function campState() {
  const recipe = (typeof RECIPES !== 'undefined' ? RECIPES : []).filter(function (r) { return r.id === 'tent'; })[0];
  const canvas = tentMesh && tentMesh.getObjectByName('tent-canvas');
  const fly = tentMesh && tentMesh.getObjectByName('tent-fly');
  let gold = -1;
  try {
    const rt = new THREE.WebGLRenderTarget(700, 450);
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    const buf = new Uint8Array(700 * 450 * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, 700, 450, buf);
    renderer.setRenderTarget(null);
    rt.dispose();
    gold = 0;
    for (let i = 0; i < buf.length; i += 4) {
      const r = buf[i], g = buf[i + 1], b = buf[i + 2];
      // The unlit fly is #ffe38a. The barrel fire is redder and fails this.
      if (r > 240 && g > 210 && b > 110 && b < 170) gold++;
    }
  } catch (e) { gold = -1; }
  const look = window.EurekaCosmetics && EurekaCosmetics.look ? EurekaCosmetics.look() : null;
  return {
    wood: G.wood, scraps: G.scraps, cardboard: G.cardboard, warmth: G.warmth,
    food: G.food, goodwill: G.goodwill,
    cost: recipe && recipe.cost,
    gives: recipe && recipe.gives,
    time: recipe && recipe.time,
    canvas: canvas ? canvas.material.color.getHex() : null,
    fly: fly ? fly.material.color.getHex() : null,
    look: look && look.tent ? look.tent.id : null,
    sparks: look ? look.sparks : null,
    gold: gold,
    tent: !!tentMesh,
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
      G.wood = 9; G.scraps = 11; G.cardboard = 14; G.warmth = 80; G.food = 3; G.goodwill = 2;
      G.structures.tent = true;
      refreshStructures();
    });
    const bareRead = await bare.page.evaluate(campState);
    ok(bareRead.tent && bareRead.canvas === 0x2a4030 && bareRead.fly == null && bareRead.gold === 0 && bareRead.look == null,
      'a bare tent is green cloth with no fly (' + bareRead.canvas + ', gold ' + bareRead.gold + ')');
    ok(bareRead.wood === 9 && bareRead.scraps === 11 && bareRead.cardboard === 14 && bareRead.warmth === 80
      && bareRead.food === 3 && bareRead.goodwill === 2 && bareRead.sparks === 80
      && bareRead.cost && bareRead.cost.cardboard === 8 && bareRead.cost.scraps === 6 && bareRead.cost.wood === 3
      && bareRead.gives && bareRead.gives.warmth === 20 && bareRead.time === 10000,
      'raising a bare tent does not spend camp stock or sparks');
    ok(bare.errs.length === 0, 'bare camp has zero page errors' + (bare.errs[0] ? ' — ' + bare.errs[0] : ''));
    await bare.page.screenshot({ path: '/tmp/hv-tent-bare.png' });
    await bare.ctx.close();

    const worn = await openCamp(browser, true);
    const wornRead = await worn.page.evaluate(() => {
      G.wood = 9; G.scraps = 11; G.cardboard = 14; G.warmth = 80; G.food = 3; G.goodwill = 2;
      G.structures.tent = true;
      refreshStructures();
      const before = {
        wood: G.wood, scraps: G.scraps, cardboard: G.cardboard, warmth: G.warmth,
        food: G.food, goodwill: G.goodwill,
      };
      G.structures.tent = false;
      refreshStructures();
      const down = !tentMesh;
      G.structures.tent = true;
      refreshStructures();
      return { before: before, down: down };
    });
    const afterTear = await worn.page.evaluate(campState);
    ok(wornRead.down && afterTear.tent && afterTear.look === 'tent-lantern'
      && afterTear.canvas === 0xe8a04a && afterTear.fly === 0xffe38a && afterTear.gold >= 80,
      'the lantern canvas colors the cloth and the fly (canvas ' + afterTear.canvas
        + ' fly ' + afterTear.fly + ' look ' + afterTear.look + ' gold ' + afterTear.gold + ')');
    ok(afterTear.wood === wornRead.before.wood && afterTear.scraps === wornRead.before.scraps
      && afterTear.cardboard === wornRead.before.cardboard && afterTear.warmth === wornRead.before.warmth
      && afterTear.food === wornRead.before.food && afterTear.goodwill === wornRead.before.goodwill
      && afterTear.sparks === 80
      && afterTear.cost.cardboard === 8 && afterTear.cost.scraps === 6 && afterTear.cost.wood === 3
      && afterTear.gives.warmth === 20,
      'wearing the canvas and raising the tent again leaves camp numbers and sparks alone');

    const off = await worn.page.evaluate(() => {
      const spent = EurekaCosmetics.unequip('tent');
      G.structures.tent = false;
      refreshStructures();
      G.structures.tent = true;
      refreshStructures();
      return { ok: !!(spent && spent.ok), sparks: spent && spent.sparks };
    });
    const bareAgain = await worn.page.evaluate(campState);
    ok(off.ok && off.sparks === 80 && bareAgain.look == null && bareAgain.canvas === 0x2a4030
      && bareAgain.fly == null && bareAgain.gold === 0
      && bareAgain.wood === 9 && bareAgain.warmth === 80 && bareAgain.cardboard === 14,
      'taking the canvas off returns the green tent and spends nothing');
    ok(worn.errs.length === 0, 'worn camp has zero page errors' + (worn.errs[0] ? ' — ' + worn.errs[0] : ''));
    await worn.ctx.close();

    const shot = await openCamp(browser, true);
    await shot.page.evaluate(() => {
      G.structures.tent = true;
      refreshStructures();
      renderer.render(scene, camera);
    });
    await shot.page.screenshot({ path: '/tmp/hv-tent-worn.png' });
    await shot.ctx.close();
  } finally {
    await browser.close();
  }
  console.log(pass + ' passed, ' + fail + ' failed');
  if (fail) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
