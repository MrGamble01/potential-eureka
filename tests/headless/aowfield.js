/*
 * Age of War — the recruit row stays on the battlefield.
 *
 * The command rail grew to two dozen always-visible orders. On every
 * desktop height the unit cards sat below the fold (spawn top ~989 at
 * 1280×800, ~1269 at 1920×1080) and a mouse player could not hire a
 * Clubman without discovering the page scrolled. Stone Age now shows
 * only the orders you can give, the shell fits the viewport, and the
 * recruit row sits under the field. The battlefield stays 1280:560
 * instead of stretching to fill the leftover, including on phones.
 *
 * Hook-free. Drives the production page.
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const SPAWNS = () => {
  const out = [];
  document.querySelectorAll('.aow-spawn-btn').forEach(el => {
    const b = el.getBoundingClientRect();
    const on = b.width > 8 && b.height > 8 && b.top >= -1 && b.bottom <= innerHeight + 1
      && b.left >= -1 && b.right <= innerWidth + 1;
    out.push({ name: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 24), on, top: Math.round(b.top), bottom: Math.round(b.bottom) });
  });
  return out;
};

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  const errs = [];

  async function open(vp, seed) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(String(e).slice(0, 240)));
    if (seed) await page.addInitScript(seed);
    else await page.addInitScript(() => { try { localStorage.setItem('aow-welcome-seen', '1'); } catch (e) {} });
    await page.goto(BASE + '/ageofwar/index.html', { waitUntil: 'load' });
    await page.waitForSelector('.aow-spawn-btn');
    await page.waitForFunction(() => {
      const c = document.getElementById('aow-canvas');
      return !!(c && c.getBoundingClientRect().height > 40);
    });
    return { ctx, page };
  }

  // A — recruit cards are fully on screen at the heights that used to clip them
  for (const vp of [
    { width: 1280, height: 800 },
    { width: 1280, height: 900 },
    { width: 1280, height: 720 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
    { width: 768, height: 700 },
    { width: 390, height: 844 },
    { width: 375, height: 667 },
    { width: 844, height: 390 },
    { width: 667, height: 375 },
  ]) {
    const { ctx, page } = await open(vp);
    const sp = await page.evaluate(SPAWNS);
    const canvas = await page.evaluate(() => {
      const c = document.getElementById('aow-canvas');
      if (!c) return { h: 0, w: 0 };
      const b = c.getBoundingClientRect();
      return { h: b.height, w: b.width };
    });
    const off = sp.filter(s => !s.on);
    ok(sp.length >= 4 && off.length === 0,
      `${vp.width}×${vp.height}: all ${sp.length} recruit cards on screen`
      + (off.length ? ' — off: ' + off.map(s => s.name + '@' + s.top).join(', ') : ''));
    const ideal = 1280 / 560;
    const ratio = canvas.h > 0 ? canvas.w / canvas.h : 0;
    ok(canvas.h > 40 && Math.abs(ratio / ideal - 1) < 0.03,
      `${vp.width}×${vp.height}: field keeps 1280:560 (was ${Math.round(canvas.w)}×${Math.round(canvas.h)})`);
    if (vp.width === 768 && vp.height === 700) ok(canvas.h >= 260, `768×700 field is still at least 260px (was ${Math.round(canvas.h)})`);
    await ctx.close();
  }

  // B — Stone Age hides Age II orders; Age Up, Pause and Clubman stay clickable
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(String(e).slice(0, 240)));
    // Freeze the sim so the paymaster's once-a-second trickle cannot land
    // between the two gold reads. The recruit click itself is synchronous.
    await page.clock.install({ time: new Date('2026-09-25T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-09-25T12:00:01Z'));
    await page.addInitScript(() => { try { localStorage.setItem('aow-welcome-seen', '1'); } catch (e) {} });
    await page.goto(BASE + '/ageofwar/index.html', { waitUntil: 'load' });
    const gated = await page.evaluate(() => {
      const shown = id => {
        const el = document.getElementById(id);
        if (!el) return false;
        const s = getComputedStyle(el);
        if (s.display === 'none') return false;
        const b = el.getBoundingClientRect();
        return b.width > 2 && b.bottom <= innerHeight + 1 && b.top >= -1;
      };
      return {
        warcry: shown('aow-warcry-btn'),
        merc: shown('aow-merc-btn'),
        duel: shown('aow-duel-btn'),
        age: shown('aow-ageup-btn'),
        pause: shown('aow-pause-btn'),
      };
    });
    ok(!gated.warcry && !gated.merc, 'Stone Age does not show Warcry or Mercs');
    ok(gated.duel, 'Duel stays on the rail so a click can explain an empty field');
    ok(gated.age && gated.pause, 'Age Up and Pause stay on the rail');
    const hired = await page.evaluate(() => {
      const gold = () => document.getElementById('aow-gold').textContent;
      const before = gold();
      const btn = [...document.querySelectorAll('.aow-spawn-btn')].find(el => /Clubman/.test(el.innerText));
      btn.click();
      return { before, after: gold(), status: document.getElementById('aow-train-status').textContent };
    });
    const before = hired.before;
    const after = hired.after;
    const status = hired.status;
    ok(Number(before) - Number(after) === 25, `Clubman costs 25 gold (${before} → ${after})`);
    ok(/1\/5 queued/.test(status), 'the click actually queues a recruit (' + status + ')');
    await ctx.close();
  }

  // C — reaching Age II puts Warcry back on the rail
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, () => {
      localStorage.setItem('aow-welcome-seen', '1');
      localStorage.setItem('aow-session', JSON.stringify({
        v: 2, waveNum: 3, gold: 400, xp: 20, playerEra: 1, enemyEra: 0,
        playerBaseHp: 1400, playerBaseMax: 1500, enemyBaseHp: 1400, enemyBaseMax: 1500,
      }));
    });
    await page.click('#aow-resume-cta');
    await page.waitForFunction(() => {
      const el = document.getElementById('aow-warcry-btn');
      if (!el) return false;
      const s = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      return s.display !== 'none' && b.width > 2 && b.bottom <= innerHeight + 1 && b.top >= -1;
    });
    const warcry = await page.evaluate(() => {
      const el = document.getElementById('aow-warcry-btn');
      if (!el) return false;
      const s = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      return s.display !== 'none' && b.width > 2 && b.bottom <= innerHeight + 1 && b.top >= -1;
    });
    const still = await page.evaluate(SPAWNS);
    ok(warcry, 'Age II shows Warcry on the rail');
    ok(still.length >= 4 && still.every(s => s.on), 'recruit cards stay on screen after aging up');
    await ctx.close();
  }

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
