/*
 * P8 — achievements for the newer games (re-runnable).
 *  A. Seeding stacker/vector/cascade/maze marks unlocks the four new
 *     trophies on boot (plus coins minted for them).
 *  B. Under-threshold seeds unlock nothing new.
 *  C. Completionist now requires all 15 keys: with only the 11 legacy keys
 *     set it stays locked; with all 15 it unlocks.
 *  D. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

const LEGACY = { 'snake-high': '100', 'tetris-high': '5000', 'breakout-high': '3000',
  'asteroids-high': '5000', 'g2048-best': '2048', 'mines-best-beginner': '45',
  'connect4-streak': '3', 'word5-streak': '5', 'cycles-streak': '5',
  'pong-streak': '3', 'matrix-best': '8' };

async function boot(browser, seeds) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.addInitScript(s => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seeds);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const got = await page.evaluate(() => ({
    unlocked: Object.keys(Achievements.unlocked()),
    coins: Coins.load().balance,
  }));
  await ctx.close();
  return { ...got, errs };
}

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });

  // A. new trophies unlock
  const a = await boot(browser, {
    'stacker-best': '12', 'vector-best': '8', 'cascade-best': '300', 'maze-golds': '1', 'maze-best': '500',
  });
  for (const id of ['stacker-12', 'vector-8', 'cascade-300', 'maze-gold']) {
    ok(a.unlocked.includes(id), `${id} unlocks`);
  }
  ok(a.coins >= 40, `coins minted for the new trophies (${a.coins})`);
  ok(a.errs.length === 0, 'no page errors (unlock boot)');

  // B. under threshold
  const b = await boot(browser, {
    'stacker-best': '11', 'vector-best': '7', 'cascade-best': '299', 'maze-golds': '0',
  });
  ok(!b.unlocked.some(id => ['stacker-12', 'vector-8', 'cascade-300', 'maze-gold'].includes(id)),
    'under-threshold seeds unlock none of the four');

  // C. completionist requires all 15
  const c = await boot(browser, LEGACY);
  ok(!c.unlocked.includes('completionist'), '11 legacy keys alone no longer complete the board');
  const d = await boot(browser, {
    ...LEGACY, 'maze-best': '100', 'stacker-best': '5', 'vector-best': '2', 'cascade-best': '50', 'crate-best': '1',
  });
  ok(d.unlocked.includes('completionist'), 'all 16 keys unlock Completionist');
  ok(d.errs.length === 0 && c.errs.length === 0 && b.errs.length === 0, 'no page errors (other boots)');

  await browser.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
