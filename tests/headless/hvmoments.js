/* Homeless Village photo mode.
 *
 * P and the camera button open the shutter. The day and the player
 * hold still while the shot is framed, then the play camera comes
 * back. A mural panel and the camp's own weather are filed, and the
 * plate keeps the night tint and the rain.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const root = path.join(__dirname, '../..');
const main = fs.readFileSync(path.join(root, 'homeless-village/js/main.js'), 'utf8');
const player = fs.readFileSync(path.join(root, 'homeless-village/js/player.js'), 'utf8');
const loop = fs.readFileSync(path.join(root, 'homeless-village/js/gameloop.js'), 'utf8');
ok(main.includes("hotkey:{key:'p', shift:false}") || main.includes("hotkey: { key: 'p', shift: false }"), 'photo mode takes P');
ok(main.includes('momentHold=true') && loop.includes('if(momentHold) return'), 'framing holds the day');
ok(main.includes("rain:'Rain on the camp'") && main.includes("night:'Night under the bridge'"), 'rain and night are named beats');
ok(main.includes('drawImage(sky') && main.includes('paintRain(photoCtx'), 'the plate keeps the weather canvas and storm rain');
ok(player.includes('noteMoment(MURAL_BEATS[G.mural-1])'), 'a painted panel is filed');
ok(loop.includes("noteMoment('Storm night')"), 'a storm night is filed');

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  const errs = [];

  async function boot(viewport) {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(String(e).slice(0, 240)));
    await page.addInitScript(() => { localStorage.setItem('hv-intro-seen', '1'); });
    await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
    await page.waitForFunction(() => window.EurekaMoments && document.getElementById('hv-moments'));
    await page.waitForSelector('#arcade-ai-launch', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.waitForFunction(() => EurekaMoments.frameCount() >= 2, { timeout: 8000 });
    return { ctx, page };
  }

  async function layout(page, width, height) {
    return page.evaluate(({ width, height }) => {
      const btn = document.getElementById('hv-moments').getBoundingClientRect();
      function hit(el) {
        if (!el) return false;
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return false;
        return !(btn.right <= r.left + 0.5 || btn.left >= r.right - 0.5 || btn.bottom <= r.top + 0.5 || btn.top >= r.bottom - 0.5);
      }
      const sels = ['#action-panel', '#craft-panel', '#workers-panel', '#walk-pad', '#craft-toggle', '#arcade-ai-launch', '#top-bar'];
      const hits = sels.filter((sel) => hit(document.querySelector(sel)));
      const cx = btn.left + btn.width / 2;
      const cy = btn.top + btn.height / 2;
      const top = document.elementFromPoint(cx, cy);
      const own = !!(top && (top === document.getElementById('hv-moments') || document.getElementById('hv-moments').contains(top)));
      return {
        own, hits, w: btn.width, h: btn.height,
        inView: btn.top >= 0 && btn.left >= 0 && btn.right <= width + 1 && btn.bottom <= height + 1,
      };
    }, { width, height });
  }

  {
    const { ctx, page } = await boot({ width: 1280, height: 800 });
    const placed = await layout(page, 1280, 800);
    ok(placed.own && placed.hits.length === 0 && placed.w >= 44 && placed.h >= 44 && placed.inView,
      'the camera sits in the bottom bar, clear of the booth and the panels' + (placed.hits.length ? ' (' + placed.hits.join(', ') + ')' : '') + (placed.own ? '' : ' (covered)'));

    const before = await page.evaluate(() => ({ z: player.position.z, t: G.timeOfDay }));
    await page.evaluate(() => { keysDown.up = true; });
    await page.waitForTimeout(450);
    const walked = await page.evaluate(() => player.position.z);
    ok(walked < before.z - 0.4, 'the player walks before the camera opens (' + before.z.toFixed(2) + ' → ' + walked.toFixed(2) + ')');

    await page.keyboard.press('p');
    const photo = await page.evaluate(() => ({
      view: EurekaMoments.view(),
      hold: momentHold,
      hud: getComputedStyle(document.getElementById('top-bar')).visibility,
      z: player.position.z,
      t: G.timeOfDay,
    }));
    ok(photo.view === 'photo' && photo.hold && photo.hud === 'hidden', 'P opens photo mode and hides the HUD');
    await page.evaluate(() => { keysDown.up = true; });
    await page.waitForTimeout(500);
    const held = await page.evaluate(() => ({ z: player.position.z, t: G.timeOfDay }));
    ok(held.z === photo.z && held.t === photo.t, 'the player and the day hold still while framing');

    const stage = await page.locator('#moments-stage').boundingBox();
    await page.mouse.move(stage.x + 180, stage.y + 160);
    await page.mouse.down();
    await page.mouse.move(stage.x + 460, stage.y + 280, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(80);
    const slid = await page.evaluate(() => ({ x: camera.position.x, z: camera.position.z }));
    ok(Math.abs(slid.x - 20) > 0.4, 'dragging slides the camera (' + slid.x.toFixed(2) + ')');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(80);
    const back = await page.evaluate(() => ({
      view: EurekaMoments.view(),
      hold: momentHold,
      x: camera.position.x,
      z: camera.position.z,
    }));
    ok(back.view === 'live' && !back.hold && Math.abs(back.x - 20) < 0.45 && Math.abs(back.z - 20) < 0.45,
      'Escape closes the camera and restores the play view');

    const tLive = await page.evaluate(() => G.timeOfDay);
    await page.evaluate(() => { keysDown.up = true; });
    await page.waitForTimeout(450);
    const resumed = await page.evaluate(() => ({ z: player.position.z, t: G.timeOfDay }));
    ok(resumed.z < held.z - 0.3 && resumed.t > tLive + 0.0002, 'walking and the day resume after the shutter closes');
    await page.evaluate(() => { keysDown = {}; });

    await page.click('#hv-moments');
    ok(await page.evaluate(() => EurekaMoments.view()) === 'photo', 'the camera button opens photo mode');
    await page.keyboard.press('Escape');

    await page.evaluate(() => { G.weather = 'rain'; G.stormOn = false; G.timeOfDay = 0.4; });
    await page.waitForFunction(() => EurekaMoments.gallery().some(g => g.label === 'Rain on the camp'), { timeout: 4000 });
    const filed = await page.evaluate(() => EurekaMoments.gallery().map(g => g.label + ' · ' + g.game));
    ok(filed.some(l => l === 'Rain on the camp · Homeless Village'), 'rain is filed as Rain on the camp (' + filed.join('; ') + ')');

    await page.evaluate(() => {
      G.weather = 'clear'; G.scraps = 6; G.mural = 0; G.muralDay = -1; G.days = 3;
      finishAction({ id: 'mural' });
    });
    const mural = await page.evaluate(() => ({
      panels: G.mural,
      label: EurekaMoments.gallery().some(g => g.label === 'Sunrise over the bridge' && g.game === 'Homeless Village'),
    }));
    ok(mural.panels === 1 && mural.label, 'the first mural panel is filed as Sunrise over the bridge');

    await page.evaluate(() => { G.structures.gate = true; G.stormDue = true; G.stormOn = false; stormStart(); });
    const storm = await page.evaluate(() => EurekaMoments.gallery().some(g => g.label === 'Storm night' && g.game === 'Homeless Village'));
    ok(storm && await page.evaluate(() => G.stormOn), 'calling the storm night files Storm night');

    const plate = await page.evaluate(() => {
      function lum(canvas) {
        const c = document.createElement('canvas');
        c.width = 24; c.height = 24;
        const x = c.getContext('2d');
        x.drawImage(canvas, canvas.width * 0.35, canvas.height * 0.35, canvas.width * 0.3, canvas.height * 0.3, 0, 0, 24, 24);
        const d = x.getImageData(0, 0, 24, 24).data;
        let s = 0;
        for (let i = 0; i < d.length; i += 4) s += d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
        return s / (d.length / 4);
      }
      function bias(canvas) {
        const c = document.createElement('canvas');
        c.width = 24; c.height = 24;
        const x = c.getContext('2d');
        x.drawImage(canvas, 0, 0, 24, 24);
        const d = x.getImageData(0, 0, 24, 24).data;
        let b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { b += d[i + 2] - d[i]; n++; }
        return b / n;
      }
      G.stormOn = false; G.weather = 'clear'; G.timeOfDay = 0.4;
      paintWeather(1);
      const day = lum(momentCanvas());
      const clearBias = bias(momentCanvas());
      G.weather = 'rain';
      paintWeather(80);
      const rainBias = bias(momentCanvas());
      G.weather = 'clear'; G.timeOfDay = 0.92;
      paintWeather(1);
      const night = lum(momentCanvas());
      G.mural = 4; refreshMural();
      return { day: day, night: night, clearBias: clearBias, rainBias: rainBias, mural: muralMeshes.length };
    });
    ok(plate.day > 12, 'the camp is in the frame (luma ' + plate.day.toFixed(1) + ')');
    ok(plate.night < plate.day - 6, 'night under the bridge darkens the plate (' + plate.day.toFixed(1) + ' → ' + plate.night.toFixed(1) + ')');
    ok(plate.rainBias > plate.clearBias + 1.5, 'rain reads bluer than a clear day (' + plate.clearBias.toFixed(1) + ' → ' + plate.rainBias.toFixed(1) + ')');
    ok(plate.mural === 4, 'the mural meshes are in the scene the plate photographs');

    const frame = await page.evaluate(() => {
      const frames = EurekaMoments.frames();
      const last = frames[frames.length - 1];
      return { w: last && last.w, url: last && last.url ? last.url.slice(0, 16) : '' };
    });
    ok(frame.w >= 480 && frame.w <= 640 && /^data:image\/(jpeg|webp)/.test(frame.url),
      'Homeless Village records a sharp full-colour frame (' + frame.w + 'px)');

    await page.evaluate(() => openIntro());
    await page.keyboard.press('p');
    ok(await page.evaluate(() => EurekaMoments.view()) === 'live', 'P does not open the camera over the crash course');
    await page.keyboard.press('Escape');
    await ctx.close();
  }

  {
    const { ctx, page } = await boot({ width: 390, height: 844 });
    const phone = await layout(page, 390, 844);
    ok(phone.own && phone.hits.length === 0 && phone.w >= 44 && phone.h >= 44 && phone.inView,
      'the camera fits a phone without covering the walk pad' + (phone.hits.length ? ' (' + phone.hits.join(', ') + ')' : '') + (phone.own ? '' : ' (covered)'));
    await page.click('#hv-moments');
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
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
