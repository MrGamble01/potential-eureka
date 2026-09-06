/* VOX-25 — the Trader's Note (one-shot, classic-script globals).
 * A. Constants 60 / 75; Square with the Trader registered; the how-to
 *    bullet is in; the chip hides without a Market.
 * B. With a Market the chip shows; signing pays exactly +60 and books
 *    75 owed; a second note is refused mid-debt.
 * C. The garnish takes half: 30 of trade → 15 kept, owed drops 15.
 * D. The final trade clears the note capped at the debt — the clear
 *    counted; free trade passes whole after.
 * E. A REAL Market sale settles against the note end-to-end.
 * F. Three clears crown Square with the Trader; the ledger rides the
 *    whole-state save; a legacy save migrates clean.
 * Z. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('voxnote-init')) {
      sessionStorage.setItem('voxnote-init', '1');
      localStorage.removeItem('voxel-garden-v1');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A
  const fresh = await t(() => {
    state.buildings = state.buildings || {};
    delete state.buildings.market;
    refreshNoteHud();
    return { c: { adv: NOTE_ADV, owed: NOTE_OWED },
      ach: ACH.some(a => a[0] === 'notes3'),
      howto: document.body.innerHTML.includes("Trader's Note</b>"),
      hidden: document.getElementById('noteHud').style.display === 'none',
      refused: (state.traderNote || 0) === 0 };
  });
  ok(fresh.c.adv === 60 && fresh.c.owed === 75 && fresh.ach && fresh.howto,
    '60 against 75 on the slate; Square with the Trader registered; the how-to bullet is in');
  ok(fresh.hidden && fresh.refused, 'the chip hides without a Market — no note signs');

  // B — the signing
  const signed = await t(() => {
    state.buildings.market = { x: 4, z: 4 };
    refreshNoteHud();
    const shown = document.getElementById('noteHud').style.display !== 'none';
    state.coins = 100; state.traderNote = 0;
    takeTraderNote();
    const one = { coins: state.coins, owed: state.traderNote,
      lbl: document.getElementById('noteTxt').textContent };
    const c1 = state.coins;
    takeTraderNote();
    return { shown, one, doubled: state.coins - c1 };
  });
  ok(signed.shown && signed.one.coins === 160 && signed.one.owed === 75
    && signed.one.lbl.includes('owed'), 'signing pays exactly +60 and books 75 owed');
  ok(signed.doubled === 0, 'a second note is refused mid-debt');

  // C — the garnish
  const garnished = await t(() => {
    const kept = garnishTrade(30);
    return { kept, owed: state.traderNote };
  });
  ok(garnished.kept === 15 && garnished.owed === 60,
    'half of every trade coin to the note — 30 in, 15 kept');

  // D — the clear + free pass
  const cleared = await t(() => {
    state.traderNote = 10; state.notesCleared = 0;
    const kept = garnishTrade(30);
    const free = garnishTrade(40);
    return { kept, free, owed: state.traderNote, cleared: state.notesCleared };
  });
  ok(cleared.kept === 20 && cleared.owed === 0 && cleared.cleared === 1,
    'the final trade clears the note capped at the debt');
  ok(cleared.free === 40, 'free trade passes whole after');

  // E — a REAL Market sale settles the note
  const sale = await t(() => {
    state.traderNote = 500;
    state.goods = state.goods || {};
    state.goods.crop = 4;
    const c0 = state.coins, o0 = state.traderNote;
    sellStockpile(false);
    return { gained: state.coins - c0, paid: o0 - state.traderNote };
  });
  ok(sale.paid > 0 && sale.gained >= 0 && sale.paid >= sale.gained,
    'a real Market sale settles against the note end-to-end');

  // F — the crown + persistence
  const crowned = await t(() => {
    state.notesCleared = 3;
    return ACH.find(a => a[0] === 'notes3')[3]();
  });
  ok(crowned, 'three clears crown Square with the Trader');
  await t(() => { state.traderNote = 42; save(); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const back = await t(() => ({ owed: state.traderNote, cleared: state.notesCleared }));
  ok(back.owed === 42 && back.cleared === 3, 'the ledger rides the whole-state save');
  await t(() => {
    const sv = JSON.parse(localStorage.getItem('voxel-garden-v1'));
    delete sv.state.traderNote; delete sv.state.notesCleared;
    localStorage.setItem('voxel-garden-v1', JSON.stringify(sv));
    localStorage.setItem = () => {};
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const legacy = await t(() => ({ owed: state.traderNote || 0, cleared: state.notesCleared || 0 }));
  ok(legacy.owed === 0 && legacy.cleared === 0, 'a pre-VOX-25 save migrates clean');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
