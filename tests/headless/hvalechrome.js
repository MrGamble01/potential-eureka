/*
 * FLAGSHIP — Hearthvale return chrome.
 *
 * AoW/Voxel got Games, named holds, sheet exits and tablet density
 * in #996–#999. Hearthvale still said ARCADE, loaded a town in
 * silence, trapped you on every sheet (z-index 600 over the hub
 * pill), and at 768–1024 piled the HUD / goal / speed rail over
 * the field.
 *
 *  A. The shared Games pill is the exit — not a custom ← ARCADE link.
 *  B. Welcome's one play CTA is Begin building; Games sits with it.
 *  C. A kept town paints the resume chip with the name, day and souls.
 *  D. A fresh valley leaves that chip hidden.
 *  E. 768×700 tucks the speed rail, drops the goal off the HUD,
 *     keeps Games on screen, and leaves the field taller than a
 *     leftover 200px strip.
 *  F. Achievements, Chronicle and Decrees carry Games beside Back to town.
 *  G. The Hall carries Games and tucks the leftover gear menu.
 *  H. A corrupt valley paints the unread chip and drops the blob.
 *  I. Pause is Resume the valley plus Games, and does not cover welcome.
 *  J. A kept town offers New town on the resume chip.
 *  K. 390×844 kept resume does not bury Games or the gear.
 *  L. Trader and the event sheet carry Games (z-index 600 buried the pill).
 *  M. Resume names caravan/order/advance/festival/fever deadlines and
 *     undated stake/surety/wolves holds from the kept snapshot.
 *  N. Pause names the same deadlines and holds; one tap still resumes.
 *  O. beforeunload flushes; a dropped town still cannot be rewritten.
 *  P. Escape closes the trader and The Hall.
 *  Q. Tab / Shift+Tab reach Games on welcome and pause without changing builds.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives the production page.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const keptTown = () => {
  localStorage.setItem('hearthvale-v1', JSON.stringify({
    seed: 12345, day: 12, time: 10, seenIntro: true,
    townName: 'Riverside', happy: 55, goalIndex: 0, _nextId: 10,
    res: { wood: 40, stone: 20, food: 30, gold: 25 },
    buildings: [],
    villagers: [
      { id: 1, tx: 20, ty: 20, name: 'Asha' },
      { id: 2, tx: 21, ty: 20, name: 'Bren' },
      { id: 3, tx: 22, ty: 20, name: 'Cora' },
    ],
  }));
};

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
    await page.goto(BASE + '/hearthvale.html', { waitUntil: 'load' });
    await page.waitForTimeout(2200);
    return { ctx, page };
  };

  // A + B
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, () => {
      localStorage.removeItem('hearthvale-v1');
    });
    const chrome = await page.evaluate(() => {
      const backs = [...document.querySelectorAll('a.ea-back')];
      const arcade = [...document.querySelectorAll('a, .ea-word')].filter(a => /ARCADE/i.test(a.textContent || ''));
      const welcome = document.getElementById('welcome');
      const close = document.getElementById('welcome-close');
      const hub = welcome && welcome.querySelector('a.ea-back');
      return {
        games: backs.length,
        hrefs: backs.map(a => a.getAttribute('href')),
        words: backs.map(a => (a.textContent || '').replace(/\s+/g, ' ').trim()),
        arcade: arcade.length,
        welcome: welcome && welcome.classList.contains('show'),
        begin: close && close.textContent.trim(),
        hub: hub && hub.getAttribute('href'),
      };
    });
    ok(chrome.games >= 1 && chrome.hrefs.every(h => h === '/') && chrome.arcade === 0,
      'shared Games pill is the exit — no custom ← ARCADE link');
    ok(chrome.welcome && chrome.begin === 'Begin building' && chrome.hub === '/',
      "welcome's one play CTA is Begin building; Games sits with it");
    await ctx.close();
  }

  // C
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, keptTown);
    const chip = await page.evaluate(() => {
      const el = document.getElementById('resumeChip');
      return {
        hidden: !el || el.hidden || getComputedStyle(el).display === 'none',
        text: el ? el.textContent.replace(/\s+/g, ' ').trim() : '',
      };
    });
    ok(!chip.hidden && /Riverside/.test(chip.text) && /Day 12/.test(chip.text) && /3 villagers/.test(chip.text),
      'a kept town paints the resume chip with the name, day and souls');
    await ctx.close();
  }

  // D
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, () => {
      localStorage.removeItem('hearthvale-v1');
    });
    const fresh = await page.evaluate(() => {
      const el = document.getElementById('resumeChip');
      return !el || el.hidden || getComputedStyle(el).display === 'none';
    });
    ok(fresh, 'a fresh valley leaves the resume chip hidden');
    await ctx.close();
  }

  // E
  {
    const { ctx, page } = await open({ width: 768, height: 700 }, keptTown);
    const geo = await page.evaluate(() => {
      const hud = document.getElementById('hud');
      const goals = document.getElementById('goals');
      const speed = document.getElementById('speedctl');
      const bar = document.getElementById('buildbar');
      const games = document.querySelector('a.ea-back.ea-back--float');
      if (!hud || !goals || !bar || !games) return { ok: false };
      const hb = hud.getBoundingClientRect();
      const gb = goals.getBoundingClientRect();
      const bb = bar.getBoundingClientRect();
      const overlap = !(gb.right < hb.left || gb.left > hb.right || gb.bottom < hb.top || gb.top > hb.bottom);
      const speedOn = speed && getComputedStyle(speed).display !== 'none';
      const fieldH = Math.round(bb.top - hb.bottom);
      const gm = games.getBoundingClientRect();
      return {
        ok: true,
        overlap,
        speedOn,
        fieldH,
        gamesOn: gm.bottom > 0 && gm.top < innerHeight,
        goalsLow: gb.top > innerHeight * 0.45,
      };
    });
    ok(geo.ok && !geo.overlap && !geo.speedOn && geo.goalsLow && geo.gamesOn && geo.fieldH > 200,
      '768×700 tucks the speed rail, drops the goal off the HUD, Games stays, field > 200px'
      + (geo.ok ? ` (field ${geo.fieldH}px)` : ''));
    await ctx.close();
  }

  // F
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, keptTown);
    await page.click('#menu-btn');
    await page.waitForTimeout(120);
    await page.click('#m-achv');
    await page.waitForTimeout(200);
    const ach = await page.evaluate(() => {
      const ov = document.getElementById('achv');
      const close = document.getElementById('achv-close');
      const hub = ov && ov.querySelector('a.ea-back');
      return {
        open: ov && ov.classList.contains('show'),
        back: close && close.textContent.trim(),
        hub: hub && hub.getAttribute('href'),
      };
    });
    ok(ach.open && ach.back === 'Back to town' && ach.hub === '/',
      'Achievements is Back to town plus Games');
    await page.click('#achv-close');
    await page.waitForTimeout(80);
    await page.click('#menu-btn');
    await page.waitForTimeout(120);
    await page.click('#m-chronicle');
    await page.waitForTimeout(200);
    const chron = await page.evaluate(() => {
      const ov = document.getElementById('chronicle');
      const close = document.getElementById('chron-close');
      const hub = ov && ov.querySelector('a.ea-back');
      return {
        open: ov && ov.classList.contains('show'),
        back: close && close.textContent.trim(),
        hub: hub && hub.getAttribute('href'),
      };
    });
    ok(chron.open && chron.back === 'Back to town' && chron.hub === '/',
      'Chronicle is Back to town plus Games');
    await page.click('#chron-close');
    await page.waitForTimeout(80);
    await page.click('#menu-btn');
    await page.waitForTimeout(120);
    await page.click('#m-decrees');
    await page.waitForTimeout(200);
    const dec = await page.evaluate(() => {
      const ov = document.getElementById('decrees');
      const close = document.getElementById('decree-close');
      const hub = ov && ov.querySelector('a.ea-back');
      return {
        open: ov && ov.classList.contains('show'),
        back: close && close.textContent.trim(),
        hub: hub && hub.getAttribute('href'),
      };
    });
    ok(dec.open && dec.back === 'Back to town' && dec.hub === '/',
      'Decrees is Back to town plus Games');
    await ctx.close();
  }

  // G
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, keptTown);
    await page.click('#menu-btn');
    await page.waitForTimeout(120);
    await page.click('#chain-btn');
    await page.waitForTimeout(200);
    const hall = await page.evaluate(() => {
      const m = document.getElementById('chain-modal');
      const hub = m && m.querySelector('a.ea-back');
      return {
        open: m && m.classList.contains('open'),
        hub: hub && hub.getAttribute('href'),
      };
    });
    const menuShut = await page.evaluate(() => {
      const menu = document.getElementById('menu');
      return !menu || !menu.classList.contains('show');
    });
    ok(hall.open && hall.hub === '/' && menuShut, 'The Hall carries Games and tucks the gear menu');
    await ctx.close();
  }

  // H
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, () => {
      localStorage.setItem('hearthvale-v1', '{not-json');
    });
    const bad = await page.evaluate(() => {
      const el = document.getElementById('resumeChip');
      return {
        hidden: !el || el.hidden || getComputedStyle(el).display === 'none',
        text: el ? el.textContent.replace(/\s+/g, ' ').trim() : '',
        kept: localStorage.getItem('hearthvale-v1'),
      };
    });
    ok(!bad.hidden && /could not be read/.test(bad.text) && !bad.kept,
      'a corrupt valley paints the unread chip and drops the blob');
    await ctx.close();
  }

  // I
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, keptTown);
    const welcomePause = await page.evaluate(() => {
      const pe = document.getElementById('paused');
      return !!(pe && pe.classList.contains('show'));
    });
    ok(!welcomePause, 'a running kept town does not show the pause sheet');

    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    const held = await page.evaluate(() => {
      const pe = document.getElementById('paused');
      const resume = document.getElementById('pause-resume');
      const hub = pe && pe.querySelector('a.ea-back');
      return {
        show: pe && pe.classList.contains('show') && pe.classList.contains('held'),
        label: resume && resume.textContent.trim(),
        hub: hub && hub.getAttribute('href'),
        copy: pe ? pe.textContent.replace(/\s+/g, ' ').trim() : '',
      };
    });
    ok(held.show && held.label === 'Resume the valley' && held.hub === '/' && /valley is held/.test(held.copy),
      'pause is Resume the valley plus Games');
    await page.click('#pause-resume');
    await page.waitForTimeout(150);
    const cleared = await page.evaluate(() => {
      const pe = document.getElementById('paused');
      return !pe || !pe.classList.contains('show');
    });
    ok(cleared, 'Resume the valley lifts the pause sheet');
    await ctx.close();
  }

  // J — plant after first paint so a reload cannot re-seed the kept blob
  {
    const { ctx, page } = await open({ width: 1280, height: 800 });
    await page.evaluate(keptTown);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(2200);
    const neu = await page.evaluate(() => {
      const btn = document.getElementById('resumeNewTown');
      return {
        on: !!(btn && !btn.hidden && getComputedStyle(btn).display !== 'none'),
        label: btn && btn.textContent.trim(),
      };
    });
    ok(neu.on && neu.label === 'New town', 'a kept town offers New town on the resume chip');
    page.once('dialog', d => d.accept());
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load' }),
      page.click('#resumeNewTown'),
    ]);
    await page.waitForTimeout(2400);
    const after = await page.evaluate(() => {
      const el = document.getElementById('resumeChip');
      const welcome = document.getElementById('welcome');
      return {
        chipGone: !el || el.hidden || getComputedStyle(el).display === 'none',
        welcome: !!(welcome && welcome.classList.contains('show')),
        kept: localStorage.getItem('hearthvale-v1'),
      };
    });
    ok(after.chipGone && after.welcome && !after.kept,
      'New town drops the snapshot and opens Begin building');
    await ctx.close();
  }

  // K
  {
    const { ctx, page } = await open({ width: 390, height: 844 }, keptTown);
    const phone = await page.evaluate(() => {
      const chip = document.getElementById('resumeChip');
      const games = document.querySelector('a.ea-back.ea-back--float');
      const gear = document.getElementById('menu-btn');
      if (!chip || !games || !gear) return { ok: false };
      const cb = chip.getBoundingClientRect();
      const gb = games.getBoundingClientRect();
      const mb = gear.getBoundingClientRect();
      const bury = (a, b) => !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
      return {
        ok: true,
        chipOn: !chip.hidden && cb.bottom > 0,
        gamesOn: gb.bottom > 0 && gb.top < innerHeight,
        gearOn: mb.bottom > 0 && mb.top < innerHeight,
        buryGames: bury(cb, gb),
        buryGear: bury(cb, mb),
      };
    });
    ok(phone.ok && phone.chipOn && phone.gamesOn && phone.gearOn && !phone.buryGames && !phone.buryGear,
      '390×844 kept resume does not bury Games or the gear'
      + (phone.ok && phone.chipOn && phone.gamesOn && phone.gearOn && !phone.buryGames && !phone.buryGear
        ? '' : ` — ${JSON.stringify(phone)}`));
    await ctx.close();
  }

  // L
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, keptTown);
    await page.click('#menu-btn');
    await page.waitForTimeout(80);
    const sheets = await page.evaluate(() => {
      const trader = document.getElementById('trader');
      const event = document.getElementById('event');
      const menu = document.getElementById('menu');
      const float = document.querySelector('a.ea-back.ea-back--float');
      trader.classList.add('show');
      const tHub = trader.querySelector('a.ea-back');
      const tClose = document.getElementById('trader-close');
      const tb = trader.getBoundingClientRect();
      const fb = float.getBoundingClientRect();
      const bury = !(fb.right < tb.left || fb.left > tb.right || fb.bottom < tb.top || fb.top > tb.bottom);
      trader.classList.remove('show');
      event.classList.add('show');
      const eHub = event.querySelector('a.ea-back');
      const evCtas = event.querySelector('.sheet-ctas');
      event.classList.remove('show');
      return {
        tHub: tHub && tHub.getAttribute('href'),
        tClose: tClose && tClose.textContent.trim(),
        tBury: bury,
        eHub: eHub && eHub.getAttribute('href'),
        eCtas: !!(evCtas && evCtas.querySelector('a.ea-back')),
        gearWas: menu && menu.classList.contains('show'),
      };
    });
    ok(sheets.tHub === '/' && sheets.tClose === 'Send them on their way' && sheets.tBury,
      'Trader is Send them on their way plus Games (sheet covers the float pill)');
    ok(sheets.eHub === '/' && sheets.eCtas,
      'the event sheet carries Games beside the choices');
    const src = fs.readFileSync(path.join(__dirname, '../../hearthvale.html'), 'utf8');
    ok(src.includes('function openTrader') && src.includes('function openEvent') &&
      /function openTrader[\s\S]*tuckGear\(\)/.test(src) &&
      /function openEvent[\s\S]*tuckGear\(\)/.test(src),
      'opening trader or an event tucks the leftover gear menu');
    await ctx.close();
  }

  // M + N
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, () => {
      localStorage.setItem('hearthvale-v1', JSON.stringify({
        seed: 12345, day: 12, time: 10, seenIntro: true,
        townName: 'Riverside', happy: 55, goalIndex: 0, _nextId: 10,
        res: { wood: 40, stone: 20, food: 30, gold: 25 },
        buildings: [],
        villagers: [
          { id: 1, tx: 20, ty: 20, name: 'Asha' },
          { id: 2, tx: 21, ty: 20, name: 'Bren' },
        ],
        caravan: { returnDay: 15 },
        caravanStake: true,
        caravanSurety: true,
        festival: { endDay: 17, x: 640, y: 640 },
        feverUntil: 14,
        order: { k: 'food', qty: 15, pay: 60, byDay: 18 },
        merchantAdvance: { due: 16 },
        raidTonight: true,
      }));
    });
    const named = await page.evaluate(() => {
      const el = document.getElementById('resumeChip');
      return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    });
    const expectedHolds = [
      'the caravan returns day 15', 'a stake is still riding',
      'the surety is still signed', 'an order is due by day 18',
      'the advance is due day 16', 'the wolves are still out',
      'the festival ends day 17', 'the fever ends day 14',
    ];
    ok(/Riverside/.test(named) && expectedHolds.every(bit => named.includes(bit)),
      'resume names all five deadlines and undated stake/surety/wolves holds — ' + named);

    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    const held = await page.evaluate(() => {
      const pe = document.getElementById('paused');
      const holds = document.getElementById('pause-holds');
      const resume = document.getElementById('pause-resume');
      return {
        show: pe && pe.classList.contains('show') && pe.classList.contains('held'),
        text: holds ? holds.textContent.replace(/\s+/g, ' ').trim() : '',
        hidden: !holds || holds.hidden,
        resume: resume && resume.textContent.trim(),
      };
    });
    ok(held.show && !held.hidden && expectedHolds.every(bit => held.text.includes(bit)) &&
      /One tap continues/.test(held.text) && held.resume === 'Resume the valley',
      'pause names all five deadlines and undated holds; one tap still resumes — ' + held.text);
    await ctx.close();
  }

  // O
  {
    const src = fs.readFileSync(path.join(__dirname, '../../hearthvale.html'), 'utf8');
    ok(src.includes("addEventListener('beforeunload', save)") &&
      src.includes('if (townDropped || !townKept()) return'),
      'beforeunload flushes a kept town; a dropped or unstarted town cannot be rewritten');
  }

  // P
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, keptTown);
    await page.evaluate(() => document.getElementById('trader').classList.add('show'));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);
    const traderShut = await page.evaluate(() => {
      const t = document.getElementById('trader');
      return !t || !t.classList.contains('show');
    });
    ok(traderShut, 'Escape closes the trader');

    await page.click('#menu-btn');
    await page.waitForTimeout(80);
    await page.click('#chain-btn');
    await page.waitForTimeout(160);
    const hallOpen = await page.evaluate(() => {
      const m = document.getElementById('chain-modal');
      return m && m.classList.contains('open');
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);
    const hallShut = await page.evaluate(() => {
      const m = document.getElementById('chain-modal');
      return !m || !m.classList.contains('open');
    });
    ok(hallOpen && hallShut, 'Escape closes The Hall');
    await ctx.close();
  }

  // Q — the build-category shortcut must not consume browser focus navigation.
  for (const returning of [false, true]) {
    const { ctx, page } = await open({ width: 1280, height: 800 }, returning ? keptTown : null);
    if (returning) await page.keyboard.press('Space');
    const sheet = returning ? '#paused' : '#welcome';
    const cta = returning ? '#pause-resume' : '#welcome-close';
    const category = await page.locator('#buildtabs .on').textContent();
    await page.focus(cta);
    await page.keyboard.press('Tab');
    const reached = await page.locator(sheet + ' a.ea-back').evaluate(el => el === document.activeElement);
    ok(reached && await page.locator('#buildtabs .on').textContent() === category,
      `${returning ? 'pause' : 'welcome'}: Tab reaches Games without changing the build category`);
    await page.keyboard.press('Shift+Tab');
    ok(await page.locator(cta).evaluate(el => el === document.activeElement) &&
      await page.locator('#buildtabs .on').textContent() === category,
      `${returning ? 'pause' : 'welcome'}: Shift+Tab returns to the play CTA without changing builds`);
    if (reached) {
      await page.keyboard.press('Tab');
      await Promise.all([
        page.waitForURL(BASE + '/'),
        page.keyboard.press('Enter'),
      ]);
      ok(new URL(page.url()).pathname === '/', `${returning ? 'pause' : 'welcome'}: keyboard Games exits to the hub`);
    }
    await ctx.close();
  }

  ok(errs.length === 0, `zero page errors${errs.length ? ' — ' + errs[0] : ''}`);

  await browser.close();
  console.log(`\n${pass}/${pass + fail} checks passed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
