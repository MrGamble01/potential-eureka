/* Phone play — boards fit, touch reaches the game, the battle holds frame rate.
 *
 * A 390px cabinet used to grow to the board's inline pixel width (Snake 600,
 * Breaker 720) because the wrapper was shrink-to-fit. Memory Matrix then
 * treated CSS pixels as pad pixels, so a tap in the middle hit nothing.
 * Hearthvale's town goal sat under the build tabs, and pause/zoom needed a
 * keyboard. Age of War allocated 1280×560 × devicePixelRatio and fell to
 * about 12fps under a 4× CPU throttle.
 *
 * Hook-free. Real clicks and pointer events.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const BOARDS = [
  ['snake', '#snake-canvas'],
  ['tetris', '#tetris-canvas'],
  ['breakout', '#breakout-canvas'],
  ['asteroids', '#asteroids-canvas'],
  ['2048', '#g2048-canvas'],
  ['minesweeper', '#mines-canvas'],
  ['connect4', '#c4-canvas'],
  ['maze', '#maze-canvas'],
  ['lightcycles', '#cycles-canvas'],
  ['memorymatrix', '#mm-canvas'],
  ['stacker', '#stacker-canvas'],
  ['wordcascade', '#wc-canvas'],
  ['vectordefense', '#vd-canvas'],
  ['crateescape', '#crate-canvas'],
  ['pong', '#pong-canvas'],
  ['life', '#life-canvas'],
];

const launch = {
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
};
if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;

(async () => {
  const browser = await chromium.launch(launch);
  const errs = [];

  // Hub boards at a phone width, touch as the primary pointer.
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push('hub ' + String(e).slice(0, 180)));
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await page.waitForTimeout(400);

    // Maze Runner and Game of Life live in the tucked-away "more" menu, not
    // the catalogue cards. Hash routing opens every cabinet the same way.
    const openGame = async view => {
      await page.evaluate(v => { location.hash = v; }, view);
      await page.waitForFunction(v => document.getElementById('view-' + v)?.classList.contains('active'), view);
    };

    for (const [view, sel] of BOARDS) {
      await openGame(view);
      await page.waitForFunction(s => {
        const el = document.querySelector(s);
        return el && (el.style.width || el.width > 0);
      }, sel);
      const box = await page.evaluate(selector => {
        const el = document.querySelector(selector);
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          w: Math.round(b.width),
          left: Math.round(b.left),
          right: Math.round(b.right),
          touch: cs.touchAction,
          doc: document.documentElement.scrollWidth,
          inner: innerWidth,
        };
      }, sel);
      ok(box.w > 40 && box.right <= box.inner + 1 && box.left >= -1 && box.doc <= box.inner + 1,
        `${view} board fits a 390px screen (${box.w}px, right ${box.right}, scroll ${box.doc})`);
      ok(box.touch === 'none', `${view} canvas keeps touch-action none (was ${box.touch})`);
    }

    // Tetris and Vector Storm on-screen pads.
    await openGame('tetris');
    await page.waitForTimeout(200);
    const tet = await page.evaluate(() => {
      const pad = document.getElementById('tetris-touch');
      const cs = getComputedStyle(pad);
      const buttons = [...pad.querySelectorAll('button')].map(el => {
        const b = el.getBoundingClientRect();
        return b.width > 2 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1 && b.left >= -1;
      });
      return { shown: cs.display !== 'none', buttons, n: buttons.length };
    });
    ok(tet.shown && tet.n >= 6 && tet.buttons.every(Boolean),
      `Tetris touch pad is on screen (${tet.n} buttons)`);

    await openGame('asteroids');
    await page.waitForTimeout(200);
    const ast = await page.evaluate(() => {
      const pad = document.getElementById('ast-touch');
      const cs = getComputedStyle(pad);
      const buttons = [...pad.querySelectorAll('button')].map(el => {
        const b = el.getBoundingClientRect();
        return b.width > 2 && b.right <= innerWidth + 1 && b.left >= -1 && b.bottom <= innerHeight + 1;
      });
      return { shown: cs.display !== 'none', buttons, n: buttons.length };
    });
    ok(ast.shown && ast.n >= 5 && ast.buttons.every(Boolean),
      `Vector Storm touch pad is on screen (${ast.n} buttons)`);

    // Word Five's on-screen keyboard stays inside the phone.
    await openGame('word5');
    await page.waitForTimeout(200);
    const w5 = await page.evaluate(() => {
      const kb = document.getElementById('word5-kb');
      const b = kb.getBoundingClientRect();
      const keys = kb.querySelectorAll('button').length;
      return {
        keys,
        fits: b.width > 40 && b.right <= innerWidth + 1 && b.left >= -1,
        doc: document.documentElement.scrollWidth <= innerWidth + 1,
      };
    });
    ok(w5.keys >= 26 && w5.fits && w5.doc, `Word Five keyboard fits (${w5.keys} keys)`);

    // A center tap must land on the middle pad once the board has shrunk.
    await openGame('memorymatrix');
    await page.waitForFunction(() => {
      const el = document.getElementById('mm-canvas');
      return el && el.style.width;
    });
    const center = await page.locator('#mm-canvas').boundingBox();
    await page.mouse.click(center.x + center.width / 2, center.y + center.height / 2);
    await page.waitForTimeout(1500);
    await page.mouse.click(center.x + center.width / 2, center.y + center.height / 2);
    await page.waitForTimeout(900);
    const mm = await page.evaluate(() => ({
      round: document.getElementById('mm-round').textContent.trim(),
      lives: document.getElementById('mm-lives').textContent.trim(),
    }));
    ok(mm.round !== '1' || mm.lives !== '♥♥♥',
      `Memory Matrix center tap hits a pad (round ${mm.round}, lives ${mm.lives})`);
    await ctx.close();
  }

  // Hearthvale: goal, pause, zoom, pinch, build controls.
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push('hv ' + String(e).slice(0, 180)));
    await page.addInitScript(() => {
      localStorage.setItem('hearthvale-v1', JSON.stringify({ seenIntro: true, seed: 42424 }));
    });
    await page.goto(BASE + '/hearthvale.html', { waitUntil: 'load' });
    await page.waitForFunction(() => document.getElementById('game') && document.getElementById('game').dataset.zoom);
    const layout = await page.evaluate(() => {
      const owns = sel => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        const b = el.getBoundingClientRect();
        if (b.width < 2 || b.height < 2) return false;
        if (b.left < -1 || b.top < -1 || b.right > innerWidth + 1 || b.bottom > innerHeight + 1) return false;
        const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return !!(hit && (hit === el || el.contains(hit)));
      };
      const hud = document.getElementById('hud').getBoundingClientRect();
      const goal = document.getElementById('goals').getBoundingClientRect();
      const tab = document.querySelector('#buildtabs .btab').getBoundingClientRect();
      const overlap = !(goal.right < tab.left || goal.left > tab.right || goal.bottom < tab.top || goal.top > tab.bottom);
      const welcome = document.getElementById('welcome');
      return {
        welcome: !!(welcome && welcome.classList.contains('show')),
        hudH: Math.round(hud.height),
        overlap,
        goal: owns('#goals'),
        pause: owns('#touch-pause'),
        zoomIn: owns('#zoom-in'),
        zoomOut: owns('#zoom-out'),
        games: owns('a.ea-back--float'),
        gear: owns('#menu-btn'),
        cottage: owns('#buildbar .btn'),
        tabs: [...document.querySelectorAll('#buildtabs .btab')].every(el => {
          const b = el.getBoundingClientRect();
          const hit = document.elementFromPoint(b.left + Math.min(18, b.width / 2), b.top + b.height / 2);
          return b.right > 0 && b.left < innerWidth && hit && (hit === el || el.contains(hit));
        }),
      };
    });
    ok(!layout.welcome, 'a returning valley skips the welcome card');
    ok(layout.hudH > 20 && layout.hudH < 130, `resource row stays a single strip (${layout.hudH}px)`);
    ok(!layout.overlap && layout.goal, 'town goal is readable and not under the build tabs');
    ok(layout.pause && layout.games && layout.gear, 'pause, Games, and the gear each own their centre');
    ok(layout.zoomIn && layout.zoomOut, 'zoom buttons own their centres');
    ok(layout.cottage && layout.tabs, 'cottage and the build tabs are tappable');

    const before = await page.evaluate(() => document.getElementById('game').dataset.zoom);
    await page.click('#zoom-in');
    const afterBtn = await page.evaluate(() => document.getElementById('game').dataset.zoom);
    ok(parseFloat(afterBtn) > parseFloat(before) + 0.05, `zoom in moves the camera (${before} → ${afterBtn})`);

    const pinch = await page.evaluate(() => {
      const canvas = document.getElementById('game');
      const start = parseFloat(canvas.dataset.zoom);
      const r = canvas.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const ev = (type, id, x, y) => canvas.dispatchEvent(new PointerEvent(type, {
        pointerId: id, clientX: x, clientY: y, bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: id === 1,
      }));
      ev('pointerdown', 1, cx - 30, cy);
      ev('pointerdown', 2, cx + 30, cy);
      ev('pointermove', 2, cx + 110, cy);
      ev('pointerup', 2, cx + 110, cy);
      ev('pointerup', 1, cx - 30, cy);
      return { start, end: parseFloat(canvas.dataset.zoom) };
    });
    ok(pinch.end > pinch.start + 0.05, `pinch zoom opens the valley (${pinch.start} → ${pinch.end})`);

    await page.click('#touch-pause');
    const paused = await page.evaluate(() => document.getElementById('paused').classList.contains('show'));
    ok(paused, 'pause holds the valley without a keyboard');
    await page.click('#pause-resume');
    const resumed = await page.evaluate(() => !document.getElementById('paused').classList.contains('show'));
    ok(resumed, 'Resume the valley starts the clock again');

    const road = await page.evaluate(() => {
      const bar = document.getElementById('buildbar');
      const last = bar.querySelector('.btn:last-child');
      bar.scrollLeft = bar.scrollWidth;
      const b = last.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return { owns: !!(hit && (hit === last || last.contains(hit))), label: last.textContent.replace(/\s+/g, ' ').trim().slice(0, 24) };
    });
    ok(road.owns, `the far build button scrolls into reach (${road.label})`);
    await ctx.close();
  }

  // Age of War: backing store tracks the phone, and the battle stays above a crawl.
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push('aow ' + String(e).slice(0, 180)));
    await page.addInitScript(() => localStorage.setItem('aow-welcome-seen', '1'));
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto(BASE + '/ageofwar/', { waitUntil: 'load' });
    await page.waitForFunction(() => {
      const c = document.getElementById('aow-canvas');
      return c && c.clientWidth > 80 && c.width > 80;
    });
    await page.waitForTimeout(400);
    const field = await page.evaluate(() => {
      const c = document.getElementById('aow-canvas');
      const b = c.getBoundingClientRect();
      return {
        storeW: c.width, storeH: c.height,
        cssW: Math.round(b.width), cssH: Math.round(b.height),
        doc: document.documentElement.scrollWidth <= innerWidth + 1,
      };
    });
    ok(field.cssW > 80 && field.storeW <= field.cssW * 2 + 2 && field.storeW < 1200 && field.doc,
      `Age of War bitmap tracks the phone field (${field.storeW}×${field.storeH} for ${field.cssW}×${field.cssH} css)`);
    const frames = await page.evaluate(() => new Promise(resolve => {
      const t0 = performance.now();
      let n = 0;
      function step(now) {
        n++;
        if (now - t0 < 1000) requestAnimationFrame(step);
        else resolve(n);
      }
      requestAnimationFrame(step);
    }));
    ok(frames >= 30, `Age of War holds ${frames} frames in a throttled second`);
    await ctx.close();
  }

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
