/* VOX-23 — the Cloud Wager (one-shot, classic-script globals).
 * A. Constants 30 / 60 / 90; Cloud Reader registered; the how-to
 *    bullet is in; the chip hides without a vane.
 * B. No vane: placing refuses; with the vane the chip shows and a
 *    funded bet takes exactly 30 with the clock riding.
 * C. Rain already falling takes no bet; a second bet is refused while
 *    one rides.
 * D. Rain inside the window pays exactly +60 and the win tally ticks.
 * E. A dry 90 seconds blows the stake away — the loss tally ticks, no
 *    payout.
 * F. Six wins crown Cloud Reader; the tallies ride the whole-state
 *    save; a legacy save migrates clean.
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
    if (!sessionStorage.getItem('voxcloud-init')) {
      sessionStorage.setItem('voxcloud-init', '1');
      localStorage.removeItem('voxel-garden-v1');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A
  const fresh = await t(() => {
    state.buildings = state.buildings || {};
    delete state.buildings.vane;
    refreshCloudHud();
    return { c: { stake: CLOUD_STAKE, pay: CLOUD_PAY, secs: CLOUD_SECS },
      ach: ACH.some(a => a[0] === 'cloud6'),
      howto: document.body.innerHTML.includes('Cloud Wager</b>'),
      hidden: document.getElementById('cloudHud').style.display === 'none' };
  });
  ok(fresh.c.stake === 30 && fresh.c.pay === 60 && fresh.c.secs === 90 && fresh.ach && fresh.howto,
    '30 / 60 / 90 on the slate; Cloud Reader registered; the how-to bullet is in');
  ok(fresh.hidden, 'the chip hides without a vane');

  // B — the vane gates it
  const placed = await t(() => {
    state.coins = 500; rainActive = false; cloudBet = null;
    placeCloudBet();
    const refused = !cloudBet && state.coins === 500;
    state.buildings.vane = { x: 4, z: 4 };
    refreshCloudHud();
    const shown = document.getElementById('cloudHud').style.display !== 'none';
    placeCloudBet();
    return { refused, shown, bet: cloudBet ? cloudBet.timeLeft : null, coins: state.coins,
      lbl: document.getElementById('cloudTxt').textContent };
  });
  ok(placed.refused, 'no vane — placing refuses');
  ok(placed.shown && placed.bet === 90 && placed.coins === 470 && placed.lbl.includes('rain in'),
    'with the vane a funded bet takes exactly 30 and the clock rides');

  // C — no bet on falling rain; one at a time
  const gated = await t(() => {
    placeCloudBet();
    const doubled = state.coins;
    cloudBet = null; rainActive = true; state.coins = 500;
    placeCloudBet();
    const rainy = { bet: !!cloudBet, coins: state.coins };
    rainActive = false;
    return { doubled, rainy };
  });
  ok(gated.doubled === 470, 'a second bet is refused while one rides');
  ok(!gated.rainy.bet && gated.rainy.coins === 500, 'rain already falling takes no bet');

  // D — rain inside the window
  const won = await t(() => {
    state.coins = 500; state.cloudWins = 0; cloudBet = { timeLeft: 40 };
    rainActive = true;
    updateCloudBet(0.05);
    const out = { coins: state.coins, wins: state.cloudWins, bet: cloudBet };
    rainActive = false;
    return out;
  });
  ok(won.coins === 560 && won.wins === 1 && !won.bet,
    'rain inside the window pays exactly +60 and the tally ticks');

  // E — the dry window
  const lost = await t(() => {
    state.coins = 500; state.cloudLosses = 0; cloudBet = { timeLeft: 0.01 };
    rainActive = false;
    updateCloudBet(0.02);
    return { coins: state.coins, losses: state.cloudLosses, bet: cloudBet };
  });
  ok(lost.coins === 500 && lost.losses === 1 && !lost.bet,
    'a dry 90 seconds blows the stake away');

  // F — the crown + persistence
  const crowned = await t(() => {
    state.cloudWins = 6;
    return ACH.find(a => a[0] === 'cloud6')[3]();
  });
  ok(crowned, 'six wins crown Cloud Reader');
  await t(() => save());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const back = await t(() => ({ wins: state.cloudWins, losses: state.cloudLosses }));
  ok(back.wins === 6 && back.losses === 1, 'the tallies ride the save');
  await t(() => {
    const sv = JSON.parse(localStorage.getItem('voxel-garden-v1'));
    delete sv.state.cloudWins; delete sv.state.cloudLosses;
    localStorage.setItem('voxel-garden-v1', JSON.stringify(sv));
    localStorage.setItem = () => {};
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const legacy = await t(() => ({ wins: state.cloudWins || 0, losses: state.cloudLosses || 0 }));
  ok(legacy.wins === 0 && legacy.losses === 0, 'a pre-VOX-23 save migrates clean');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
