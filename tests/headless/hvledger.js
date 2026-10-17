/* Night ledger, clinic juice, and phone play.
 *
 * A. A fresh board plants Inez, Malik, and Rosa. Malik leads with 7.
 * B. Signing with an empty shelf of dressings refuses. One dressing signs,
 *    and the line survives outside the camp save.
 * C. Beating the mark pays 8 goodwill once. A tied mark does not.
 * D. A broken board is replaced by the neighbors. A quiet dawn does not
 *    write the board.
 * E. The dressing chime starts three oscillators. juice() flashes the camp.
 * F. On a phone the walk pad moves the player, clinic actions sit in the
 *    dock with 44px targets, and the pad does not cover them.
 * G. On a desktop the pad is hidden and Dress stays on the action rail.
 * Z. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 180)));
  await page.addInitScript(() => {
    localStorage.setItem('hv-intro-seen', '1');
    if (!sessionStorage.getItem('hvledger-init')) {
      sessionStorage.setItem('hvledger-init', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-night-ledger');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => typeof loadLedger === 'function' && typeof G !== 'undefined');
  await page.waitForTimeout(400);
  const t = fn => page.evaluate(fn);

  const planted = await t(() => {
    ledgerCache = null;
    localStorage.removeItem('hv-night-ledger');
    const rows = loadLedger();
    const mark = ledgerMark();
    return {
      names: rows.map(e => e.name).join(','),
      malik: rows.find(e => e.id === 'malik').dressings,
      mark: mark.name + ':' + mark.dressings,
      stored: !!localStorage.getItem('hv-night-ledger'),
    };
  });
  ok(planted.names === 'Inez,Malik,Rosa' && planted.malik === 7 && planted.mark === 'Malik:7' && planted.stored,
    `a fresh board plants the three neighbors and Malik leads (${planted.mark})`);

  const signed = await t(() => {
    G.structures.clinic = true; G.dressings = 0; G.ledgerSigned = 0; G.ledgerId = ''; G.days = 4;
    G.goalIndex = GOALS.length;
    const refused = signLedger() === false && !localStorage.getItem('hv-night-ledger').includes('Your camp');
    G.dressings = 2;
    const okSign = signLedger() === true;
    ledgerCache = null;
    const again = loadLedger().find(e => e.name === 'Your camp');
    return { refused, okSign, dressings: again && again.dressings, days: again && again.days, signed: G.ledgerSigned };
  });
  ok(signed.refused && signed.okSign && signed.dressings === 2 && signed.days === 4 && signed.signed === 1,
    `one dressing signs the camp, and the line is outside the save (${signed.dressings} dressed, day ${signed.days})`);

  const claim = await t(() => {
    G.ledgerClaimed = 0; G.goodwill = 10; G.dressings = 7; G.goalIndex = GOALS.length;
    const tied = claimLedger() === false && G.goodwill === 10;
    G.dressings = 8;
    const won = claimLedger() === true;
    const paid = G.goodwill;
    const twice = claimLedger() === false && G.goodwill === paid;
    ledgerCache = null;
    const yours = loadLedger().find(e => e.id === G.ledgerId);
    return { tied, won, paid, twice, yours: yours && yours.dressings, claimed: G.ledgerClaimed };
  });
  ok(claim.tied && claim.won && claim.paid === 18 && claim.twice && claim.yours === 8 && claim.claimed === 1,
    `beating Malik pays 8 goodwill once (goodwill ${claim.paid}, your line ${claim.yours})`);

  const broken = await t(() => {
    localStorage.setItem('hv-night-ledger', '{');
    ledgerCache = null;
    const rows = loadLedger();
    localStorage.removeItem('hv-night-ledger');
    ledgerCache = null;
    G.structures.clinic = false; G.care = 40; G.june = 0;
    const real = Math.random;
    Math.random = () => 0.5;
    onNewDay();
    Math.random = real;
    return { names: rows.map(e => e.name).join(','), wrote: localStorage.getItem('hv-night-ledger') };
  });
  ok(broken.names === 'Inez,Malik,Rosa' && broken.wrote === null,
    'a broken board is replaced by the neighbors, and a dawn with the tarp down does not write one');

  const sound = await t(() => {
    initAudio();
    let starts = 0;
    const orig = audioCtx.createOscillator.bind(audioCtx);
    audioCtx.createOscillator = function () {
      const o = orig();
      const start = o.start.bind(o);
      o.start = function () { starts++; return start.apply(o, arguments); };
      return o;
    };
    sfx('dress');
    juice('heal');
    const flash = document.getElementById('hud').classList.contains('flash-heal');
    juice('hurt');
    const hurt = document.getElementById('hud').classList.contains('flash-hurt');
    return { starts, flash, hurt };
  });
  ok(sound.starts === 3 && sound.flash && sound.hurt,
    `a dressing chime is three notes, and juice flashes the camp (${sound.starts} oscillators)`);

  await ctx.close();

  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mp = await phone.newPage();
  mp.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 180)));
  await mp.addInitScript(() => localStorage.setItem('hv-intro-seen', '1'));
  await mp.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await mp.waitForFunction(() => typeof player !== 'undefined');
  await mp.waitForTimeout(400);
  const before = await mp.evaluate(() => player.position.x);
  const right = mp.locator('#walk-right');
  await right.dispatchEvent('pointerdown', { pointerId: 1, bubbles: true });
  await mp.waitForTimeout(450);
  await right.dispatchEvent('pointerup', { pointerId: 1, bubbles: true });
  const moved = await mp.evaluate(() => player.position.x);
  const pad = await mp.evaluate(() => {
    function box(id) {
      const el = document.getElementById(id);
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        h: Math.round(r.height), w: Math.round(r.width),
        on: cs.display !== 'none' && r.width > 8,
        in: r.top >= -1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1,
      };
    }
    return { up: box('walk-up'), right: box('walk-right'), toggle: box('craft-toggle') };
  });
  ok(moved > before + 0.4 && pad.right.on && pad.right.h >= 44 && pad.right.in && pad.up.in && pad.toggle.in,
    `the pad walks and stays on screen (${before.toFixed(2)} → ${moved.toFixed(2)}, button ${pad.right.h}px)`);

  const dock = await mp.evaluate(() => {
    G.structures.workbench = true; G.wood = 20; G.scraps = 20; G.cardboard = 10; G.goodwill = 20;
    G.goalIndex = GOALS.length; G.june = 1; G.bandages = 2; G.days = 4; G.clinicAsk = { day: 4 };
    G.activeCrafts.clinic = { start: Date.now() - 50, duration: 1 };
    finishCraft(RECIPES.find(r => r.id === 'clinic'));
    buildActionUI();
    function info(id) {
      const el = document.getElementById(id);
      if (!el) return { missing: true };
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        parent: el.parentElement.id,
        h: Math.round(r.height),
        in: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
        owns: !!hit && (hit === el || el.contains(hit)),
      };
    }
    const pad = document.getElementById('walk-pad').getBoundingClientRect();
    const dress = document.getElementById('action-dress').getBoundingClientRect();
    const overlap = Math.min(pad.right, dress.right) - Math.max(pad.left, dress.left) > 2
      && Math.min(pad.bottom, dress.bottom) - Math.max(pad.top, dress.top) > 2;
    return {
      dress: info('action-dress'),
      ledger: info('action-ledger'),
      spare: info('action-spare'),
      overlap,
    };
  });
  ok(dock.dress.parent === 'clinic-dock' && dock.ledger.parent === 'clinic-dock' && dock.spare.parent === 'clinic-dock'
    && dock.dress.h >= 44 && dock.dress.in && dock.dress.owns && dock.ledger.owns && !dock.overlap,
    `clinic actions sit in the phone dock and own their centres (${JSON.stringify(dock)})`);

  await mp.locator('#action-ledger').click();
  const modal = await mp.evaluate(() => {
    const m = document.getElementById('ledger-modal');
    const text = document.getElementById('ledger-challenge').textContent;
    const open = m.classList.contains('open');
    const sign = document.getElementById('ledger-sign').getBoundingClientRect();
    return { open, text, signH: Math.round(sign.height), walking: overlayOpen() };
  });
  ok(modal.open && /Malik/.test(modal.text) && modal.signH >= 44 && modal.walking,
    `the ledger opens on the phone and holds the player still (${modal.text})`);
  await phone.close();

  const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const dp = await desk.newPage();
  dp.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 180)));
  await dp.addInitScript(() => localStorage.setItem('hv-intro-seen', '1'));
  await dp.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await dp.waitForFunction(() => typeof finishCraft === 'function');
  const wide = await dp.evaluate(() => {
    G.goalIndex = GOALS.length;
    G.activeCrafts.clinic = { start: Date.now() - 50, duration: 1 };
    finishCraft(RECIPES.find(r => r.id === 'clinic'));
    const dress = document.getElementById('action-dress');
    const pad = getComputedStyle(document.getElementById('walk-pad')).display;
    return { parent: dress.parentElement.id, pad };
  });
  ok(wide.parent === 'action-list' && wide.pad === 'none',
    `on a wide screen Dress stays on the rail and the pad is hidden (${wide.parent}, pad ${wide.pad})`);

  ok(errs.length === 0, 'no page errors' + (errs.length ? ' — ' + errs.join(' | ') : ''));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
