/*
 * Shared game-feel kit.
 *  A. Motion auto follows prefers-reduced-motion; Full overrides it;
 *     Reduced drops particles and persists across a reload.
 *  B. A punch in full motion spawns particles and a number pop-up.
 *  C. Hit-stop freezes timeScale, then releases.
 *  D. Tweens ease from one value to another.
 *  E. Haptics call navigator.vibrate only while the switch is on.
 *  F. A scene transition mounts and clears. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errs = [];

  async function open(reduced) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(String(e).slice(0, 240)));
    await page.addInitScript(() => {
      window.__vibes = [];
      navigator.vibrate = function (pattern) { window.__vibes.push(pattern); return true; };
    });
    if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(BASE + '/index.html', { waitUntil: 'load' });
    await page.waitForFunction(() => window.EurekaFeel && window.FlagDaily);
    return { ctx, page };
  }

  {
    const { ctx, page } = await open(true);
    const auto = await page.evaluate(() => {
      EurekaFeel.setMotion('auto');
      return EurekaFeel.reduced() && document.documentElement.dataset.feelMotion === 'auto';
    });
    ok(auto, 'auto motion follows prefers-reduced-motion');
    const full = await page.evaluate(() => {
      EurekaFeel.setMotion('full');
      const before = EurekaFeel.particleCount();
      EurekaFeel.punch('ship', { x: 200, y: 180, text: '+25', color: '#7ee787' });
      return { reduced: EurekaFeel.reduced(), particles: EurekaFeel.particleCount() > before, popup: !!document.querySelector('.feel-popup') };
    });
    ok(!full.reduced && full.particles && full.popup, 'full motion punches particles and a pop-up even when the OS asks for less');
    await ctx.close();
  }

  {
    const { ctx, page } = await open(false);
    const quiet = await page.evaluate(() => {
      EurekaFeel.setMotion('reduced');
      const before = EurekaFeel.particleCount();
      EurekaFeel.punch('hit', { x: 220, y: 200, text: '+10', color: '#F7C948' });
      return {
        reduced: EurekaFeel.reduced(),
        particles: EurekaFeel.particleCount() - before,
        popup: !!document.querySelector('.feel-popup'),
        scale: EurekaFeel.timeScale(),
      };
    });
    ok(quiet.reduced && quiet.particles === 0 && quiet.popup && quiet.scale === 1,
      'reduced motion keeps the pop-up, skips particles, and does not hit-stop');
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.EurekaFeel);
    const kept = await page.evaluate(() => EurekaFeel.motion() === 'reduced' && EurekaFeel.reduced());
    ok(kept, 'the reduced-motion choice survives a reload');
    await ctx.close();
  }

  {
    const { ctx, page } = await open(false);
    const stop = await page.evaluate(() => new Promise(resolve => {
      EurekaFeel.setMotion('full');
      EurekaFeel.hitStop(80);
      const during = EurekaFeel.timeScale();
      setTimeout(() => resolve({ during, after: EurekaFeel.timeScale() }), 120);
    }));
    ok(stop.during === 0 && stop.after === 1, 'hit-stop holds timeScale at 0, then lets it go');

    const tween = await page.evaluate(() => new Promise(resolve => {
      const seen = [];
      EurekaFeel.tween(0, 100, 80, 'linear', v => seen.push(v), () => resolve(seen));
    }));
    ok(tween.length > 2 && tween[tween.length - 1] === 100 && tween[0] < 100,
      'a linear tween walks from the start value to the end value');

    const vib = await page.evaluate(() => {
      window.__vibes.length = 0;
      EurekaFeel.setHaptics(true);
      EurekaFeel.haptic(18);
      const on = window.__vibes.length;
      EurekaFeel.setHaptics(false);
      EurekaFeel.haptic(18);
      return { on, off: window.__vibes.length, label: EurekaFeel.hapticsLabel() };
    });
    ok(vib.on === 1 && vib.off === 1 && vib.label === 'Haptics: Off', 'haptics buzz only while the switch is on');

    const scene = await page.evaluate(() => new Promise(resolve => {
      EurekaFeel.transition({ title: 'Ship Sprint', sub: 'Startup Tycoon' }, () => resolve(!!document.querySelector('.feel-transition')));
    }));
    ok(scene, 'a scene transition covers the page while the next scene mounts');
    await page.waitForTimeout(500);
    const gone = await page.evaluate(() => !document.querySelector('.feel-transition'));
    ok(gone, 'the scene transition clears itself');
    await ctx.close();
  }

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
