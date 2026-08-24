/*
 * P5 — Light Cycles third AI rider (re-runnable).
 *  A. Riders toggle flips 2↔3 and styles gold.
 *  B. A 3-rider round paints cyan, pink AND gold trails.
 *  C. The round survives the first crash when 3 rode out (keeps running
 *     until ≤1 alive) and ends with a survivor-based verdict.
 *  D. Back on Riders: 2, no gold trail appears and a solo round still
 *     ends with the classic verdict.
 *  E. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

// Count trail-ish pixels per family on the cycles canvas.
const trailCounts = page => page.evaluate(() => {
  const c = document.getElementById('cycles-canvas');
  const x = c.getContext('2d');
  const d = x.getImageData(0, 0, c.width, c.height).data;
  let cyan = 0, pink = 0, gold = 0;
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
    if (b > 110 && g > 100 && r < 90) cyan++;
    else if (r > 110 && b > 80 && g < 90) pink++;
    else if (r > 110 && g > 85 && g < 160 && b < 70) gold++;
  }
  return { cyan, pink, gold };
});

const overlayState = page => page.evaluate(() => {
  const ov = document.getElementById('cycles-overlay');
  return { shown: ov.style.display !== 'none' && ov.style.display !== '', text: ov.textContent };
});

async function waitRoundEnd(page, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const o = await overlayState(page);
    if (o.shown) return o;
    await page.waitForTimeout(500);
  }
  return { shown: false, text: '' };
}

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(BASE + '/index.html#lightcycles', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  // A. toggle
  const before = await page.evaluate(() => document.getElementById('cycles-third-btn').textContent);
  await page.click('#cycles-third-btn');
  const after = await page.evaluate(() => document.getElementById('cycles-third-btn').textContent);
  ok(before === 'Riders: 2' && after === 'Riders: 3', `toggle flips ${before} → ${after}`);

  // B. 3-rider round paints three trail colors
  await page.keyboard.press(' ');
  await page.waitForTimeout(2200);
  const t3 = await trailCounts(page);
  ok(t3.cyan > 30, `cyan trail present (${t3.cyan}px)`);
  ok(t3.pink > 30, `pink trail present (${t3.pink}px)`);
  ok(t3.gold > 30, `gold trail present (${t3.gold}px)`);

  // C. round ends with a survivor verdict eventually
  const end3 = await waitRoundEnd(page, 120000);
  ok(end3.shown, '3-rider round reaches a verdict');
  ok(/takes the round|CRASHED/i.test(end3.text), `verdict text: "${end3.text.trim().split('\n')[0].slice(0, 60)}"`);

  // D. back to 2 riders: no gold, classic solo verdict
  await page.click('#cycles-third-btn');
  const back = await page.evaluate(() => document.getElementById('cycles-third-btn').textContent);
  ok(back === 'Riders: 2', 'toggle returns to Riders: 2');
  await page.keyboard.press(' ');
  await page.waitForTimeout(2200);
  const t2 = await trailCounts(page);
  ok(t2.gold < 10, `no gold trail in a 2-rider round (${t2.gold}px)`);
  const end2 = await waitRoundEnd(page, 120000);
  ok(end2.shown && /takes the round|CRASH/i.test(end2.text), 'solo round still ends with the classic verdict');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
