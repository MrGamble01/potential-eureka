/* HUD safe zone and Outfit word spaces.
   Spaces in display type have to be wider than a missing glyph, and
   the booth, announcer, and toasts have to stay off the other HUD
   at a phone and a desktop size for every flagship. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (condition, name) => {
  condition ? pass++ : fail++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}`);
};

const VIEWS = [
  { width: 390, height: 844, label: '390x844' },
  { width: 1280, height: 800, label: '1280x800' },
];

const GAMES = [
  {
    id: 'ageofwar',
    url: '/ageofwar/',
    seed(page) {
      return page.addInitScript(() => {
        localStorage.setItem('aow-welcome-seen', '1');
      });
    },
    async ready(page) {
      const resume = page.locator('#aow-resume-cta');
      if (await resume.count() && await resume.isVisible()) await resume.click();
      await page.waitForSelector('.aow-spawn-btn', { timeout: 8000 });
    },
    bars: ['.ea-back', '.aow-topbar', '.aow-spawn-list', '.aow-actionbar'],
    toast: '#aow-achievement-toasts',
  },
  {
    id: 'tycoon',
    url: '/tycoon/play.html',
    seed(page) {
      return page.addInitScript(() => {
        localStorage.setItem('tycoon:welcomeSeen-v1', '1');
        localStorage.setItem('tycoon:tipsEnabled', '0');
      });
    },
    async ready(page) {
      await page.waitForSelector('#hire-btn', { timeout: 8000 });
      await page.evaluate(() => {
        const card = document.getElementById('next-action-card');
        if (!card) return;
        card.style.display = 'flex';
        const title = document.getElementById('na-title');
        if (title) title.textContent = 'Hire Engineer';
      });
    },
    bars: ['.ea-back', '#next-action-card', '#metrics-hud', '#cash-hud'],
    toast: '#toast-container',
    gamesOnCard: true,
  },
  {
    id: 'homeless',
    url: '/homeless-village.html',
    async ready(page) {
      const go = page.locator('#intro-go');
      if (await go.count() && await go.isVisible()) await go.click();
      await page.waitForSelector('#top-bar', { timeout: 8000 });
    },
    bars: ['.ea-back', '#top-bar', '#bottom-bar'],
    toast: null,
  },
  {
    id: 'hearthvale',
    url: '/hearthvale.html',
    async ready(page) {
      const begin = page.locator('#welcome-close');
      if (await begin.count() && await begin.isVisible()) await begin.click();
      await page.waitForSelector('#hud', { timeout: 8000 });
    },
    bars: ['.ea-back', '#hud', '#buildbar', '#minimap'],
    toast: '#toasts',
  },
  {
    id: 'voxel',
    url: '/voxel-garden.html',
    async ready(page) {
      await page.waitForSelector('#topbar', { timeout: 8000 });
    },
    bars: ['.ea-back', '#topbar', '#hotbar'],
    toast: '#toasts',
  },
  {
    id: 'growop',
    url: '/drug-lab.html',
    async ready(page) {
      const close = page.locator('#intro-close');
      if (await close.count() && await close.isVisible()) await close.click();
      await page.waitForSelector('#lab-tray', { timeout: 8000 });
    },
    bars: ['.ea-back', '#cash-hud', '#heat-hud', '#lab-tray'],
    toast: '#toast-container',
  },
];

function box(rect) {
  if (!rect || rect.width < 2 || rect.height < 2) return null;
  return rect;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errors = [];

  const hub = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const hubPage = await hub.newPage();
  hubPage.on('pageerror', (error) => errors.push('hub ' + error));
  await hubPage.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await hubPage.evaluate(() => document.fonts.ready);
  const hubSpace = await hubPage.evaluate(() => {
    const probe = document.querySelector('#view-arcade .arcade-section-title, #view-arcade .arcade-flagship-name');
    const cs = probe ? getComputedStyle(probe) : getComputedStyle(document.body);
    const stack = getComputedStyle(document.querySelector('#view-arcade') || document.documentElement).getPropertyValue('--font-display').trim() || cs.fontFamily;
    function width(text) {
      const s = document.createElement('span');
      s.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;white-space:pre;font-family:'
        + stack + ';font-weight:800;font-size:48px;letter-spacing:-0.04em';
      s.textContent = text;
      document.body.appendChild(s);
      const w = s.getBoundingClientRect().width;
      s.remove();
      return w;
    }
    const gap = width('Hire Engineer') - width('HireEngineer');
    return { gap, family: stack, floor: 48 * 0.22 };
  });
  ok(hubSpace.gap >= hubSpace.floor,
    `hub display space is ${hubSpace.gap.toFixed(1)}px (need ${hubSpace.floor.toFixed(1)}, ${hubSpace.family})`);
  await hub.close();

  for (const game of GAMES) {
    for (const view of VIEWS) {
      const context = await browser.newContext({ viewport: { width: view.width, height: view.height } });
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push(game.id + ' ' + view.label + ' ' + error));
      if (game.seed) await game.seed(page);
      await page.goto(BASE + game.url, { waitUntil: 'domcontentloaded' });
      await game.ready(page);
      await page.waitForSelector('#arcade-ai-launch', { timeout: 8000 });
      await page.evaluate(() => document.fonts.ready);
      const where = game.id + ' ' + view.label;

      const space = await page.evaluate(() => {
        const rootCs = getComputedStyle(document.documentElement);
        const stack = (rootCs.getPropertyValue('--hud-font-display') || rootCs.getPropertyValue('--font-display')).trim();
        const sample = document.querySelector('#hire-btn');
        const family = stack || (sample ? getComputedStyle(sample).fontFamily : 'Outfit, sans-serif');
        function width(text) {
          const s = document.createElement('span');
          s.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;white-space:pre;font-family:'
            + family + ';font-weight:800;font-size:48px;letter-spacing:-0.04em';
          s.textContent = text;
          document.body.appendChild(s);
          const w = s.getBoundingClientRect().width;
          s.remove();
          return w;
        }
        const gap = width('Hire Engineer') - width('HireEngineer');
        let label = null;
        if (sample) {
          const live = getComputedStyle(sample);
          function liveWidth(text) {
            const s = document.createElement('span');
            s.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:' + live.font + ';letter-spacing:' + live.letterSpacing;
            s.textContent = text;
            document.body.appendChild(s);
            const w = s.getBoundingClientRect().width;
            s.remove();
            return w;
          }
          label = liveWidth('Hire Engineer') - liveWidth('HireEngineer');
        }
        return { gap, label, family, floor: 48 * 0.22, labelFloor: sample ? parseFloat(getComputedStyle(sample).fontSize) * 0.22 : 0 };
      });
      ok(space.gap >= space.floor,
        `${where} "Hire Engineer" is ${space.gap.toFixed(1)}px wider than "HireEngineer" (${space.family})`);
      if (space.label != null) {
        ok(space.label >= space.labelFloor,
          `${where} hire label space is ${space.label.toFixed(1)}px`);
      }

      await page.evaluate((toastSel) => {
        if (window.HudSafe) window.HudSafe.apply();
        const ticker = document.getElementById('arcade-ai-ticker');
        if (ticker) {
          ticker.hidden = false;
          const line = ticker.querySelector('#arcade-ai-ticker-line');
          if (line) line.textContent = 'The line holds for a moment.';
          else ticker.appendChild(document.createTextNode('The line holds for a moment.'));
        }
        if (toastSel) {
          const host = document.querySelector(toastSel);
          if (host) {
            host.hidden = false;
            if (getComputedStyle(host).display === 'none') host.style.display = 'flex';
            const el = document.createElement('div');
            el.className = toastSel === '#aow-achievement-toasts' ? 'aow-ach-toast' : 'toast';
            el.style.animation = 'none';
            el.textContent = 'Achievement Unlocked  First Blood';
            host.appendChild(el);
          }
        }
        document.querySelectorAll('.career-toast').forEach((el) => el.remove());
        const career = document.createElement('div');
        career.className = 'career-toast';
        career.setAttribute('role', 'status');
        career.style.animation = 'none';
        career.innerHTML = '<span class="career-toast-icon">🪵</span><span><strong>Achievement unlocked</strong><span class="career-toast-name">Valley Founded</span><span class="career-toast-xp">+25 XP</span></span>';
        document.body.appendChild(career);
        window.dispatchEvent(new Event('resize'));
        if (window.HudSafe) window.HudSafe.liftToasts();
      }, game.toast);
      await page.waitForTimeout(250);

      const geo = await page.evaluate((spec) => {
        function rect(sel) {
          const el = document.querySelector(sel);
          if (!el) return null;
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return null;
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) return null;
          if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return null;
          return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, sel };
        }
        function hit(a, b) {
          if (!a || !b) return false;
          const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          return w > 2 && h > 2;
        }
        const booth = rect('#arcade-ai-launch');
        const ticker = rect('#arcade-ai-ticker');
        const toastHost = spec.toast ? document.querySelector(spec.toast) : null;
        const toastEl = toastHost && (toastHost.querySelector('.aow-ach-toast, .toast') || toastHost);
        const toast = toastEl ? rectish(toastEl) : null;
        const careerEl = document.querySelector('.career-toast');
        const career = careerEl ? rectish(careerEl) : null;
        function rectish(el) {
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) return null;
          return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        }
        const bars = spec.bars.map(rect).filter(Boolean);
        const overlaps = [];
        bars.forEach((bar) => {
          if (hit(booth, bar)) overlaps.push('booth~' + bar.sel);
          if (hit(ticker, bar)) overlaps.push('announcer~' + bar.sel);
          if (hit(toast, bar)) overlaps.push('toast~' + bar.sel);
          if (hit(career, bar)) overlaps.push('achievement~' + bar.sel);
        });
        if (hit(toast, ticker)) overlaps.push('toast~announcer');
        if (hit(career, ticker)) overlaps.push('achievement~announcer');
        if (hit(career, toast) && ticker) {
          // Age of War's phone band, between the top bar and the unit
          // cards, cannot hold the announcer plus two toasts. When the
          // gap can hold both, they still have to miss each other.
          const topSafe = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hud-top-safe')) || 0;
          const free = ticker.top - topSafe;
          const need = (career.bottom - career.top) + (toast.bottom - toast.top) + 8;
          if (free >= need) overlaps.push('achievement~toast');
        }
        const tickerCs = ticker ? getComputedStyle(document.getElementById('arcade-ai-ticker')) : null;
        const toastCs = toastEl ? getComputedStyle(toastEl) : null;
        const careerCs = careerEl ? getComputedStyle(careerEl) : null;
        const vars = getComputedStyle(document.documentElement);
        const stacked = !!(career && ticker && career.bottom <= ticker.top + 2);
        return {
          overlaps,
          booth: !!booth,
          ticker: !!ticker,
          toast: !!toast,
          career: !!career,
          stacked,
          tickerPe: tickerCs ? tickerCs.pointerEvents : '',
          toastPe: toastCs ? toastCs.pointerEvents : '',
          careerPe: careerCs ? careerCs.pointerEvents : '',
          top: vars.getPropertyValue('--hud-top-safe').trim(),
          bottom: vars.getPropertyValue('--hud-bottom-safe').trim(),
          games: spec.gamesOnCard ? hit(rect('.ea-back'), rect('#next-action-card')) : false,
        };
      }, { bars: game.bars, toast: game.toast, gamesOnCard: !!game.gamesOnCard });

      ok(geo.booth, `${where} booth tab is on screen`);
      ok(geo.ticker, `${where} announcer is on screen`);
      ok(!game.toast || geo.toast, `${where} toast is on screen`);
      ok(geo.overlaps.length === 0, `${where} no HUD overlap${geo.overlaps.length ? ': ' + geo.overlaps.join(', ') : ''}`);
      ok(geo.tickerPe === 'none', `${where} announcer ignores pointer events`);
      if (game.toast) ok(geo.toastPe === 'none', `${where} toast ignores pointer events`);
      ok(geo.career, `${where} achievement toast is on screen`);
      ok(geo.careerPe === 'none', `${where} achievement toast ignores pointer events`);
      ok(geo.stacked, `${where} achievement toast stacks above the announcer`);
      ok(parseFloat(geo.top) > 0 && parseFloat(geo.bottom) > 0,
        `${where} safe zone is ${geo.top} / ${geo.bottom}`);
      if (game.gamesOnCard) ok(!geo.games, `${where} GAMES clears the first-step card`);
      await context.close();
    }
  }

  const dismiss = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const dismissPage = await dismiss.newPage();
  dismissPage.on('pageerror', (error) => errors.push('dismiss ' + error));
  await dismissPage.addInitScript(() => localStorage.setItem('aow-welcome-seen', '1'));
  await dismissPage.goto(BASE + '/ageofwar/', { waitUntil: 'domcontentloaded' });
  const resume = dismissPage.locator('#aow-resume-cta');
  if (await resume.count() && await resume.isVisible()) await resume.click();
  await dismissPage.waitForFunction(() => {
    const t = document.getElementById('arcade-ai-ticker');
    return t && !t.hidden && (t.textContent || '').length > 8;
  }, { timeout: 6000 });
  const shownAt = Date.now();
  await dismissPage.waitForFunction(() => {
    const t = document.getElementById('arcade-ai-ticker');
    return t && t.hidden;
  }, { timeout: 7000 });
  const waited = Date.now() - shownAt;
  ok(waited >= 2500 && waited <= 6500, `announcer auto-dismisses (${waited}ms)`);
  await dismiss.close();

  const careerDismiss = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const careerPage = await careerDismiss.newPage();
  careerPage.on('pageerror', (error) => errors.push('career ' + error));
  await careerPage.goto(BASE + '/hearthvale.html', { waitUntil: 'domcontentloaded' });
  const begin = careerPage.locator('#welcome-close');
  if (await begin.count() && await begin.isVisible()) await begin.click();
  await careerPage.waitForSelector('.career-toast', { timeout: 8000 });
  const careerShown = Date.now();
  await careerPage.waitForFunction(() => {
    const t = document.querySelector('.career-toast');
    return !t || t.classList.contains('career-toast-out');
  }, { timeout: 7000 });
  const careerWaited = Date.now() - careerShown;
  ok(careerWaited >= 1500 && careerWaited <= 5000, `achievement toast auto-dismisses (${careerWaited}ms)`);
  await careerDismiss.close();

  await browser.close();
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });
