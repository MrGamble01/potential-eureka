/*
 * DAILY-2 — the daily banner honours the direction it declares.
 *
 * Daily.GAMES marks Minefield `dir:'min'` (its daily best is a clear TIME,
 * lower is better) but nothing read that field: the chip rendered "★ 45"
 * exactly like Snake's "★ 1240", and Daily.result() returned a bare number
 * into Minefield's HUD.
 *
 *  A. A max-direction chip (Snake) still reads "★ <score>".
 *  B. The min-direction chip (Minefield) reads as a clock time, not a star.
 *  C. Every chip carries a title saying which way beats it.
 *  D. Chips with no score yet show no badge, and say so in the title.
 *  E. Daily.result() prints the unit for a min game and not for a max one.
 *  F. The existing contract still holds: 7 chips, .daily-best still the
 *     badge hook, arming a chip still routes to that game. No page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

(async () => {
  const browser = await chromium.launch();
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  // Seed one score game and one time game for today, then re-render the
  // banner through the module's own entry point (not a reload) so this
  // tests refreshBanner rather than boot.
  await page.evaluate(() => {
    const d = Utils.todayKey();
    localStorage.setItem('arcade-daily-snake-' + d, '1240');
    localStorage.setItem('arcade-daily-minesweeper-' + d, '45');
    Daily.refreshBanner();
  });

  const chip = sel => page.evaluate(s => {
    const el = document.querySelector(s);
    if (!el) return null;
    const b = el.querySelector('.daily-best');
    return { text: el.textContent.trim(), badge: b ? b.textContent.trim() : null, title: el.title };
  }, sel);

  const snake = await chip('.daily-chip[data-game="snake"]');
  const mines = await chip('.daily-chip[data-game="minesweeper"]');
  const tetris = await chip('.daily-chip[data-game="tetris"]');

  // A — the score game is unchanged.
  ok(snake && snake.badge === '★ 1240', `Snake's chip still reads "★ 1240" (got ${snake && snake.badge})`);

  // B — the time game no longer masquerades as a score.
  ok(mines && !/★/.test(mines.badge || ''),
    `Minefield's chip drops the ★ score glyph (got ${mines && mines.badge})`);
  ok(mines && /45\s*s/.test(mines.badge || ''),
    `Minefield's chip shows 45 as a time with its unit (got ${mines && mines.badge})`);

  // C — every scored chip says which direction beats it.
  ok(mines && /fast/i.test(mines.title || ''),
    `Minefield's title says you beat it by going faster (got ${JSON.stringify(mines && mines.title)})`);
  ok(snake && /high/i.test(snake.title || ''),
    `Snake's title says you beat it by going higher (got ${JSON.stringify(snake && snake.title)})`);
  ok(mines && snake && mines.title !== snake.title,
    'the two directions do not share one title');

  // D — an unplayed chip.
  ok(tetris && tetris.badge === null, 'an unplayed chip shows no badge');
  ok(tetris && /yet/i.test(tetris.title || ''), 'an unplayed chip says so in its title');

  // E — the line that lands in Minefield's HUD carries the unit; a score
  // game's does not. Read through the real API, restoring storage after.
  const lines = await page.evaluate(() => {
    const d = Utils.todayKey();
    const keep = {
      m: localStorage.getItem('arcade-daily-minesweeper-' + d),
      s: localStorage.getItem('arcade-daily-snake-' + d),
    };
    const out = {
      minImproved: Daily.result('minesweeper', 30, 'min'),   // 30 < 45 → new best
      minTied:     Daily.result('minesweeper', 99, 'min'),   // 99 > 30 → reports best
      maxTied:     Daily.result('snake', 5, undefined),      // 5 < 1240 → reports best
    };
    localStorage.setItem('arcade-daily-minesweeper-' + d, keep.m);
    localStorage.setItem('arcade-daily-snake-' + d, keep.s);
    Daily.refreshBanner();
    return out;
  });
  ok(/\b30s\b/.test(lines.minImproved),
    `a new Minefield daily best prints seconds (got ${JSON.stringify(lines.minImproved)})`);
  ok(/\b99s\b/.test(lines.minTied) && /\b30s\b/.test(lines.minTied),
    `a non-improving Minefield run prints both times with units (got ${JSON.stringify(lines.minTied)})`);
  ok(!/\ds\b/.test(lines.maxTied) && /1240/.test(lines.maxTied),
    `a score game's line stays unit-less (got ${JSON.stringify(lines.maxTied)})`);

  // F — nothing about the banner's existing contract moved.
  const shape = await page.evaluate(() => ({
    chips: document.querySelectorAll('.daily-chip').length,
    badgeHook: document.querySelector('.daily-chip[data-game="snake"] .daily-best') !== null,
    date: (document.getElementById('daily-date') || {}).textContent,
  }));
  ok(shape.chips === 7, `all 7 daily chips still render (got ${shape.chips})`);
  ok(shape.badgeHook, '.daily-best is still the badge hook the hub styles');
  ok(shape.date === await page.evaluate(() => Utils.todayKey()), "the banner still dates itself today");

  await page.click('.daily-chip[data-game="minesweeper"]');
  await page.waitForTimeout(700);
  ok(await page.evaluate(() => location.hash === '#minesweeper'),
    'clicking the Minefield chip still arms it and routes there');

  ok(errs.length === 0, `no page errors (${errs.join(' | ')})`);

  await browser.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
