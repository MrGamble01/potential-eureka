/* HV-191 — Marisol left a bag of tamales on the fence post,
 * then a rainy dawn still delivered them dry.
 *
 * Her perk is leftovers some mornings. The log puts the bag on
 * the fence post. A fence post is out in the weather. A rainy
 * dawn still handed +2 food like a clear one. The rain now soaks
 * the bag — she still left them; they are not breakfast.
 *
 * #874 is dawn order vs hungry Biscuit. #845 is flyers/kindness.
 * #867 is flyers in the rain. This is the bag on the post.
 *
 *  A. Source: the perk still sends leftovers. The log still names
 *     the fence post.
 *  B. Source: Marisol's dawn favor reads weather==='rain'.
 *     ui.js does not.
 *  C. Live: friend Marisol, pinned leftovers, rain — the camp
 *     drain lands and the bag does not. The log names the soak.
 *  D. The same roll on a clear dawn still pays +2 tamales.
 *  E. A stranger Marisol on a rainy dawn leaves nothing.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives production regularFavorsAtDawn().
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const fav = /function regularFavorsAtDawn\(\)\{([\s\S]*?)\n\}/.exec(loop);
const body = fav ? fav[1] : '';

ok(/sends leftovers to the camp some mornings/.test(cfg)
  && /bag of tamales on the fence post/.test(loop),
  'Marisol still sends leftovers; the bag still sits on the fence post');
ok(body && /regularStage\('marisol'\)/.test(body)
  && /weather\s*===\s*'rain'/.test(body),
  'HV-191: Marisol\'s dawn leftovers read a rainy sky');
ok(!/tamales/.test(ui) && !/fence post/.test(ui),
  'ui.js untouched — the soak lives on the dawn favor');

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
    if (!sessionStorage.getItem('hvwettamale-init')) {
      sessionStorage.setItem('hvwettamale-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const dawnLeftovers = (weather, friend) => page.evaluate(({ weather, friend }) => {
    const real = Math.random;
    Math.random = () => 0.1;
    G.regulars.marisol = friend ? 5 : 0;
    G.dog = 0;
    G.workers.scrapper = null;
    G.workers.cook = null;
    G.structures.pantry = false;
    G.structures.garden = false;
    G.population = 1;
    G.food = 10;
    G.rep = 0;
    G.lastEventDay = G.days + 5;
    G.forecast = weather;
    G.snapUntil = null;
    onNewDay();
    Math.random = real;
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      food: G.food,
      soaked: /rain|soak/i.test(log) && /tamales|fence post/i.test(log),
      dry: /left a bag of tamales on the fence post\. \+/.test(log),
    };
  }, { weather, friend });

  const rain = await dawnLeftovers('rain', true);
  ok(rain.food === 8.5 && rain.soaked && !rain.dry,
    `HV-191: a rainy leftovers dawn soaks the bag (food ${rain.food})`);

  const clear = await dawnLeftovers('clear', true);
  ok(clear.food === 10.5 && clear.dry && !clear.soaked,
    `a clear leftovers dawn still pays +2 tamales (food ${clear.food})`);

  const stranger = await dawnLeftovers('rain', false);
  ok(stranger.food === 8.5 && !stranger.soaked && !stranger.dry,
    'a stranger Marisol on a rainy dawn leaves nothing');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
