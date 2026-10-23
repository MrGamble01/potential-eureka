/*
 * The Spark Shop sells a ward cloth. Homeless Village builds a
 * real night clinic. The cloth has to land on that tarp.
 *
 * Clinic economy stays put: the cot is still wood 7, scraps 5,
 * cardboard 3, goodwill 4. Gauze is still scraps 2, cardboard 1.
 * Raising the mesh does not spend.
 *
 *  A. The recipe lines and the raise call are unchanged.
 *  B. A bare clinic is the old gray tarp and has no band.
 *  C. A worn ward cloth recolors the tarp and shows the band.
 *  D. Tearing the clinic and raising it again keeps the cloth.
 *  E. Taking the cloth off and raising the clinic returns the gray tarp.
 *  F. Wood, scraps, cardboard, goodwill, bandages, and sparks do not move.
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
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'homeless-village.html'), 'utf8');
const clinicLine = config.split('\n').filter(function (line) { return line.indexOf("id:'clinic'") >= 0; })[0] || '';
const gauzeLine = config.split('\n').filter(function (line) { return line.indexOf("id:'gauze'") >= 0; })[0] || '';
ok(clinicLine.indexOf('cost:{wood:7,scraps:5,cardboard:3,goodwill:4}') >= 0
  && clinicLine.indexOf("gives:{structure:'clinic'}") >= 0
  && clinicLine.indexOf('time:11000') >= 0,
  'the night clinic is still wood 7, scraps 5, cardboard 3, goodwill 4');
ok(gauzeLine.indexOf('cost:{scraps:2,cardboard:1}') >= 0 && gauzeLine.indexOf('gives:{bandages:2}') >= 0
  && gauzeLine.indexOf('time:3000') >= 0,
  'gauze is still two rolls for scraps 2 and cardboard 1');
ok(loop.indexOf('buildClinic(6.4,-1.6)') >= 0 && loop.indexOf('color:0xd8d4cc') >= 0
  && loop.indexOf("name='clinic-tarp-hem'") >= 0,
  'the camp still raises the clinic at (6.4,-1.6) and a bare tarp is still the gray box');
ok(html.indexOf('/js/cosmetics.js') >= 0 && loop.indexOf('window.__') < 0,
  'Homeless Village loads the shop and the clinic has no test hook');

function purse(worn) {
  const career = {
    sparks: 80,
    owned: worn ? { 'tarp-ward': 1 } : {},
    equipped: worn ? { tarp: 'tarp-ward' } : {},
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
  const recipe = (typeof RECIPES !== 'undefined' ? RECIPES : []).filter(function (r) { return r.id === 'clinic'; })[0];
  const gauze = (typeof RECIPES !== 'undefined' ? RECIPES : []).filter(function (r) { return r.id === 'gauze'; })[0];
  const plane = clinicMesh && clinicMesh.getObjectByName('clinic-tarp');
  const hem = clinicMesh && clinicMesh.getObjectByName('clinic-tarp-hem');
  let pink = -1;
  try {
    const rt = new THREE.WebGLRenderTarget(700, 450);
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    const buf = new Uint8Array(700 * 450 * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, 700, 450, buf);
    renderer.setRenderTarget(null);
    rt.dispose();
    pink = 0;
    for (let i = 0; i < buf.length; i += 4) {
      const r = buf[i], g = buf[i + 1], b = buf[i + 2];
      // Unlit ward band #ff4ad2. The gray tarp, the red cross, and the fire fail this.
      if (r > 240 && g > 50 && g < 100 && b > 185 && b < 235 && r > g + 140) pink++;
    }
  } catch (e) { pink = -1; }
  const look = window.EurekaCosmetics && EurekaCosmetics.look ? EurekaCosmetics.look() : null;
  return {
    wood: G.wood, scraps: G.scraps, cardboard: G.cardboard, goodwill: G.goodwill, bandages: G.bandages,
    cost: recipe && recipe.cost,
    gives: recipe && recipe.gives,
    time: recipe && recipe.time,
    gauzeCost: gauze && gauze.cost,
    gauzeGives: gauze && gauze.gives,
    gauzeTime: gauze && gauze.time,
    plane: plane ? plane.material.color.getHex() : null,
    hem: hem ? hem.material.color.getHex() : null,
    look: look && look.tarp ? look.tarp.id : null,
    sparks: look ? look.sparks : null,
    pink: pink,
    clinic: !!clinicMesh,
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
      G.wood = 40; G.scraps = 30; G.cardboard = 20; G.goodwill = 12; G.bandages = 4;
      G.structures.clinic = true;
      refreshStructures();
    });
    const bareRead = await bare.page.evaluate(campState);
    ok(bareRead.clinic && bareRead.plane === 0xd8d4cc && bareRead.hem == null
      && bareRead.pink === 0 && bareRead.look == null,
      'a bare clinic is the gray tarp with no band (' + bareRead.plane + ', pink ' + bareRead.pink + ')');
    ok(bareRead.wood === 40 && bareRead.scraps === 30 && bareRead.cardboard === 20
      && bareRead.goodwill === 12 && bareRead.bandages === 4 && bareRead.sparks === 80
      && bareRead.cost && bareRead.cost.wood === 7 && bareRead.cost.scraps === 5
      && bareRead.cost.cardboard === 3 && bareRead.cost.goodwill === 4
      && bareRead.gives && bareRead.gives.structure === 'clinic' && bareRead.time === 11000
      && bareRead.gauzeCost && bareRead.gauzeCost.scraps === 2 && bareRead.gauzeCost.cardboard === 1
      && bareRead.gauzeGives && bareRead.gauzeGives.bandages === 2 && bareRead.gauzeTime === 3000,
      'raising a bare clinic does not spend the cot or the gauze');
    ok(bare.errs.length === 0, 'bare camp has zero page errors' + (bare.errs[0] ? ' — ' + bare.errs[0] : ''));
    await bare.ctx.close();

    const worn = await openCamp(browser, true);
    const wornRead = await worn.page.evaluate(() => {
      G.wood = 40; G.scraps = 30; G.cardboard = 20; G.goodwill = 12; G.bandages = 4;
      G.structures.clinic = true;
      refreshStructures();
      const before = {
        wood: G.wood, scraps: G.scraps, cardboard: G.cardboard, goodwill: G.goodwill, bandages: G.bandages,
      };
      G.structures.clinic = false;
      refreshStructures();
      const down = !clinicMesh;
      G.structures.clinic = true;
      refreshStructures();
      return { before: before, down: down };
    });
    const afterTear = await worn.page.evaluate(campState);
    ok(wornRead.down && afterTear.clinic && afterTear.look === 'tarp-ward'
      && afterTear.plane === 0x6d4cff && afterTear.hem === 0xff4ad2 && afterTear.pink >= 40,
      'the ward cloth colors the tarp and the band (plane ' + afterTear.plane
        + ' hem ' + afterTear.hem + ' look ' + afterTear.look + ' pink ' + afterTear.pink + ')');
    ok(afterTear.wood === wornRead.before.wood && afterTear.scraps === wornRead.before.scraps
      && afterTear.cardboard === wornRead.before.cardboard && afterTear.goodwill === wornRead.before.goodwill
      && afterTear.bandages === wornRead.before.bandages && afterTear.sparks === 80
      && afterTear.cost.wood === 7 && afterTear.cost.scraps === 5
      && afterTear.cost.cardboard === 3 && afterTear.cost.goodwill === 4
      && afterTear.gauzeCost.scraps === 2 && afterTear.gauzeCost.cardboard === 1,
      'wearing the cloth and raising the clinic again leaves camp numbers and sparks alone');

    const off = await worn.page.evaluate(() => {
      const spent = EurekaCosmetics.unequip('tarp');
      G.structures.clinic = false;
      refreshStructures();
      G.structures.clinic = true;
      refreshStructures();
      return { ok: !!(spent && spent.ok), sparks: spent && spent.sparks };
    });
    const bareAgain = await worn.page.evaluate(campState);
    ok(off.ok && off.sparks === 80 && bareAgain.look == null && bareAgain.plane === 0xd8d4cc
      && bareAgain.hem == null && bareAgain.pink === 0
      && bareAgain.wood === 40 && bareAgain.cardboard === 20 && bareAgain.goodwill === 12
      && bareAgain.bandages === 4,
      'taking the cloth off returns the gray tarp and spends nothing');
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
