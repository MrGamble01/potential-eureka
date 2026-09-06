/*
 * P5 — Hall of Fame PNG score card (re-runnable).
 *  A. With seeded bests, 🖼 Score card renders a data:image/png preview
 *     whose natural size matches the 2× backing store, plus a download
 *     link with the right filename.
 *  B. The card visually contains the seeded games (probe pixels: at least
 *     one row's accent dot color appears; yellow header text present).
 *  C. Clicking the button again collapses the panel (toggle).
 *  D. Empty-board case still renders a card (no-scores message path).
 *  E. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });

  // A-C: seeded bests
  {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await page.addInitScript(() => {
      localStorage.setItem('snake-high', '42');
      localStorage.setItem('tetris-high', '9001');
      localStorage.setItem('g2048-best', '1234');
    });
    await page.goto(BASE + '/index.html#halloffame', { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    await page.click('#hof-card-btn');
    await page.waitForTimeout(600);
    const card = await page.evaluate(() => new Promise(res => {
      const img = document.getElementById('hof-card-img');
      const a = document.getElementById('hof-card-dl');
      const done = () => res({
        src: img ? img.src.slice(0, 21) : null,
        w: img ? img.naturalWidth : 0,
        h: img ? img.naturalHeight : 0,
        dl: a ? a.getAttribute('download') : null,
        href: a ? a.href.slice(0, 21) : null,
        shown: !document.getElementById('hof-card-out').hidden,
      });
      if (img && img.complete) done(); else if (img) img.onload = done; else done();
    }));
    ok(card.shown && card.src === 'data:image/png;base64'.slice(0, 21), 'card preview renders as a PNG data URL');
    ok(card.w === 1280 && card.h > 400, `card is 2×-crisp (${card.w}×${card.h})`);
    ok(card.dl === 'eureka-hall-of-fame.png' && card.href === 'data:image/png;base64'.slice(0, 21),
      'download link carries the PNG with a proper filename');

    // B: probe the drawn pixels — header gold + at least one accent dot
    const probe = await page.evaluate(() => new Promise(res => {
      const img = document.getElementById('hof-card-img');
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const data = x.getImageData(0, 0, c.width, c.height).data;
      let gold = 0, nonBg = 0;
      for (let i = 0; i < data.length; i += 4) {
        const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
        if (r > 200 && g > 150 && b < 120) gold++;             // F7C948-ish
        if (Math.abs(r - 13) + Math.abs(g - 17) + Math.abs(b - 23) > 40) nonBg++;
      }
      res({ gold, nonBg, px: data.length / 4 });
    }));
    ok(probe.gold > 500, `gold header/score pixels present (${probe.gold})`);
    ok(probe.nonBg > probe.px * 0.01, 'card has substantial drawn content');

    // C: toggle off
    await page.click('#hof-card-btn');
    await page.waitForTimeout(200);
    ok(await page.evaluate(() => document.getElementById('hof-card-out').hidden), 'second click collapses the panel');
    ok(errs.length === 0, `no page errors (seeded)${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  // D: fresh profile, empty board
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await page.goto(BASE + '/index.html#halloffame', { waitUntil: 'load' });
    await page.waitForTimeout(1000);
    await page.click('#hof-card-btn');
    await page.waitForTimeout(500);
    const emptyOk = await page.evaluate(() => {
      const img = document.getElementById('hof-card-img');
      return !!img && img.src.startsWith('data:image/png') && !document.getElementById('hof-card-out').hidden;
    });
    ok(emptyOk, 'empty board still renders a card (no-scores message path)');
    ok(errs.length === 0, `no page errors (empty)${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  await browser.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
