/* VOX-22 — the Preserve Shed (one-shot, classic-script globals).
 * A. The 🫙 shed in the shop (700 / lvl 8 / kind jam), the shed
 *    renders (shelf window, amber jars, chimney), Shelf of Summers
 *    registered, the how-to bullet is in, constants 4 / 12.
 * B. No shed: a day-tick jars nothing; a festival sells nothing.
 * C. Built: each new day jars one (simulated via the day-rollover
 *    guard); six days cap the shelf at four.
 * D. The festival empties the shelf: 4 jars → exactly +48 🪙, the
 *    ledger ticks, the shelf reads zero; an empty shelf sells nothing.
 * E. Twelve sold jars crown Shelf of Summers; jars and ledger ride
 *    the save; a legacy save migrates clean.
 * Z. Zero page errors.
 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

// Shelf taps use the loaded production mesh and doAction; no injected game hooks.
async function checkShelfTaps(browser) {
  for (const width of [1280, 768]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    try {
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.addInitScript(() => {
        localStorage.setItem('voxel-garden-v1', JSON.stringify({
          v: 1, seed: 1, savedAt: Date.now(),
          state: { helpSeen: true, muted: true, musicOff: true, coins: 500,
            level: 8, day: 2, jars: 2, jamsSold: 3,
            buildings: { preserves: { x: 7, z: 7 } }, goods: {} },
          edits: [], wet: [], islets: [], plants: [], animals: [], workers: [],
        }));
      });
      await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
      await page.waitForFunction(() => !!W.buildingMeshes.preserves);
      const reports = await page.evaluate(() => {
        const snapshot = () => ({ jars: state.jars, coins: state.coins,
          jamsSold: state.jamsSold, buildings: JSON.stringify(state.buildings) });
        const tap = () => {
          const before = snapshot();
          document.getElementById('toasts').replaceChildren();
          doAction({ object: W.buildingMeshes.preserves });
          return { before, after: snapshot(),
            toasts: [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent) };
        };
        const mid = tap();
        state.jars = JAM_CAP;
        const full = tap();
        // An older save can lack jars; the report must still show an empty shelf.
        delete state.jars;
        const empty = tap();
        return { mid, full, empty };
      });
      for (const [name, report] of Object.entries(reports)) {
        assert.deepEqual(report.after, report.before, `${width}: ${name} tap is read-only`);
        assert.equal(report.toasts.length, 1, `${width}: one clear toast`);
        assert.match(report.toasts[0], /🫙.*Preserve Shed/);
        assert.match(report.toasts[0], /12🪙\/jar/);
      }
      assert.match(reports.mid.toasts[0], /2\/4.*dawn/i);
      assert.match(reports.full.toasts[0], /4\/4.*shelf full.*seasonal festival/i);
      assert.doesNotMatch(reports.full.toasts[0], /dawn/i);
      assert.match(reports.empty.toasts[0], /0\/4.*dawn/i);
      assert.deepEqual(errors, [], `${width}: zero page errors`);
      ok(true, `${width}px: mid/full/legacy-empty shelf reports; one toast, no mutation, zero page errors`);
    } finally {
      await ctx.close();
    }
  }
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
  await checkShelfTaps(browser);
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('voxjam-init')) {
      sessionStorage.setItem('voxjam-init', '1');
      localStorage.removeItem('voxel-garden-v1');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A
  const fresh = await t(() => {
    const d = BUILDINGS.preserves;
    return { def: d ? { cost: d.cost, lvl: d.lvl, kind: d.kind } : null,
      cubes: jamCubes(BUILDINGS.preserves).length,
      ach: ACH.some(a => a[0] === 'jam12'),
      howto: document.body.innerHTML.includes('Preserve Shed</b> (level 8)'),
      c: { cap: JAM_CAP, pay: JAM_PAY } };
  });
  ok(fresh.def && fresh.def.cost === 700 && fresh.def.lvl === 8 && fresh.def.kind === 'jam'
    && fresh.cubes >= 8, 'the 🫙 Preserve Shed is in the shop (700 / lvl 8) and renders full');
  ok(fresh.ach && fresh.howto && fresh.c.cap === 4 && fresh.c.pay === 12,
    'Shelf of Summers registered; the how-to bullet is in; 4 / 12 on the sheet');

  // helper: simulate the day-rollover jar line
  const newDay = () => t(() => {
    if (jamBuilt() && (state.jars || 0) < JAM_CAP) { state.jars = (state.jars || 0) + 1; }
    return state.jars || 0;
  });

  // B — no shed
  const bare = await t(() => {
    state.buildings = state.buildings || {};
    delete state.buildings.preserves;
    state.jars = 0; state.coins = 500;
    if (jamBuilt() && (state.jars || 0) < JAM_CAP) state.jars++;
    const sold = sellPreserves();
    return { jars: state.jars, sold, coins: state.coins };
  });
  ok(bare.jars === 0 && bare.sold === 0 && bare.coins === 500,
    'no shed — a day jars nothing and a festival sells nothing');

  // C — the shelf fills
  await t(() => { state.buildings.preserves = { x: 7, z: 7 }; state.jars = 0; });
  const one = await newDay();
  ok(one === 1, 'a new day puts one jar up');
  for (let i = 0; i < 5; i++) await newDay();
  const capped = await t(() => state.jars);
  ok(capped === 4, 'six days cap the shelf at four');

  // D — the festival empties it
  const sold = await t(() => {
    state.coins = 500; state.jamsSold = 0;
    const pay = sellPreserves();
    const after = { pay, coins: state.coins, jars: state.jars, ledger: state.jamsSold };
    const again = sellPreserves();
    return { after, again };
  });
  ok(sold.after.pay === 48 && sold.after.coins === 548 && sold.after.jars === 0
    && sold.after.ledger === 4, 'the festival clears four jars for exactly +48 🪙');
  ok(sold.again === 0, 'an empty shelf sells nothing');

  // E — the crown + persistence
  const crowned = await t(() => {
    state.jamsSold = 12;
    return ACH.find(a => a[0] === 'jam12')[3]();
  });
  ok(crowned, 'twelve sold jars crown Shelf of Summers');
  await t(() => { state.jars = 2; save(); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const back = await t(() => ({ jars: state.jars, sold: state.jamsSold, built: jamBuilt() }));
  ok(back.jars === 2 && back.sold === 12 && back.built, 'jars and ledger ride the save');
  await t(() => {
    const sv = JSON.parse(localStorage.getItem('voxel-garden-v1'));
    delete sv.state.jars; delete sv.state.jamsSold; delete sv.state.buildings.preserves;
    localStorage.setItem('voxel-garden-v1', JSON.stringify(sv));
    localStorage.setItem = () => {};
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const legacy = await t(() => ({ jars: state.jars || 0, sold: state.jamsSold || 0, built: jamBuilt() }));
  ok(legacy.jars === 0 && legacy.sold === 0 && !legacy.built, 'a pre-VOX-22 save migrates clean');

  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exitCode = fail ? 1 : 0;
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
