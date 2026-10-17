/* Storm tide, the Storm Shelf, and the harbor gull.
 * Hook-free: the page's own functions and real clicks.
 *
 * A. A high-level garden does not raise the shelf or pay the purse
 *    just by loading, and the tide does not start itself.
 * B. Level 6 cannot call the tide. Level 7 can. A timeout pays nothing.
 * C. Holding five stakes with stone pays once, raises the shelf, and
 *    a second tide does not pay again. The shelf survives reload.
 * D. The gull's advice is local and names the next stake.
 * E. Desktop keeps Town and Help clear. The phone chip does too.
 * Z. Zero page errors.
 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(() => {
      if (sessionStorage.getItem('voxstorm-init')) return;
      sessionStorage.setItem('voxstorm-init', '1');
      localStorage.setItem('voxel-garden-v1', JSON.stringify({
        v: 1, seed: 7, savedAt: Date.now(),
        state: {
          helpSeen: true, muted: true, musicOff: true,
          coins: 5000, level: 13, xp: 99999, questIdx: 99,
          buildings: {}, goods: {},
          request: { key: 'earn', goal: 1e12, text: 'hold', reward: 1 },
        },
        edits: [], wet: [], islets: [], plants: [], animals: [], workers: [],
      }));
    });
    await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
    await page.waitForFunction(() => typeof startStormTide === 'function' && typeof gullAdvice === 'function');

    const boot = await page.evaluate(() => {
      const before = state.coins;
      updateStorm(40);
      const shelf = ISLETS.find(it => it.biome === 'storm');
      return {
        before, after: state.coins, paid: !!state.storm.paid, phase: state.storm.phase,
        risen: W.islets.includes(shelf.id), level: STORM_LEVEL, pay: STORM_PAY, need: STORM_NEED,
        buyable: !!nextIslet() && nextIslet().biome !== 'storm',
      };
    });
    assert.equal(boot.after, boot.before);
    assert.equal(boot.paid, false);
    assert.equal(boot.phase, 'idle');
    assert.equal(boot.risen, false);
    assert.equal(boot.level, 7);
    assert.equal(boot.pay, 64);
    assert.equal(boot.need, 5);
    assert.equal(boot.buyable, true);
    console.log('PASS loading and a long idle tick do not raise the shelf or pay');

    const gated = await page.evaluate(() => {
      state.level = 6;
      const before = state.coins;
      const started = startStormTide();
      const advice = gullAdvice();
      return { started, before, after: state.coins, phase: state.storm.phase, act: advice.act, text: advice.text };
    });
    assert.equal(gated.started, false);
    assert.equal(gated.after, gated.before);
    assert.equal(gated.phase, 'idle');
    assert.equal(gated.act, 'locked');
    assert.match(gated.text, /level 7/);
    console.log('PASS level 6 cannot call the tide');

    const opened = await page.evaluate(() => {
      state.level = 8;
      refreshStormHud();
      const advice = gullAdvice();
      return { act: advice.act, text: advice.text, line: document.getElementById('qGull').textContent };
    });
    assert.equal(opened.act, 'call');
    assert.match(opened.text, /Storm Shelf/);
    assert.match(opened.text, /stone or sea glass/);
    assert.match(opened.line, /Call the tide/);
    await page.click('#qGull');
    const sheet = await page.evaluate(() => {
      const p = document.getElementById('gullPanel');
      return { open: p.classList.contains('open'), text: p.innerText };
    });
    assert.equal(sheet.open, true);
    assert.match(sheet.text, /Harbor gull/);
    assert.match(sheet.text, /Call the tide/);
    assert.match(sheet.text, /Nothing is sent away/);
    const nav = await page.evaluate(() => {
      const hit = (id) => {
        const el = document.getElementById(id);
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!(top && (top === el || el.contains(top)));
      };
      const chip = document.getElementById('gullChip');
      return {
        town: hit('townBtn'), help: hit('helpBtn'),
        chip: getComputedStyle(chip).display,
      };
    });
    assert.equal(nav.town, true);
    assert.equal(nav.help, true);
    assert.equal(nav.chip, 'none');
    console.log('PASS the gull panel is local, and Town and Help stay tappable');

    const missed = await page.evaluate(() => {
      document.getElementById('gullPanel').classList.remove('open');
      document.body.classList.remove('panel-open');
      const before = state.coins;
      const started = startStormTide();
      const warn = state.storm.phase;
      const stakes = stormStakes.map(c => c.slice());
      updateStorm(STORM_WARN + 0.2);
      const surged = state.storm.phase;
      const advice = gullAdvice();
      updateStorm(STORM_SECS + 1);
      return {
        started, warn, surged, stakes: stakes.length,
        advice: advice.text,
        phase: state.storm.phase, paid: !!state.storm.paid,
        risen: stormRaised(), before, after: state.coins,
      };
    });
    assert.equal(missed.started, true);
    assert.equal(missed.warn, 'warn');
    assert.equal(missed.surged, 'surge');
    assert.equal(missed.stakes, 5);
    assert.match(missed.advice, /stone or sea glass/);
    assert.match(missed.advice, /-?\d+, -?\d+/);
    assert.equal(missed.phase, 'idle');
    assert.equal(missed.paid, false);
    assert.equal(missed.risen, false);
    assert.equal(missed.after, missed.before);
    console.log('PASS a tide that is not held pays nothing and leaves the shelf down');

    const held = await page.evaluate(() => {
      state.blockSel = 3;
      state.buildMode = 'single';
      const before = state.coins;
      const started = startStormTide();
      updateStorm(STORM_WARN + 0.2);
      const stakes = stormStakes.map(c => c.slice());
      let placed = 0;
      for (const [x, y, z] of stakes) placed += placeSelected(x, y, z) ? 1 : 0;
      const shelf = stormShelf();
      let stone = 0, sand = 0, glass = 0, water = 0;
      for (const [key, id] of W.blocks) {
        const [x, , z] = key.split(',').map(Number);
        if (Math.hypot(x - shelf.x, z - shelf.z) > shelf.r + 2) continue;
        if (id === 3) stone++;
        if (id === 4) sand++;
        if (id === 12) glass++;
      }
      water = (W.pondCells || []).filter(c => Math.hypot(c[0] - shelf.x, c[1] - shelf.z) < shelf.r + 3 && c[2] != null).length;
      return {
        started, placed, stakes: stakes.length,
        paid: !!state.storm.paid, phase: state.storm.phase, risen: stormRaised(),
        before, after: state.coins, stoneCost: BLOCKS[3].cost,
        stone, sand, glass, water,
        flash: document.getElementById('juiceFlash').className.indexOf('tide') >= 0,
        shake: juice.t > 0,
      };
    });
    assert.equal(held.started, true);
    assert.equal(held.placed, 5);
    assert.equal(held.paid, true);
    assert.equal(held.phase, 'idle');
    assert.equal(held.risen, true);
    assert.equal(held.after, held.before - held.stoneCost * 5 + 64);
    assert.ok(held.stone > 12, 'shelf is stone, saw ' + held.stone);
    assert.ok(held.sand > 4, 'shelf has a sand rim, saw ' + held.sand);
    assert.ok(held.glass >= 4, 'shelf carries sea glass, saw ' + held.glass);
    assert.ok(held.water > 0, 'shelf pool has its own water line');
    assert.equal(held.flash, true);
    assert.equal(held.shake, true);
    console.log('PASS holding the stakes pays once and raises the Storm Shelf');

    const keptCoins = await page.evaluate(() => {
      save();
      return state.coins;
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => typeof stormRaised === 'function' && stormRaised());
    const kept = await page.evaluate(() => ({
      paid: !!state.storm.paid, phase: state.storm.phase, risen: stormRaised(), coins: state.coins,
    }));
    assert.equal(kept.paid, true);
    assert.equal(kept.phase, 'idle');
    assert.equal(kept.risen, true);
    assert.equal(kept.coins, keptCoins);
    console.log('PASS the shelf and the purse survive a reload without paying again');

    const again = await page.evaluate(() => {
      state.blockSel = 3;
      state.buildMode = 'single';
      const before = state.coins;
      const started = startStormTide();
      updateStorm(STORM_WARN + 0.2);
      let placed = 0;
      for (const [x, y, z] of stormStakes) placed += placeSelected(x, y, z) ? 1 : 0;
      return { started, placed, before, after: state.coins, paid: !!state.storm.paid, risen: stormRaised() };
    });
    assert.equal(again.started, true);
    assert.equal(again.placed, 5);
    assert.equal(again.paid, true);
    assert.equal(again.risen, true);
    assert.equal(again.after, again.before - 3 * 5);
    console.log('PASS a second tide does not pay the purse again');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    const phone = await page.evaluate(() => {
      refreshStormHud();
      const hit = (id) => {
        const el = document.getElementById(id);
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!(top && (top === el || el.contains(top)));
      };
      const gull = document.getElementById('gullChip').getBoundingClientRect();
      const coin = document.getElementById('coinChip').getBoundingClientRect();
      const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      return {
        town: hit('townBtn'), help: hit('helpBtn'), gull: hit('gullChip'),
        line: document.getElementById('gullTxt').textContent,
        overlap: overlaps(gull, coin),
        shown: getComputedStyle(document.getElementById('gullChip')).display !== 'none',
      };
    });
    assert.equal(phone.town, true);
    assert.equal(phone.help, true);
    assert.equal(phone.gull, true);
    assert.equal(phone.shown, true);
    assert.equal(phone.overlap, false);
    assert.match(phone.line, /Shelf held/);
    assert.deepEqual(errors, []);
    console.log('PASS the phone gull chip stays clear of the purse, Town, and Help');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
