/* HUD safe zone and Outfit word spaces.
   Spaces in display type have to be wider than a missing glyph, and
   the booth, announcer, and toasts have to stay off the other HUD
   at a phone and a desktop size for every flagship. The trophy room
   keeps the Sparks pill, the studio tabs, the achievement toast, and
   the shop cards off each other, and the shop stays on the dark HUD
   tokens even when the hub theme is daylight. */
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
          if (line) line.textContent = 'Saved.';
          else ticker.appendChild(document.createTextNode('Saved.'));
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

  function lum(rgb) {
    const nums = String(rgb).match(/[\d.]+/g);
    if (!nums || nums.length < 3) return 1;
    const ch = nums.slice(0, 3).map((v) => {
      const c = Number(v) / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  }
  function contrast(a, b) {
    const hi = Math.max(lum(a), lum(b));
    const lo = Math.min(lum(a), lum(b));
    return (hi + 0.05) / (lo + 0.05);
  }

  for (const view of VIEWS) {
    const context = await browser.newContext({
      viewport: { width: view.width, height: view.height },
      colorScheme: 'light',
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push('trophy ' + view.label + ' ' + error));
    await page.goto(BASE + '/#trophy', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#view-trophy.active #spark-shop .spark-card', { timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);
    if (view.width < 1100) {
      await page.locator('#studio-menu').click();
      await page.waitForSelector('.hub-chrome.is-menu-open .sec-link', { timeout: 4000 });
    }
    const geo = await page.evaluate(() => {
      EurekaProgress.emit('hearthvale', 'found', 1);
      document.querySelectorAll('.career-toast, #spark-toast').forEach((el) => {
        el.style.animation = 'none';
      });
      if (window.HudSafe) window.HudSafe.apply();
      function painted(el) {
        if (!el || el.hidden) return null;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return null;
        const rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return null;
        let r = { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        let node = el.parentElement;
        while (node && node !== document.documentElement) {
          const pcs = getComputedStyle(node);
          if (pcs.display === 'none' || pcs.visibility === 'hidden') return null;
          const clipY = pcs.overflowY === 'hidden' || pcs.overflowY === 'clip' || pcs.overflowY === 'auto' || pcs.overflowY === 'scroll';
          const clipX = pcs.overflowX === 'hidden' || pcs.overflowX === 'clip' || pcs.overflowX === 'auto' || pcs.overflowX === 'scroll';
          if (clipY || clipX) {
            const pr = node.getBoundingClientRect();
            const top = clipY ? Math.max(r.top, pr.top) : r.top;
            const bottom = clipY ? Math.min(r.bottom, pr.bottom) : r.bottom;
            const left = clipX ? Math.max(r.left, pr.left) : r.left;
            const right = clipX ? Math.min(r.right, pr.right) : r.right;
            if (bottom - top < 2 || right - left < 2) return null;
            r = { left, right, top, bottom };
          }
          node = node.parentElement;
        }
        if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return null;
        return r;
      }
      function hit(a, b) {
        if (!a || !b) return false;
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        return w > 2 && h > 2;
      }
      const pill = painted(document.getElementById('spark-toast'));
      const toast = painted(document.querySelector('.career-toast'));
      const tabs = [...document.querySelectorAll('.arcade-secondary-nav .sec-link')].map((el) => ({
        text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
        box: painted(el),
      })).filter((tab) => tab.box);
      const cards = [...document.querySelectorAll('.spark-card')].map(painted).filter(Boolean);
      const overlaps = [];
      tabs.forEach((tab) => {
        if (hit(pill, tab.box)) overlaps.push('pill~' + tab.text);
        if (hit(toast, tab.box)) overlaps.push('toast~' + tab.text);
        cards.forEach((card) => { if (hit(tab.box, card)) overlaps.push('tab~card'); });
      });
      cards.forEach((card) => {
        if (hit(pill, card)) overlaps.push('pill~card');
        if (hit(toast, card)) overlaps.push('toast~card');
      });
      if (hit(pill, toast)) overlaps.push('pill~toast');
      const shopEl = document.querySelector('#spark-shop');
      const cardEl = document.querySelector('.spark-card');
      const ruleEl = document.querySelector('#spark-shop .spark-rules');
      const filterEl = document.querySelector('.spark-filter');
      const shopCs = getComputedStyle(shopEl);
      const cardCs = getComputedStyle(cardEl);
      const ruleCs = getComputedStyle(ruleEl);
      const filterCs = getComputedStyle(filterEl);
      const paint = {
        shopBg: shopCs.backgroundColor,
        shopColor: shopCs.color,
        cardBg: cardCs.backgroundColor,
        cardColor: cardCs.color,
        ruleColor: ruleCs.color,
        filterBg: filterCs.backgroundColor,
        filterColor: filterCs.color,
      };
      const root = document.documentElement;
      root.style.setProperty('--hud-card', 'rgb(1, 2, 3)');
      root.style.setProperty('--hud-text', 'rgb(4, 5, 6)');
      root.style.setProperty('--hud-bg', 'rgb(7, 8, 9)');
      root.style.setProperty('--hud-font-display', 'SentinelFont, Outfit, sans-serif');
      const bound = {
        bg: getComputedStyle(shopEl).backgroundColor,
        color: getComputedStyle(shopEl).color,
        card: getComputedStyle(cardEl).backgroundColor,
        font: getComputedStyle(shopEl).fontFamily,
      };
      root.style.removeProperty('--hud-card');
      root.style.removeProperty('--hud-text');
      root.style.removeProperty('--hud-bg');
      root.style.removeProperty('--hud-font-display');
      return {
        overlaps,
        tabs: tabs.map((tab) => tab.text),
        cards: cards.length,
        pill: pill ? (document.getElementById('spark-toast').textContent || '') : '',
        toast: !!toast,
        shopBg: paint.shopBg,
        shopColor: paint.shopColor,
        cardBg: paint.cardBg,
        cardColor: paint.cardColor,
        ruleColor: paint.ruleColor,
        filterBg: paint.filterBg,
        filterColor: paint.filterColor,
        boundBg: bound.bg,
        boundColor: bound.color,
        boundCard: bound.card,
        boundFont: bound.font,
      };
    });
    const where = 'trophy ' + view.label;
    ok(geo.tabs.length >= 4 && geo.tabs.some((t) => /Patch Notes/.test(t)) && geo.tabs.some((t) => /How it works/.test(t)),
      `${where} studio tabs are on screen (${geo.tabs.length})`);
    ok(geo.cards >= 1, `${where} shop cards are on screen (${geo.cards})`);
    ok(/Sparks/.test(geo.pill), `${where} sparks pill says "${geo.pill}"`);
    ok(geo.toast, `${where} achievement toast is on screen`);
    ok(geo.overlaps.length === 0, `${where} no shop HUD overlap${geo.overlaps.length ? ': ' + [...new Set(geo.overlaps)].join(', ') : ''}`);
    ok(geo.boundBg === 'rgb(1, 2, 3)' && geo.boundColor === 'rgb(4, 5, 6)' && geo.boundCard === 'rgb(7, 8, 9)',
      `${where} shop paint follows the HUD tokens`);
    ok(/SentinelFont/.test(geo.boundFont) && /Outfit/.test(geo.boundFont),
      `${where} shop font follows the HUD display stack (${geo.boundFont})`);
    ok(contrast(geo.shopColor, geo.shopBg) >= 4.5 && contrast(geo.cardColor, geo.cardBg) >= 4.5
      && contrast(geo.ruleColor, geo.shopBg) >= 4.5 && contrast(geo.filterColor, geo.filterBg) >= 4.5,
      `${where} shop text stays readable`);
    await context.close();
  }

  await browser.close();
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });
