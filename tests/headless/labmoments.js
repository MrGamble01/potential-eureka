/* Grow Op photo mode.
 *
 * P and the camera button open the shared camera. The corner
 * holds still while it is open, then the plants pick up again.
 * A night sky is filed under its own name, and the frame keeps
 * the moon that the weather overlay paints over the shop.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const src = fs.readFileSync(path.join(__dirname, '../../drug-lab.html'), 'utf8');
ok(src.includes('src="/js/moments.js"'), 'Grow Op loads the shared photo mode');
ok(src.includes("game: 'growop'") && src.includes("hotkey: { key: 'p', shift: false }"), 'P opens the camera');
ok(src.includes('momentHold') && src.includes('const held = momentHold'), 'the corner holds still while the camera is open');
ok(src.includes("noteMoment('Pure batch')") && src.includes("night: 'Night on the corner'") && src.includes("rain: 'Rain on the block'"),
  'a pure cook and a changed sky are filed by name');
ok(src.includes('drawImage(labSkyCanvas'), 'the frame keeps the weather overlay');

const HITS = [
  '.ea-back', '#act-badge', '#status-bar', '#lab-sky', '#cash-hud', '#market-hud',
  '#heat-hud', '#goal-hud', '#lab-help-btn', '#sfx-btn', '#manage-btn', '#lab-tray',
  '#left-panel', '#touch-dock', '#next-step', '#stick', '#arcade-ai-launch',
];

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errs = [];

  async function boot(viewport) {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push(viewport.width + ' ' + String(e).slice(0, 240)));
    await page.addInitScript(() => localStorage.setItem('growop-intro-seen', '1'));
    await page.goto(BASE + '/drug-lab.html?world=day-clear', { waitUntil: 'load' });
    await page.waitForSelector('#diff-modal.open');
    await page.click('#diff-careful');
    await page.waitForFunction(() => window.EurekaMoments && document.getElementById('lab-moments')
      && !document.getElementById('diff-modal').classList.contains('open'));
    await page.waitForFunction(() => EurekaMoments.frameCount() >= 2);
    await page.waitForFunction(() => {
      const nodes = document.querySelectorAll('#labels div');
      return Array.from(nodes).some((n) => /\d+s/.test(n.textContent));
    });
    await page.waitForSelector('#arcade-ai-launch');
    await page.waitForTimeout(500);
    return { ctx, page };
  }

  async function layout(page, width) {
    return page.evaluate(({ width, hits }) => {
      const btn = document.getElementById('lab-moments').getBoundingClientRect();
      function shown(el) {
        if (!el || el.hidden) return null;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return null;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return null;
        if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return null;
        return r;
      }
      const found = [];
      hits.forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => {
          const r = shown(el);
          if (!r) return;
          const hit = !(btn.right <= r.left + 0.5 || btn.left >= r.right - 0.5 || btn.bottom <= r.top + 0.5 || btn.top >= r.bottom - 0.5);
          if (hit) found.push(sel);
        });
      });
      return {
        hits: found,
        w: btn.width,
        h: btn.height,
        inView: btn.top >= -1 && btn.left >= -1 && btn.right <= width + 1 && btn.bottom <= innerHeight + 1,
      };
    }, { width, hits: HITS });
  }

  function plantLine(page) {
    return page.evaluate(() => Array.from(document.querySelectorAll('#labels div')).map((n) => n.textContent).join('|'));
  }

  async function moon(page) {
    return page.evaluate(async () => {
      const frames = EurekaMoments.frames();
      const last = frames[frames.length - 1];
      if (!last || !last.url) return { bright: 0, w: 0, center: 0 };
      const img = new Image();
      img.src = last.url;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const x = Math.round(c.width * 0.78);
      const y = Math.round(c.height * 0.14);
      const r = 28;
      const spot = ctx.getImageData(Math.max(0, x - r), Math.max(0, y - r), r * 2, r * 2).data;
      let bright = 0;
      for (let i = 0; i < spot.length; i += 4) {
        const l = spot[i] + spot[i + 1] + spot[i + 2];
        if (l > bright) bright = l;
      }
      const cx = Math.round(c.width * 0.5);
      const cy = Math.round(c.height * 0.55);
      const mid = ctx.getImageData(cx - 12, cy - 12, 24, 24).data;
      let center = 0;
      for (let i = 0; i < mid.length; i += 4) {
        const l = mid[i] + mid[i + 1] + mid[i + 2];
        if (l > center) center = l;
      }
      return { bright, center, w: c.width, url: last.url.slice(0, 22) };
    });
  }

  {
    const { ctx, page } = await boot({ width: 1280, height: 800 });
    const placed = await layout(page, 1280);
    ok(placed.inView && placed.w >= 44 && placed.h >= 44 && placed.hits.length === 0,
      'the camera button sits clear of the shop chrome' + (placed.hits.length ? ' (' + placed.hits.join(', ') + ')' : ''));
    await page.keyboard.press('p');
    const opened = await page.evaluate(() => ({
      view: EurekaMoments.view(),
      cash: getComputedStyle(document.getElementById('cash-hud')).visibility,
      sky: getComputedStyle(document.getElementById('lab-sky')).visibility,
    }));
    ok(opened.view === 'photo' && opened.cash === 'hidden' && opened.sky === 'hidden',
      'P opens photo mode and hides the HUD');
    const before = await plantLine(page);
    await page.waitForTimeout(1200);
    const frozen = await plantLine(page);
    ok(frozen === before && /\d+s/.test(before), 'the grow holds still while the camera is open (' + before + ' → ' + frozen + ')');
    await page.keyboard.press('Escape');
    ok(await page.evaluate(() => EurekaMoments.view()) === 'live', 'Escape closes photo mode');
    await page.waitForFunction((prev) => {
      const now = Array.from(document.querySelectorAll('#labels div')).map((n) => n.textContent).join('|');
      return now !== prev;
    }, frozen, { timeout: 3000 });
    ok(true, 'the plants pick up again after the camera closes');
    await page.click('#lab-moments');
    ok(await page.evaluate(() => EurekaMoments.view()) === 'photo', 'the camera button opens photo mode');
    await page.keyboard.press('Escape');
    const day = await moon(page);
    const shot = await page.evaluate(() => {
      const frames = EurekaMoments.frames();
      return frames.length ? frames[frames.length - 1].url : '';
    });
    await page.evaluate(() => LAB_WORLD.force({ phase: 'night', weather: 'clear' }));
    await page.waitForFunction((prev) => {
      const frames = EurekaMoments.frames();
      const url = frames.length ? frames[frames.length - 1].url : '';
      return url && url !== prev && EurekaMoments.gallery().some((g) => g.label === 'Night on the corner');
    }, shot);
    const night = await moon(page);
    const filed = await page.evaluate(() => EurekaMoments.gallery().map((g) => g.label + ' · ' + g.game));
    ok(filed.some((l) => l.indexOf('Night on the corner') === 0 && l.indexOf('Grow Op') > 0),
      'night is filed as Night on the corner · Grow Op (' + filed.join('; ') + ')');
    ok(day.w >= 480 && day.w <= 640 && /^data:image\/(jpeg|webp)/.test(day.url),
      'Grow Op records a sharp full-colour frame (' + day.w + 'px)');
    ok(night.center > 40, 'the shop itself is in the frame (' + night.center + ')');
    ok(night.bright > day.bright + 80, 'the night frame keeps the moon (' + day.bright + ' → ' + night.bright + ')');
    await ctx.close();
  }

  {
    const { ctx, page } = await boot({ width: 390, height: 844 });
    const phone = await layout(page, 390);
    ok(phone.inView && phone.w >= 44 && phone.h >= 44 && phone.hits.length === 0,
      'the camera button fits a phone without covering the stick or the tray' + (phone.hits.length ? ' (' + phone.hits.join(', ') + ')' : ''));
    await page.click('#lab-moments');
    ok(await page.evaluate(() => EurekaMoments.view()) === 'photo', 'a thumb can open photo mode');
    const reel = await page.evaluate(() => {
      const frames = EurekaMoments.frames();
      return frames.length ? frames[frames.length - 1].w : 0;
    });
    ok(reel > 0 && reel <= 400, 'Grow Op downscales the reel on a phone (' + reel + 'px)');
    await ctx.close();
  }

  ok(errs.length === 0, 'no page errors' + (errs.length ? ' — ' + errs[0] : ''));
  await browser.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
