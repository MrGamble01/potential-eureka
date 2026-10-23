/* Startup Tycoon photo mode.
 *
 * P and the camera button open the shutter. The office holds
 * still while the shot is framed, then the play camera comes
 * back. The plate keeps the sky windows, and the guest book,
 * time capsule, and lobby mural are filed by name.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const src = fs.readFileSync(path.join(__dirname, '../../tycoon/play.html'), 'utf8');
ok(src.includes('src="/js/moments.js"'), 'the office loads photo mode');
ok(src.includes("game: 'tycoon'") && src.includes("hotkey: { key: 'p', shift: false }"), 'P opens the camera');
ok(src.includes('if (momentHold)') && src.includes('preserveDrawingBuffer: true'), 'framing holds the floor and the plate can read the glass');
ok(src.includes("noteMoment('The Guest Book')") && src.includes("noteMoment('The Time Capsule')") && src.includes("noteMoment('The Lobby Mural')"), 'the lobby pieces are filed by name');
ok(src.includes("night: 'Night on the office'") && src.includes("rain: 'Rain on the glass'"), 'night and rain on the windows are named beats');
ok(src.includes('lobby-mural') && src.includes('lobby-guestbook') && src.includes('lobby-capsule'), 'the lobby pieces stand in the office');

const HITS = [
  '.ea-back', '#status-bar', '#tyc-sky', '#cash-hud', '#metrics-hud', '#goal-hud',
  '#left-panel', '#tp-toggle', '#sprint-btn', '#ipo-btn', '#arcade-ai-launch',
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
    await page.addInitScript(() => {
      localStorage.setItem('tycoon:welcomeSeen-v1', '1');
      localStorage.setItem('tycoon:tipsEnabled', '0');
    });
    await page.goto(BASE + '/tycoon/play.html?world=day-clear', { waitUntil: 'load' });
    await page.waitForFunction(() => window.EurekaMoments && window.TYC_WORLD && document.getElementById('tyc-moments'));
    if (await page.locator('#welcome-start-btn').isVisible().catch(() => false)) await page.click('#welcome-start-btn');
    await page.waitForFunction(() => EurekaMoments.frameCount() >= 2, { timeout: 8000 });
    await page.waitForSelector('#arcade-ai-launch', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(400);
    return { ctx, page };
  }

  async function layout(page, width) {
    return page.evaluate(({ width, hits }) => {
      const btn = document.getElementById('tyc-moments').getBoundingClientRect();
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
      const cx = btn.left + btn.width / 2;
      const cy = btn.top + btn.height / 2;
      const top = document.elementFromPoint(cx, cy);
      const own = !!(top && (top === document.getElementById('tyc-moments') || document.getElementById('tyc-moments').contains(top)));
      return {
        hits: found, own, w: btn.width, h: btn.height,
        inView: btn.top >= -1 && btn.left >= -1 && btn.right <= width + 1 && btn.bottom <= innerHeight + 1,
      };
    }, { width, hits: HITS });
  }

  async function plate(page) {
    return page.evaluate(() => {
      const src = window.TYC_PLATE();
      const c = document.createElement('canvas');
      c.width = 96;
      c.height = 60;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(src, 0, 0, 96, 60);
      const d = x.getImageData(0, 0, 96, 60).data;
      let mag = 0, orange = 0, lum = 0, n = 0;
      const samples = [];
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (r > 170 && b > 120 && r > g + 40 && b > g + 20) mag++;
        if (r > 200 && g < 110 && b < 90) orange++;
        lum += r * 0.3 + g * 0.59 + b * 0.11;
        n++;
        samples.push(r, g, b);
      }
      return { samples, mag, orange, lum: lum / n, book: TYC_LOBBY.book.visible, capsule: TYC_LOBBY.capsule.visible, mural: TYC_LOBBY.mural.visible };
    });
  }

  function differ(a, b) {
    let n = 0;
    const m = Math.min(a.length, b.length);
    for (let i = 0; i < m; i += 3) {
      if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 36) n++;
    }
    return n;
  }

  {
    const { ctx, page } = await boot({ width: 1280, height: 800 });
    const placed = await layout(page, 1280);
    ok(placed.own && placed.inView && placed.w >= 44 && placed.h >= 44 && placed.hits.length === 0,
      'the camera sits clear of the office chrome' + (placed.hits.length ? ' (' + placed.hits.join(', ') + ')' : '') + (placed.own ? '' : ' (covered)'));

    const still = await plate(page);
    await page.keyboard.down('w');
    await page.waitForTimeout(450);
    await page.keyboard.up('w');
    await page.waitForTimeout(80);
    const walked = await plate(page);
    ok(differ(still.samples, walked.samples) > 8, 'the founder walks before the camera opens (' + differ(still.samples, walked.samples) + ')');

    const books = await page.evaluate(() => ({
      cash: document.getElementById('cash-val').textContent,
      ship: document.getElementById('m-pership').textContent,
    }));
    await page.keyboard.press('p');
    const opened = await page.evaluate(() => ({
      view: EurekaMoments.view(),
      cash: getComputedStyle(document.getElementById('cash-hud')).visibility,
      sky: getComputedStyle(document.getElementById('tyc-sky')).visibility,
    }));
    ok(opened.view === 'photo' && opened.cash === 'hidden' && opened.sky === 'hidden', 'P opens photo mode and hides the HUD');
    const framed = await plate(page);
    await page.keyboard.down('w');
    await page.waitForTimeout(450);
    await page.keyboard.up('w');
    await page.waitForTimeout(80);
    const held = await plate(page);
    const booksHeld = await page.evaluate(() => ({
      cash: document.getElementById('cash-val').textContent,
      ship: document.getElementById('m-pership').textContent,
    }));
    ok(differ(framed.samples, held.samples) < 6, 'the office holds still while framing (' + differ(framed.samples, held.samples) + ')');
    ok(booksHeld.cash === books.cash && booksHeld.ship === books.ship, 'per-ship stayed ' + books.ship + ' and cash stayed ' + books.cash);

    const stage = await page.locator('#moments-stage').boundingBox();
    await page.mouse.move(stage.x + 200, stage.y + 160);
    await page.mouse.down();
    await page.mouse.move(stage.x + 520, stage.y + 300, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(80);
    const slid = await plate(page);
    ok(differ(held.samples, slid.samples) > 8, 'dragging slides the camera (' + differ(held.samples, slid.samples) + ')');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(80);
    const back = await page.evaluate(() => EurekaMoments.view());
    const restored = await plate(page);
    ok(back === 'live' && differ(walked.samples, restored.samples) < differ(walked.samples, slid.samples),
      'Escape closes the camera and restores the play view');

    await page.click('#tyc-moments');
    ok(await page.evaluate(() => EurekaMoments.view()) === 'photo', 'the camera button opens photo mode');
    await page.keyboard.press('Escape');

    const day = await plate(page);
    await page.evaluate(() => TYC_WORLD.force({ phase: 'night', weather: 'clear' }));
    await page.waitForFunction(() => EurekaMoments.gallery().some((g) => g.label === 'Night on the office'));
    await page.waitForTimeout(120);
    const night = await plate(page);
    ok(differ(day.samples, night.samples) > 12, 'the sky windows change the plate (' + differ(day.samples, night.samples) + ')');
    ok(night.lum > 18, 'the office is still in the night frame (luma ' + night.lum.toFixed(1) + ')');
    const filedNight = await page.evaluate(() => EurekaMoments.gallery().map((g) => g.label + ' · ' + g.game));
    ok(filedNight.some((l) => l === 'Night on the office · Startup Tycoon'), 'night is filed (' + filedNight.join('; ') + ')');

    await page.evaluate(() => TYC_WORLD.force({ phase: 'day', weather: 'rain' }));
    await page.waitForFunction(() => EurekaMoments.gallery().some((g) => g.label === 'Rain on the glass'));
    await page.waitForTimeout(150);
    const rain = await plate(page);
    ok(differ(day.samples, rain.samples) > 4, 'rain on the glass is in the frame (' + differ(day.samples, rain.samples) + ')');

    ok(!day.mural && day.mag < 8, 'a fresh office has no mural in the frame (' + day.mag + ')');
    await page.evaluate(() => {
      localStorage.setItem('tyc-anniversary', JSON.stringify({ toasts: 3 }));
      localStorage.setItem('tyc-guestbook', JSON.stringify({ leafs: 3 }));
      localStorage.setItem('tyc-bench', JSON.stringify({ sits: 3 }));
      localStorage.setItem('tyc-storyhour', JSON.stringify({ tellings: 3 }));
      localStorage.setItem('tyc-song', JSON.stringify({ sings: 3 }));
      localStorage.setItem('tyc-capsule', JSON.stringify({ visits: 3 }));
      TYC_LOBBY.sync();
    });
    await page.waitForTimeout(150);
    const lobby = await plate(page);
    ok(lobby.book && lobby.capsule && lobby.mural && lobby.mag >= 8, 'the guest book, capsule, and mural are in the frame (magenta ' + lobby.mag + ', book ' + lobby.book + ')');

    await page.evaluate(() => {
      document.getElementById('guest-chip').click();
      document.getElementById('capsule-chip').click();
      document.getElementById('mural-chip').click();
    });
    const names = await page.evaluate(() => EurekaMoments.gallery().map((g) => g.label));
    ok(names.includes('The Guest Book') && names.includes('The Time Capsule') && names.includes('The Lobby Mural'),
      'the three lobby beats are filed (' + names.join('; ') + ')');

    const shot = await page.evaluate(() => {
      const frames = EurekaMoments.frames();
      const last = frames[frames.length - 1];
      return { w: last && last.w, url: last && last.url ? last.url.slice(0, 16) : '' };
    });
    ok(shot.w >= 480 && shot.w <= 640 && /^data:image\/(jpeg|webp)/.test(shot.url),
      'the office records a sharp full-colour frame (' + shot.w + 'px)');

    await page.evaluate(() => document.getElementById('help-modal').classList.add('open'));
    await page.keyboard.press('p');
    ok(await page.evaluate(() => EurekaMoments.view()) === 'live', 'P does not open the camera over help');
    await page.evaluate(() => document.getElementById('help-modal').classList.remove('open'));
    await ctx.close();
  }

  {
    const { ctx, page } = await boot({ width: 390, height: 844 });
    const phone = await layout(page, 390);
    ok(phone.own && phone.inView && phone.w >= 44 && phone.h >= 44 && phone.hits.length === 0,
      'the camera fits a phone' + (phone.hits.length ? ' (' + phone.hits.join(', ') + ')' : '') + (phone.own ? '' : ' (covered)'));
    await page.click('#tyc-moments');
    ok(await page.evaluate(() => EurekaMoments.view()) === 'photo', 'a thumb can open photo mode');
    const reel = await page.evaluate(() => {
      const frames = EurekaMoments.frames();
      return frames.length ? frames[frames.length - 1].w : 0;
    });
    ok(reel > 0 && reel <= 400, 'the reel is downscaled on a phone (' + reel + 'px)');
    await ctx.close();
  }

  ok(errs.length === 0, 'no page errors' + (errs.length ? ' — ' + errs[0] : ''));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((err) => { console.error(err); process.exit(1); });
