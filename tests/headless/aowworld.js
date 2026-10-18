/* Age of War sky — the shared clock on the field.
 * A pinned night storm darkens the canvas, slows the
 * march, and hits harder. A clear morning does not.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errors = [];

  async function boot(query) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      localStorage.setItem('aow-welcome-seen', '1');
      localStorage.setItem('aow-coach-done', '1');
    });
    await page.goto(BASE + '/ageofwar/' + query, { waitUntil: 'load' });
    await page.waitForFunction(() => window.AOW_WORLD && document.getElementById('aow-sky') && document.getElementById('aow-sky').textContent);
    return { context, page };
  }

  function lum(rgb) { return rgb[0] * 0.3 + rgb[1] * 0.5 + rgb[2] * 0.2; }

  const day = await boot('?world=day-clear');
  const daySky = await day.page.evaluate(() => {
    const c = document.getElementById('aow-canvas');
    const ctx = c.getContext('2d');
    const p = ctx.getImageData(Math.floor(c.width * 0.5), 12, 1, 1).data;
    const chip = document.getElementById('aow-sky').textContent;
    const mods = window.AOW_WORLD.snapshot().mods;
    return { chip, key: c.dataset.world, move: mods.move, foe: mods.foe, rgb: [p[0], p[1], p[2]] };
  });
  ok(/Day/.test(daySky.chip) && /Clear/.test(daySky.chip), `clear morning is labeled (${daySky.chip})`);
  ok(daySky.key === 'day|clear' && daySky.move === 1 && daySky.foe === 1, `clear morning modifiers stay at 1 (${daySky.key})`);
  await day.context.close();

  const storm = await boot('?world=night-storm');
  const stormSky = await storm.page.evaluate(() => {
    const c = document.getElementById('aow-canvas');
    const ctx = c.getContext('2d');
    const p = ctx.getImageData(Math.floor(c.width * 0.5), 12, 1, 1).data;
    const w = window.AOW_WORLD;
    return {
      chip: document.getElementById('aow-sky').textContent,
      key: c.dataset.world,
      move: Number(c.dataset.worldMove),
      foe: Number(c.dataset.worldFoe),
      heavy: Number(c.dataset.worldHeavy),
      foeDmg: w.unitDamage(20, { side: 'enemy', line: 'melee', range: 26 }),
      heavyDmg: w.unitDamage(20, { side: 'player', line: 'heavy', range: 30 }),
      rgb: [p[0], p[1], p[2]],
    };
  });
  ok(/Night/.test(stormSky.chip) && /Storm/.test(stormSky.chip), `night storm is labeled (${stormSky.chip})`);
  ok(stormSky.key === 'night|storm' && stormSky.move < 0.8 && stormSky.foe > 1.2 && stormSky.heavy === 1.25,
    `the field is publishing the storm (${stormSky.move}, ${stormSky.foe}, ${stormSky.heavy})`);
  ok(stormSky.foeDmg > 20 && stormSky.heavyDmg > 20, `blows land harder (${stormSky.foeDmg}, ${stormSky.heavyDmg})`);
  ok(lum(stormSky.rgb) < lum(daySky.rgb) - 8, `night is darker than day (${stormSky.rgb.join(',')} vs ${daySky.rgb.join(',')})`);
  await storm.context.close();

  const rain = await boot('?world=day-rain');
  const rainSky = await rain.page.evaluate(() => {
    const c = document.getElementById('aow-canvas');
    const ctx = c.getContext('2d');
    const band = ctx.getImageData(0, Math.floor(c.height * 0.35), c.width, 8).data;
    let cool = 0;
    for (let i = 0; i < band.length; i += 16) {
      if (band[i + 2] > band[i] + 12 && band[i + 2] > 80) cool++;
    }
    return { chip: document.getElementById('aow-sky').textContent, cool, ranged: Number(c.dataset.worldRanged) };
  });
  ok(/Rain/.test(rainSky.chip) && rainSky.ranged < 1, `rain is on the field and the bows (${rainSky.chip}, ${rainSky.ranged})`);
  ok(rainSky.cool > 4, `rain reads on the canvas (${rainSky.cool} cool samples)`);
  await rain.context.close();

  await browser.close();
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });
