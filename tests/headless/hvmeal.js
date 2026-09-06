/* HV-71 — Hot Meal said "Feed a community member" and fed nobody.
 *
 * The recipe costs 4 food + 1 can and is sold as a feed. finishCraft
 * only knows structure, warmth, and goodwill. Hot Meal gives
 * goodwill:3, so you spent a pot of food and a can for a reputation
 * bump. The camp woke just as hungry. Soup Night is the game's own
 * definition of a feed: +4 morale, +2 health. That pot is a different
 * ticket (HV-64 / #716). This one is only the craft.
 *
 * This suite is write-first and source-driven.
 *
 * A. Source: the recipe still sells a feed; finishCraft pays
 *    gives.morale and gives.health; the meal declares +4 / +2.
 *    ui.js is not touched.
 * B. Behaviour: pay the cost, finish the craft. Food and the can
 *    leave; goodwill still +3; morale +4 and health +2. A Blanket
 *    still only warms. Reverting the feed fails the named pay.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg    = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const ui     = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const loop   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');

const mealLine = (cfg.split('\n').find(l => /id:'meal'/.test(l)) || '');
const finishAt = player.indexOf('function finishCraft(r){');
const finishEnd = player.indexOf('function resumeCrafts()', finishAt);
const finish = finishAt >= 0 ? player.slice(finishAt, finishEnd > finishAt ? finishEnd : finishAt + 1600) : '';

ok(/Feed a community member/.test(mealLine),
   'Hot Meal still sells a feed on the recipe');
ok(/food:4/.test(mealLine) && /cans:1/.test(mealLine),
   'the pot is still 4 food and a can — guards the guard');
ok(/goodwill:3/.test(mealLine),
   'the thank-you (+3 goodwill) is still on the recipe');
ok(/morale:\s*4/.test(mealLine) && /health:\s*2/.test(mealLine),
   'HV-71: the recipe declares the same feed Soup Night uses (+4 morale, +2 health)');
ok(finishAt >= 0 && /gives\.goodwill/.test(finish),
   'finishCraft still pays goodwill — guards the guard');
ok(/gives\.morale/.test(finish) && /gives\.health/.test(finish),
   'finishCraft pays morale and health when a recipe gives them');
ok(/soupNightAtDawn/.test(loop) && /everyone ate hot/.test(loop),
   'Soup Night stays its own pot — that ticket is not this one');
ok(!/function finishCraft/.test(ui) && !/gives\.morale/.test(ui),
   'ui.js is not this ticket — it still only paints the craft row');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.addInitScript(() => {
    try { localStorage.setItem('hv-intro-seen', '1'); } catch (e) {}
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => {
    const r = RECIPES.find(x => x.id === 'meal');
    return {
      intro: !!(document.getElementById('intro-modal') && document.getElementById('intro-modal').classList.contains('open')),
      name: r && r.name,
      desc: r && r.desc,
    };
  });
  ok(!boot.intro && boot.name === 'Hot Meal' && /Feed a community member/.test(boot.desc),
     'a returning camp can still craft a Hot Meal');

  const cooked = await page.evaluate(() => {
    const r = RECIPES.find(x => x.id === 'meal');
    G.food = 10; G.cans = 2; G.goodwill = 1; G.morale = 50; G.health = 80;
    G.activeCrafts = G.activeCrafts || {};
    Object.entries(r.cost).forEach(([k, v]) => { G[k] -= v; });
    G.activeCrafts[r.id] = { start: Date.now(), duration: 1 };
    if (typeof logFeed !== 'undefined') logFeed.innerHTML = '';
    if (typeof logLines !== 'undefined') logLines.length = 0;
    finishCraft(r);
    const feed = Array.from(document.querySelectorAll('.log-line')).map(el => el.textContent).join('\n');
    return { food: G.food, cans: G.cans, gw: G.goodwill, morale: G.morale, health: G.health, feed };
  });

  ok(cooked.food === 6 && cooked.cans === 1,
     `the pot still costs 4 food and a can (food ${cooked.food}, cans ${cooked.cans})`);
  ok(cooked.gw === 4,
     `the thank-you is still +3 goodwill (gw ${cooked.gw})`);
  ok(cooked.morale === 54 && cooked.health === 82,
     `HV-71: a Hot Meal feeds someone (+4 morale, +2 health) (morale ${cooked.morale}, health ${cooked.health})`);
  ok(/community member ate|Hot Meal/.test(cooked.feed),
     'the log still names the meal');

  // Control: a Blanket warms; it does not feed.
  const blanketed = await page.evaluate(() => {
    const r = RECIPES.find(x => x.id === 'blanket');
    G.scraps = 10; G.cardboard = 10; G.morale = 50; G.health = 80; G.warmth = 40;
    G.activeCrafts = G.activeCrafts || {};
    Object.entries(r.cost).forEach(([k, v]) => { G[k] -= v; });
    G.activeCrafts[r.id] = { start: Date.now(), duration: 1 };
    finishCraft(r);
    return { morale: G.morale, health: G.health, warmth: G.warmth };
  });
  ok(blanketed.warmth === 55 && blanketed.morale === 50 && blanketed.health === 80,
     `a Blanket still only warms (warmth ${blanketed.warmth}, morale ${blanketed.morale}, health ${blanketed.health})`);

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
