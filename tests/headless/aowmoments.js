/* Age of War photo mode and named highlight beats.
 *
 * Shift+P opens the camera. P still pauses. An age up and a special
 * are filed under the names the battle already uses.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const src = fs.readFileSync(path.join(__dirname, '../../ageofwar/ageofwar.js'), 'utf8');
ok(src.includes("noteMoment('Reached ' + ERAS[playerEra].name)"), 'an age up is filed as Reached plus the era');
ok(src.includes("noteMoment(u.warlord ? (u.warlord.name + ' fallen') : 'Boss wave cleared')"), 'a cleared boss wave is filed by name');
ok(src.includes("noteMoment('Base destroyed')") && src.includes("noteMoment('Victory')") && src.includes("noteMoment('Stronghold razed')"),
  'a destroyed base and a victory are filed');
ok(src.includes('noteMoment(ERAS[playerEra].special.name)'), 'a special is filed under its own name');
ok(src.includes("hotkey: { key: 'p', shift: true }"), 'photo mode takes Shift+P and leaves P for pause');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const errs = [];

  async function boot(viewport) {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(String(e).slice(0, 240)));
    await page.addInitScript(() => {
      localStorage.setItem('aow-welcome-seen', '1');
      localStorage.setItem('aow-session', JSON.stringify({
        v: 2, waveNum: 1, gold: 800, xp: 500, playerEra: 0, specialReadyT: 0,
      }));
    });
    await page.goto(BASE + '/ageofwar/', { waitUntil: 'load' });
    await page.waitForFunction(() => window.EurekaMoments && document.getElementById('aow-moments'));
    await page.click('#aow-resume-cta');
    await page.waitForFunction(() => EurekaMoments.frameCount() >= 2);
    return { ctx, page };
  }

  {
    const { ctx, page } = await boot({ width: 1280, height: 800 });
    const placed = await page.evaluate(() => {
      const btn = document.getElementById('aow-moments').getBoundingClientRect();
      const canvas = document.getElementById('aow-canvas').getBoundingClientRect();
      const settings = document.getElementById('aow-settings-btn').getBoundingClientRect();
      const overlap = !(btn.right < canvas.left || btn.left > canvas.right || btn.bottom < canvas.top || btn.top > canvas.bottom);
      const crowd = !(btn.right <= settings.left || btn.left >= settings.right || btn.bottom <= settings.top || btn.top >= settings.bottom);
      return { overlap, crowd, w: btn.width, h: btn.height, inView: btn.top >= 0 && btn.left >= 0 && btn.right <= 1280 };
    });
    ok(!placed.overlap && !placed.crowd && placed.w >= 32 && placed.h >= 32 && placed.inView,
      'the camera button sits in the top bar, clear of the battlefield and the settings gear');
    await page.keyboard.press('p');
    const paused = await page.locator('#aow-pause-btn .aow-action-lbl').innerText();
    const stillLive = await page.evaluate(() => EurekaMoments.view());
    ok(paused === 'Resume' && stillLive === 'live', 'P still pauses the battle');
    await page.keyboard.press('p');
    await page.keyboard.press('Shift+P');
    const photo = await page.evaluate(() => ({
      view: EurekaMoments.view(),
      pause: document.querySelector('#aow-pause-btn .aow-action-lbl').textContent,
      hud: getComputedStyle(document.querySelector('.aow-topbar')).visibility,
    }));
    ok(photo.view === 'photo' && photo.pause === 'Pause' && photo.hud === 'hidden',
      'Shift+P opens photo mode without pausing, and hides the HUD');
    await page.keyboard.press('p');
    const held = await page.evaluate(() => ({
      view: EurekaMoments.view(),
      pause: document.querySelector('#aow-pause-btn .aow-action-lbl').textContent,
    }));
    ok(held.view === 'photo' && held.pause === 'Pause', 'P does not pause the battle while the camera is open');
    await page.keyboard.press('Escape');
    ok(await page.evaluate(() => EurekaMoments.view()) === 'live', 'Escape closes photo mode');
    await page.click('#aow-moments');
    ok(await page.evaluate(() => EurekaMoments.view()) === 'photo', 'the camera button opens photo mode');
    await page.keyboard.press('Escape');
    await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
    await page.keyboard.press(' ');
    await page.waitForFunction(() => EurekaMoments.gallery().some(g => g.label === 'Boulder'));
    await page.keyboard.press('q');
    await page.waitForFunction(() => EurekaMoments.gallery().some(g => g.label === 'Reached Castle Age'));
    if (await page.locator('#aow-field-order.aow-open').count()) await page.keyboard.press('1');
    await page.waitForSelector('#aow-ridge-btn.aow-show');
    const ridgeClear = await page.evaluate(() => {
      const btn = document.getElementById('aow-moments').getBoundingClientRect();
      const ridge = document.getElementById('aow-ridge-btn').getBoundingClientRect();
      const hit = !(btn.right <= ridge.left || btn.left >= ridge.right || btn.bottom <= ridge.top || btn.top >= ridge.bottom);
      return !hit && btn.width >= 32;
    });
    ok(ridgeClear, 'the camera stays clear of the Ridge button');
    const filed = await page.evaluate(() => EurekaMoments.gallery().map(g => g.label + ' · ' + g.game));
    ok(filed.some(l => l.indexOf('Boulder') === 0 && l.indexOf('Age of War') > 0), 'the Stone Age special is filed as Boulder');
    ok(filed.some(l => l === 'Reached Castle Age · Age of War' || l.indexOf('Reached Castle Age · Age of War') === 0),
      'age up is filed as Reached Castle Age (' + filed.join('; ') + ')');
    const frame = await page.evaluate(() => {
      const frames = EurekaMoments.frames();
      const last = frames[frames.length - 1];
      return { w: last && last.w, url: last && last.url ? last.url.slice(0, 16) : '' };
    });
    ok(frame.w >= 480 && frame.w <= 640 && /^data:image\/(jpeg|webp)/.test(frame.url),
      'Age of War records a sharp full-colour frame (' + frame.w + 'px)');
    const stored = await page.evaluate(async () => {
      await new Promise(r => setTimeout(r, 200));
      const dbs = indexedDB.databases ? await indexedDB.databases() : [];
      const settings = localStorage.getItem('eureka-moments-v1') || '';
      return { idb: dbs.some(d => d.name === 'eureka-moments-clips'), settings: settings.length < 200 };
    });
    ok(stored.idb && stored.settings, 'flagged clips go to IndexedDB and localStorage keeps only the switch');
    await ctx.close();
  }

  {
    const { ctx, page } = await boot({ width: 390, height: 844 });
    const phone = await page.evaluate(() => {
      const btn = document.getElementById('aow-moments').getBoundingClientRect();
      return { top: btn.top, h: btn.height, right: btn.right, w: btn.width };
    });
    ok(phone.top >= 0 && phone.h >= 32 && phone.w >= 32 && phone.right <= 390, 'the camera button fits on a phone');
    await page.click('#aow-moments');
    ok(await page.evaluate(() => EurekaMoments.view()) === 'photo', 'a thumb can open photo mode');
    const reel = await page.evaluate(() => {
      const frames = EurekaMoments.frames();
      return frames.length ? frames[frames.length - 1].w : 0;
    });
    ok(reel > 0 && reel <= 400, 'Age of War downscales the reel on a phone (' + reel + 'px)');
    await ctx.close();
  }

  ok(errs.length === 0, 'no page errors' + (errs.length ? ' — ' + errs[0] : ''));
  await browser.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
