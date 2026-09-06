/* VOX-24 — the Assessor's Policy (one-shot, classic-script globals).
 * A. Constants 25 / 50; Acts of Crow registered; the how-to bullet
 *    is in; the chip quotes the premium.
 * B. Buying costs exactly 25 and covers the fields; a second buy is
 *    refused; short coins refuse.
 * C. A REAL crow peck (addPlant → spawnCrow → sit out the clock)
 *    files the claim: exactly +50, the tally ticks, the cover clears.
 * D. An uninsured peck pays nothing.
 * E. A quiet day lapses the policy at the real dawn rollover.
 * F. Four claims crown Acts of Crow; the ledger rides the whole-state
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
    if (!sessionStorage.getItem('voxpolicy-init')) {
      sessionStorage.setItem('voxpolicy-init', '1');
      localStorage.removeItem('voxel-garden-v1');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A
  const fresh = await t(() => ({
    c: { cost: POLICY_COST, pay: POLICY_PAY },
    ach: ACH.some(a => a[0] === 'policy4'),
    howto: document.body.innerHTML.includes("Assessor's Policy</b>"),
    chip: document.getElementById('polTxt').textContent.includes('25'),
  }));
  ok(fresh.c.cost === 25 && fresh.c.pay === 50 && fresh.ach && fresh.howto,
    '25 against 50 on the slate; Acts of Crow registered; the how-to bullet is in');
  ok(fresh.chip, 'the chip quotes the premium');

  // B — buying the cover
  const bought = await t(() => {
    state.coins = 500; state.cropPolicy = false;
    buyCropPolicy();
    const one = { coins: state.coins, on: state.cropPolicy,
      chip: document.getElementById('polTxt').textContent };
    buyCropPolicy();
    const two = { coins: state.coins };
    state.cropPolicy = false; state.coins = 5;
    buyCropPolicy();
    return { one, two, broke: { coins: state.coins, on: state.cropPolicy } };
  });
  ok(bought.one.coins === 475 && bought.one.on && bought.one.chip.includes('covered'),
    'buying costs exactly 25 and covers the fields');
  ok(bought.two.coins === 475, 'a second buy is refused while covered');
  ok(bought.broke.coins === 5 && !bought.broke.on, 'short coins refuse');

  // C — a REAL peck files the claim
  const claimed = await t(() => {
    for (const p of [...W.plants.values()]) removePlant(p);
    const p = addPlant(20, 8, 20, 'carrot');
    p.prog = PLANTS.carrot.grow * 0.5; p.stage = 1;
    state.cropPolicy = true; state.policyClaims = 0; state.coins = 500;
    spawnCrow();
    const landed = !!crow && crow.p === p;
    crow.t = 17.9;
    updateCrow(0.2);
    return { landed, coins: state.coins, claims: state.policyClaims,
      on: state.cropPolicy };
  });
  ok(claimed.landed, 'the crow lands on the only crop');
  ok(claimed.coins === 550 && claimed.claims === 1 && !claimed.on,
    'the landed peck files the claim — exactly +50, the cover clears');

  // D — the uninsured peck
  const raw = await t(() => {
    updateCrow(3);   // finish the flee
    const p = [...W.plants.values()][0];
    p.prog = PLANTS.carrot.grow * 0.5; p.stage = 1;
    state.coins = 500;
    spawnCrow();
    if (crow) { crow.t = 17.9; updateCrow(0.2); }
    return { coins: state.coins, claims: state.policyClaims };
  });
  ok(raw.coins === 500 && raw.claims === 1, 'an uninsured peck pays nothing');

  // E — the quiet day lapses at the real dawn
  await t(() => {
    state.cropPolicy = true; state.policyLapsed = 0;
    state.time = CYCLE - 0.05;
  });
  await page.waitForTimeout(800);
  const lapsed = await t(() => ({ on: state.cropPolicy, lapsed: state.policyLapsed }));
  ok(!lapsed.on && lapsed.lapsed === 1, 'a quiet day lapses the policy at dawn');

  // F — the crown + persistence
  const crowned = await t(() => {
    state.policyClaims = 4;
    return ACH.find(a => a[0] === 'policy4')[3]();
  });
  ok(crowned, 'four claims crown Acts of Crow');
  await t(() => { state.cropPolicy = true; save(); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const back = await t(() => ({ on: state.cropPolicy, claims: state.policyClaims, lapsed: state.policyLapsed }));
  ok(back.on === true && back.claims === 4 && back.lapsed === 1,
    'the cover and the ledger ride the save');
  await t(() => {
    const sv = JSON.parse(localStorage.getItem('voxel-garden-v1'));
    delete sv.state.cropPolicy; delete sv.state.policyClaims; delete sv.state.policyLapsed;
    localStorage.setItem('voxel-garden-v1', JSON.stringify(sv));
    localStorage.setItem = () => {};
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const legacy = await t(() => ({ on: !!state.cropPolicy, claims: state.policyClaims || 0 }));
  ok(legacy.on === false && legacy.claims === 0, 'a pre-VOX-24 save migrates clean');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
