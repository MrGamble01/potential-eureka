/*
 * IDEA-SITE-3 — daily challenge.
 *  A. Banner renders with today’s date and 7 game chips.
 *  B. Determinism (2048): two fresh sessions arming the daily get the
 *     same opening board; two free-play sessions differ (control).
 *  C. Determinism (maze): two daily sessions render pixel-identical
 *     level-1 labyrinths.
 *  D. End-to-end (snake): daily run to game over shows the 📅 Daily line.
 *  E. Stale arcade-daily-* keys are swept on boot; today's stays.
 *  F. Free play never touches the seeded stream; zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

async function newPage(browser, errs) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  return { ctx, page };
}

// 16-cell colour signature of the 2048 board.
const boardSig = page => page.evaluate(() => {
  const c = document.getElementById('g2048-canvas');
  const x = c.getContext('2d');
  const n = 4, cw = c.width / n, ch = c.height / n, out = [];
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) {
    const d = x.getImageData(Math.floor(col * cw + cw / 2), Math.floor(r * ch + ch / 2), 1, 1).data;
    out.push(d[0] + ',' + d[1] + ',' + d[2]);
  }
  return out.join('|');
});

async function daily2048Sig(browser, errs) {
  const { ctx, page } = await newPage(browser, errs);
  await page.click('.daily-chip[data-game="game2048"]');
  await page.waitForTimeout(900);
  await page.keyboard.press(' ');
  await page.waitForTimeout(700);
  const sig = await boardSig(page);
  const active = await page.evaluate(() => Daily.isActive('game2048'));
  await ctx.close();
  return { sig, active };
}

async function free2048Sig(browser, errs) {
  const { ctx, page } = await newPage(browser, errs);
  await page.evaluate(() => { location.hash = '#2048'; });
  await page.waitForTimeout(900);
  await page.keyboard.press(' ');
  await page.waitForTimeout(700);
  const sig = await boardSig(page);
  const active = await page.evaluate(() => Daily.isActive('game2048'));
  await ctx.close();
  return { sig, active };
}

// Wall/floor lattice of the maze canvas — layout only, immune to the gem
// sparkle and runner idle animation that break raw screenshot equality.
async function mazeLattice(browser, errs, viaDaily) {
  const { ctx, page } = await newPage(browser, errs);
  if (viaDaily) await page.click('.daily-chip[data-game="maze"]');
  else await page.evaluate(() => { location.hash = '#maze'; });
  await page.waitForTimeout(1500);
  const grid = await page.evaluate(() => {
    const c = document.getElementById('maze-canvas');
    const x = c.getContext('2d');
    const out = [];
    for (let ry = 0.05; ry < 1; ry += 0.045) {
      let row = '';
      for (let rx = 0.05; rx < 1; rx += 0.045) {
        const d = x.getImageData(Math.floor(rx * c.width), Math.floor(ry * c.height), 1, 1).data;
        row += (d[0] + d[1] + d[2] > 180) ? '#' : '.';
      }
      out.push(row);
    }
    return out.join('\n');
  });
  await ctx.close();
  return grid;
}

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errs = [];

  // A. Banner
  {
    const { ctx, page } = await newPage(browser, errs);
    const banner = await page.evaluate(() => ({
      visible: !!document.getElementById('daily-banner'),
      date: document.getElementById('daily-date').textContent,
      chips: document.querySelectorAll('.daily-chip').length,
    }));
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    ok(banner.visible && banner.chips === 7, `banner renders with 7 chips`);
    ok(banner.date === key, `banner date is today (${banner.date})`);
    await ctx.close();
  }

  // B. 2048 determinism + control
  const d1 = await daily2048Sig(browser, errs);
  const d2 = await daily2048Sig(browser, errs);
  ok(d1.active && d2.active, '2048 daily runs report active seeded state');
  ok(d1.sig === d2.sig, 'two daily 2048 sessions open with the SAME board');
  let controlDiffers = false;
  for (let i = 0; i < 3 && !controlDiffers; i++) {
    const f1 = await free2048Sig(browser, errs);
    ok(!f1.active || i > 0, i === 0 ? 'free-play 2048 is NOT seeded' : 'retry');
    if (f1.sig !== d1.sig) controlDiffers = true;
  }
  ok(controlDiffers, 'free-play 2048 board differs from the daily board');

  // C. Maze determinism + control
  const m1 = await mazeLattice(browser, errs, true);
  const m2 = await mazeLattice(browser, errs, true);
  ok(m1 === m2, 'two daily mazes have the SAME layout');
  let mazeControlDiffers = false;
  for (let i = 0; i < 3 && !mazeControlDiffers; i++) {
    if (await mazeLattice(browser, errs, false) !== m1) mazeControlDiffers = true;
  }
  ok(mazeControlDiffers, 'free-play maze layout differs from the daily maze');

  // D. Snake end-to-end: wrap is off, snake drives into the right wall
  {
    const { ctx, page } = await newPage(browser, errs);
    await page.click('.daily-chip[data-game="snake"]');
    await page.waitForTimeout(600);
    await page.keyboard.press(' ');
    await page.waitForTimeout(4000); // 15 cells at 120ms < 2s; margin for speed
    const over = await page.evaluate(() => ({
      text: document.getElementById('snake-overlay').textContent,
      shown: document.getElementById('snake-overlay').style.display !== 'none',
    }));
    ok(over.shown && /📅 Daily/.test(over.text), `snake daily game-over shows the Daily line`);
    await ctx.close();
  }

  // E. Sweep: stale key dies, today's survives
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await page.goto(BASE + '/index.html', { waitUntil: 'load' });
    await page.evaluate(() => {
      localStorage.setItem('arcade-daily-snake-2020-01-01', '99');
      localStorage.setItem('arcade-daily-snake-' + Utils.todayKey(), '7');
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1000);
    const keys = await page.evaluate(() => ({
      stale: localStorage.getItem('arcade-daily-snake-2020-01-01'),
      today: localStorage.getItem('arcade-daily-snake-' + Utils.todayKey()),
      chipShowsBest: document.querySelector('.daily-chip[data-game="snake"] .daily-best') !== null,
    }));
    ok(keys.stale === null, 'stale daily key swept on boot');
    ok(keys.today === '7', "today's daily key survives the sweep");
    ok(keys.chipShowsBest, "banner chip shows today's best");
    await ctx.close();
  }

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
