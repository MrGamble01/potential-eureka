/*
 * FLAGSHIP — Age of War return chrome.
 *
 * Leaving mid-war used to throw the battle away. The pause and
 * game-over sheets told you to press a key and never offered Games.
 * Tablet width still laid thirty actions on a five-column grid left
 * over from when the bar had five buttons.
 *
 *  A. A fresh war has no resume sheet — Wave 1 is already the loop.
 *  B. A kept session opens on one Resume war CTA (not a silent start).
 *  C. Resume restores the wave, gold and era the snapshot named.
 *  D. New war drops the snapshot and starts Wave 1.
 *  E. A corrupt session is ignored — the war still boots.
 *  F. Pause is one Resume war tap plus Back to Games.
 *  G. Game-over source has a Play again CTA and a hub exit.
 *  H. 768×700 tucks the banner / endless / relic rail out of the
 *     topbar (they live in Settings) and keeps Games on screen.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives the production page.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  const errs = [];

  const open = async (viewport, init) => {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
    if (init) await page.addInitScript(init);
    await page.goto(BASE + '/ageofwar/', { waitUntil: 'load' });
    await page.waitForTimeout(1600);
    return { ctx, page };
  };

  // A
  {
    const { ctx, page } = await open({ width: 1280, height: 800 });
    const fresh = await page.evaluate(() => ({
      resume: !!document.getElementById('aow-resume-cta'),
      wave: (document.getElementById('aow-wave-num') || {}).textContent || '',
      gold: (document.getElementById('aow-gold') || {}).textContent || '',
      games: !!document.querySelector('a.ea-back[href="/"]'),
    }));
    ok(!fresh.resume && /WAVE 1/.test(fresh.wave) && fresh.games,
      'fresh boot — no resume sheet, Wave 1, Games is the exit');
    await ctx.close();
  }

  // B + C
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, () => {
      localStorage.setItem('aow-session', JSON.stringify({
        v: 1, waveNum: 7, gold: 420, xp: 80, playerEra: 1, enemyEra: 0,
        playerBaseHp: 900, playerBaseMax: 1500, enemyBaseHp: 1100, enemyBaseMax: 1500,
        difficulty: 'normal', endlessMode: false, warBanner: 'none',
        runStats: { kills: 12, gold: 200, time: 45 },
      }));
    });
    const sheet = await page.evaluate(() => {
      const ov = document.getElementById('aow-overlay');
      const resume = document.getElementById('aow-resume-cta');
      const hub = document.querySelector('#aow-overlay a.aow-cta-hub');
      return {
        shown: ov && ov.style.display === 'flex',
        label: resume && resume.textContent.trim(),
        hub: hub && hub.getAttribute('href'),
        copy: ov ? ov.textContent : '',
      };
    });
    ok(sheet.shown && sheet.label === 'Resume war' && sheet.hub === '/' &&
      /Wave\s+7/.test(sheet.copy) && /420/.test(sheet.copy),
      'kept session opens on one Resume war CTA naming wave 7 and 420 gold');

    await page.click('#aow-resume-cta');
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => ({
      hidden: (document.getElementById('aow-overlay') || {}).style.display === 'none',
      wave: (document.getElementById('aow-wave-num') || {}).textContent || '',
      gold: (document.getElementById('aow-gold') || {}).textContent || '',
      era: (document.getElementById('aow-era-name') || {}).textContent || '',
    }));
    ok(after.hidden && /WAVE 7/.test(after.wave) && after.gold === '420' && /Castle/.test(after.era),
      'Resume war restores wave 7, 420 gold, Castle Age');
    await ctx.close();
  }

  // D
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, () => {
      localStorage.setItem('aow-session', JSON.stringify({
        v: 1, waveNum: 7, gold: 420, xp: 80, playerEra: 1,
        playerBaseHp: 900, playerBaseMax: 1500, enemyBaseHp: 1100, enemyBaseMax: 1500,
      }));
    });
    await page.click('#aow-newwar-cta');
    await page.waitForTimeout(400);
    const neu = await page.evaluate(() => ({
      wave: (document.getElementById('aow-wave-num') || {}).textContent || '',
      kept: localStorage.getItem('aow-session'),
      resume: !!document.getElementById('aow-resume-cta'),
    }));
    ok(/WAVE 1/.test(neu.wave) && !neu.kept && !neu.resume,
      'New war drops the snapshot and starts Wave 1');
    await ctx.close();
  }

  // E
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, () => {
      localStorage.setItem('aow-session', '{"waves":"corrupt"}');
    });
    const bad = await page.evaluate(() => ({
      resume: !!document.getElementById('aow-resume-cta'),
      wave: (document.getElementById('aow-wave-num') || {}).textContent || '',
    }));
    ok(!bad.resume && /WAVE 1/.test(bad.wave),
      'a corrupt session is ignored — the war still boots');
    await ctx.close();
  }

  // F
  {
    const { ctx, page } = await open({ width: 1280, height: 800 });
    await page.click('#aow-pause-btn');
    await page.waitForTimeout(200);
    const paused = await page.evaluate(() => ({
      resume: (document.getElementById('aow-resume-cta') || {}).textContent,
      hub: (document.querySelector('#aow-overlay a.aow-cta-hub') || {}).getAttribute?.('href'),
    }));
    ok(paused.resume === 'Resume war' && paused.hub === '/',
      'pause is one Resume war tap plus Back to Games');
    await ctx.close();
  }

  // G — source guard so the end-of-run sheet cannot lose its one CTA
  {
    const src = fs.readFileSync(path.join(__dirname, '../../ageofwar/ageofwar.js'), 'utf8');
    const start = src.indexOf('function showOverlay(won)');
    const end = src.indexOf('\n  function destroy()', start);
    const body = start >= 0 && end > start ? src.slice(start, end) : '';
    ok(body.includes('aow-again-cta') && body.includes('Play again') &&
      body.includes('aow-cta-hub') && body.includes('clearSession()'),
      'game-over sheet has Play again, Back to Games, and clears the session');
  }

  // H
  {
    const { ctx, page } = await open({ width: 768, height: 700 });
    const tablet = await page.evaluate(() => {
      const vis = el => {
        if (!el) return false;
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') return false;
        const b = el.getBoundingClientRect();
        return b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < innerHeight;
      };
      const banner = document.getElementById('aow-banner');
      const endless = document.getElementById('aow-endless-btn');
      const relic = document.getElementById('aow-relic-btn');
      const settings = document.getElementById('aow-settings-btn');
      const games = document.querySelector('a.ea-back');
      const bar = document.querySelector('.aow-actionbar');
      const cols = bar ? getComputedStyle(bar).gridTemplateColumns.split(' ').length : 0;
      return {
        banner: vis(banner),
        endless: vis(endless),
        relic: vis(relic),
        settings: vis(settings),
        games: vis(games),
        cols,
      };
    });
    ok(!tablet.banner && !tablet.endless && !tablet.relic && tablet.settings && tablet.games,
      '768×700 tucks banner / endless / relics; Settings and Games stay');
    ok(tablet.cols !== 5, 'tablet action bar is no longer locked to five leftover columns');
    await ctx.close();
  }

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
