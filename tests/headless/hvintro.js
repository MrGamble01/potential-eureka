/* HV-56 — the opening, and the numbers it quotes.
 *
 * Five of the six flagships greet a new player with a crash course.
 * Homeless Village did not. Measured on a fresh profile it put **47 live
 * controls** on screen, a goal reading "Survive 3 days (0/3)", and not one
 * word about how anything worked — the most controls of any flagship and
 * the only one with no explainer at all.
 *
 * Two things a newcomer reliably bounces off are invisible from the screen:
 *   - Scavenge is proximity-gated (HV-2). Stood anywhere else the button
 *     just greys out, and the reason lives in a `title` tooltip — which is
 *     nothing at all on a touch screen.
 *   - The Workbench gates 13 of the 18 recipes. Miss it and most of the
 *     craft panel stays dark for no stated reason.
 *
 * This suite has two jobs, and the second is the one that earns its keep.
 *
 * A. The panel exists, shows once, stays dismissed, and is reachable again.
 *    A crash course that reappears every session is a nuisance, and one you
 *    can never re-read is a leaflet.
 *
 * B. **Every number the copy quotes still matches the game.** The panel
 *    says 5 wood + 4 scraps, 13 of 18, below 20%. Quoted numbers rot — I
 *    have shipped that exact bug before (AOW-58 promised a 22-second
 *    Veteran bar that the code set at 22.5). So each figure is recomputed
 *    here from RECIPES and the dawn code and compared to the rendered
 *    text. Copy that lies to a new player is worse than the silence it
 *    replaced: silence makes them look, a wrong number makes them trust.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');

// ---- recompute the quoted figures from the game itself ----
const recipesBlock = /var RECIPES\s*=\s*\[([\s\S]*?)\n\];/.exec(cfg);
const recipeIds = recipesBlock ? [...recipesBlock[1].matchAll(/\{id:'([a-z_]+)'/g)].map(m => m[1]) : [];
const gatedCount = recipesBlock ? [...recipesBlock[1].matchAll(/requires:'workbench'/g)].length : -1;
const benchCost = /id:'workbench'[\s\S]{0,120}?cost:\{wood:(\d+),scraps:(\d+)\}/.exec(cfg);
const coldBar = /if\(G\.warmth<(\d+)\)\s*G\.health\s*=/.exec(loop);
const winterHalves = /G\.season===3\?\.5:1/.test(player);

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });

  // --- A. behaviour -------------------------------------------------
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2200);

  const shown = await page.$eval('#intro-modal', el => el.classList.contains('open')).catch(() => false);
  ok(shown, 'a brand-new camp is met by the crash course');

  const copy = await page.$eval('#intro-body', el => el.innerText.replace(/\s+/g, ' ')).catch(() => '');
  ok(copy.length > 200, `the panel actually says something (${copy.length} chars)`);

  // The day must not burn while they read about the day.
  const t0 = await page.evaluate(() => G.timeOfDay);
  await page.waitForTimeout(2500);
  const t1 = await page.evaluate(() => G.timeOfDay);
  ok(t0 === t1, `the day is paused behind the panel (timeOfDay ${t0} -> ${t1})`);

  // dismiss
  await page.click('#intro-go');
  await page.waitForTimeout(400);
  const gone = await page.$eval('#intro-modal', el => el.classList.contains('open'));
  ok(!gone, 'the start button dismisses it');

  const marked = await page.evaluate(() => localStorage.getItem('hv-intro-seen'));
  ok(marked === '1', 'dismissing records that it has been seen');

  // reopen via the ? button
  await page.click('#help-btn');
  await page.waitForTimeout(400);
  const reopened = await page.$eval('#intro-modal', el => el.classList.contains('open'));
  ok(reopened, 'the ? button in the top bar reopens it — a crash course you cannot re-read is a leaflet');
  await page.click('#intro-close');
  await page.waitForTimeout(300);

  // returning camp
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2200);
  const again = await page.$eval('#intro-modal', el => el.classList.contains('open'));
  ok(!again, 'a returning camp is NOT shown it again');

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);

  // The coverage reach.js gives up by arriving as a returning camp: once the
  // greeting is gone, nothing of it is left lying over the controls. A modal
  // that fails to clear up after itself would lock a new player out of the
  // whole game on their first visit — the exact opposite of the point.
  const covered = await page.evaluate(() => {
    const m = document.getElementById('intro-modal');
    if (m && getComputedStyle(m).display !== 'none') return 'the panel itself is still displayed';
    const ids = ['action-scavenge', 'action-forage', 'action-panhandle', 'action-rest', 'craft-workbench'];
    const bad = [];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      const b = el.getBoundingClientRect();
      if (b.width < 2 || b.height < 2) continue;
      const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      if (cx < 1 || cx > innerWidth - 1 || cy < 1 || cy > innerHeight - 1) continue;
      const hit = document.elementFromPoint(cx, cy);
      if (!(hit && (hit === el || el.contains(hit)))) bad.push(id);
    }
    return bad.length ? 'covered: ' + bad.join(', ') : null;
  });
  ok(covered === null, `dismissed, the greeting leaves the controls clear${covered ? ' — ' + covered : ''}`);

  // --- B. the numbers still match the game -------------------------
  ok(recipeIds.length > 0 && gatedCount >= 0,
     `RECIPES parsed from source (${recipeIds.length} recipes, ${gatedCount} gated) — guards the guard`);

  const gateClaim = new RegExp(`\\b${gatedCount}\\b[\\s\\S]{0,24}\\b${recipeIds.length}\\b`);
  ok(gateClaim.test(copy),
     `the copy's workbench-gating figure matches RECIPES (${gatedCount} of ${recipeIds.length})`);

  ok(benchCost && new RegExp(`${benchCost[1]}\\s*wood`).test(copy) && new RegExp(`${benchCost[2]}\\s*scraps`).test(copy),
     `the quoted Workbench cost matches config (${benchCost ? benchCost[1] + ' wood, ' + benchCost[2] + ' scraps' : '??'})`);

  ok(coldBar && new RegExp(`${coldBar[1]}\\s*%`).test(copy),
     `the quoted cold threshold matches the dawn code (warmth < ${coldBar ? coldBar[1] : '??'})`);

  ok(winterHalves && /winter/i.test(copy),
     'the copy mentions winter, and winter really does halve scavenging in player.js');

  ok(/wasd/i.test(copy) && /dumpster/i.test(copy),
     'the copy names both halves of the gate a newcomer bounces off: how to move, and that scavenging needs a dumpster');

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
