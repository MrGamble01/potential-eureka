/*
 * FLAGSHIP — Age of War return chrome leftovers.
 *
 * #996 kept the war's numbers. This pass holds the field itself —
 * units, the training queue, a riding wager — and puts Games on
 * every sheet that used to trap you. Tablet width 1024 tucks the
 * leftover difficulty rail the way 900 already tucked banners.
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
 *  I. A v2 snapshot with units on the field names the held line
 *     and flush-on-leave writes those units, the queue and the wager.
 *  J. 1024×700 tucks difficulty / banner / endless / relics.
 *  K. Welcome is Let's go plus Back to Games.
 *  L. Settings, Awards and The Line each carry Back to Games.
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

  const open = async (viewport, init, opts) => {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
    if (!opts || !opts.freshWelcome) {
      await page.addInitScript(() => { try { localStorage.setItem('aow-welcome-seen', '1'); } catch {} });
    }
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

    const applied = await page.evaluate(() => ({
      wave: (document.getElementById('aow-wave-num') || {}).textContent || '',
      gold: parseInt((document.getElementById('aow-gold') || {}).textContent || '0', 10),
      era: (document.getElementById('aow-era-name') || {}).textContent || '',
    }));
    await page.click('#aow-resume-cta');
    await page.waitForTimeout(250);
    const after = await page.evaluate(() => ({
      hidden: (document.getElementById('aow-overlay') || {}).style.display === 'none',
      wave: (document.getElementById('aow-wave-num') || {}).textContent || '',
      era: (document.getElementById('aow-era-name') || {}).textContent || '',
    }));
    ok(/WAVE 7/.test(applied.wave) && applied.gold >= 420 && /Castle/.test(applied.era) &&
      after.hidden && /WAVE 7/.test(after.wave),
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
      hidden: (document.getElementById('aow-overlay') || {}).style.display === 'none',
    }));
    ok(/WAVE 1/.test(neu.wave) && !neu.kept && neu.hidden,
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
    await page.evaluate(() => document.getElementById('aow-pause-btn').click());
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
      body.includes('overlayCtas') && body.includes('clearSession()') &&
      src.includes('aow-cta-hub') && src.includes('Back to Games'),
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

  // I — the field, the queue and a riding wager survive leave
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, () => {
      localStorage.setItem('aow-session', JSON.stringify({
        v: 2, waveNum: 4, gold: 300, xp: 40, playerEra: 1, enemyEra: 0,
        playerBaseHp: 900, playerBaseMax: 1500, enemyBaseHp: 1100, enemyBaseMax: 1500,
        units: [
          { side: 'player', key: 'club', x: 200, hp: 70, hpMax: 84, dmg: 12, aliveT: 8 },
          { side: 'player', key: 'sling', x: 240, hp: 30, hpMax: 36, dmg: 21, aliveT: 2 },
          { side: 'enemy', key: 'club', x: 980, hp: 50, hpMax: 84, dmg: 12, aliveT: 5 },
        ],
        trainingQueue: [{ key: 'dino', total: 4, remaining: 2.2 }],
        ironBet: { stake: 200, hpAtBet: 900 },
      }));
    });
    const copy = await page.evaluate(() => {
      const ov = document.getElementById('aow-overlay');
      return ov ? ov.textContent : '';
    });
    ok(/line is still on the field/.test(copy) && /\(3\)/.test(copy),
      'resume names the held line of three');
    await page.click('#aow-resume-cta');
    await page.waitForTimeout(250);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const saved = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('aow-session') || 'null'); }
      catch { return null; }
    });
    ok(saved && saved.v === 2 && Array.isArray(saved.units) && saved.units.length === 3 &&
      saved.units.some(u => u.key === 'sling' && u.side === 'player') &&
      saved.trainingQueue && saved.trainingQueue[0] && saved.trainingQueue[0].key === 'dino' &&
      saved.ironBet && saved.ironBet.stake === 200,
      'leave flush writes the field, the queue and the wager');
    await ctx.close();
  }

  // J
  {
    const { ctx, page } = await open({ width: 1024, height: 700 });
    const tablet = await page.evaluate(() => {
      const vis = el => {
        if (!el) return false;
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') return false;
        const b = el.getBoundingClientRect();
        return b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < innerHeight;
      };
      return {
        diff: vis(document.getElementById('aow-diff')),
        banner: vis(document.getElementById('aow-banner')),
        endless: vis(document.getElementById('aow-endless-btn')),
        relic: vis(document.getElementById('aow-relic-btn')),
        settings: vis(document.getElementById('aow-settings-btn')),
        games: vis(document.querySelector('a.ea-back')),
      };
    });
    ok(!tablet.diff && !tablet.banner && !tablet.endless && !tablet.relic &&
      tablet.settings && tablet.games,
      '1024×700 tucks difficulty / banner / endless / relics; Settings and Games stay');
    await ctx.close();
  }

  // K
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, null, { freshWelcome: true });
    const welcome = await page.evaluate(() => {
      const m = document.getElementById('aow-welcome-modal');
      const hub = m && m.querySelector('a.aow-cta-hub');
      const go = document.getElementById('aow-welcome-close');
      return {
        open: m && getComputedStyle(m).display !== 'none',
        go: go && /Let's go/.test(go.textContent || ''),
        hub: hub && hub.getAttribute('href'),
      };
    });
    ok(welcome.open && welcome.go && welcome.hub === '/',
      "welcome is Let's go plus Back to Games");
    await ctx.close();
  }

  // L
  {
    const { ctx, page } = await open({ width: 1280, height: 800 });
    await page.click('#aow-settings-btn');
    await page.waitForTimeout(150);
    const settings = await page.evaluate(() => {
      const m = document.getElementById('aow-settings-modal');
      const hub = m && m.querySelector('a.aow-cta-hub');
      return { open: m && getComputedStyle(m).display !== 'none', hub: hub && hub.getAttribute('href') };
    });
    ok(settings.open && settings.hub === '/', 'Settings carries Back to Games');
    await page.click('#aow-settings-close');
    await page.waitForTimeout(80);
    await page.click('#aow-ach-btn');
    await page.waitForTimeout(150);
    const awards = await page.evaluate(() => {
      const m = document.getElementById('aow-ach-modal');
      const hub = m && m.querySelector('a.aow-cta-hub');
      return { open: m && getComputedStyle(m).display !== 'none', hub: hub && hub.getAttribute('href') };
    });
    ok(awards.open && awards.hub === '/', 'Awards carries Back to Games');
    await page.click('#aow-ach-close');
    await page.waitForTimeout(80);
    await page.click('#aow-chain-btn');
    await page.waitForTimeout(150);
    const line = await page.evaluate(() => {
      const m = document.getElementById('aow-chain-modal');
      const hub = m && m.querySelector('a.aow-cta-hub');
      return { open: m && getComputedStyle(m).display !== 'none', hub: hub && hub.getAttribute('href') };
    });
    ok(line.open && line.hub === '/', 'The Line carries Back to Games');
    await ctx.close();
  }

  {
    const src = fs.readFileSync(path.join(__dirname, '../../ageofwar/ageofwar.js'), 'utf8');
    ok(src.includes('function packUnits') && src.includes('function unpackUnits') &&
      src.includes('units: packUnits(units)') && src.includes('beforeunload') &&
      /applySession[\s\S]*unpackUnits/.test(src),
      'session v2 packs the field and flushes on beforeunload');
  }

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
