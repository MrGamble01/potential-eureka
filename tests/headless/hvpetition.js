/* HV-15 — City Petitions (one-shot, classic-script globals).
 * A. Fresh camp: no petitions won, board hidden below Respected; the
 *    petition goal is on the ladder.
 * B. Below 50 rep the city won't read a petition.
 * C. At Respected the board renders in the Community panel, live.
 * D. A broke petition is refused; a funded one pays exactly, wins the
 *    row (+2 rep) and re-renders it checked; double-buys are inert.
 * E. The grant delivers +8 food / wood / scraps once.
 * F. The sanitation unit adds +1 health at dawn.
 * G. Under the street light, thieves take exactly half (pinned rolls).
 * H. The petitions map rides the save; legacy saves migrate clean.
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
    if (!sessionStorage.getItem('hvpetition-init')) {
      sessionStorage.setItem('hvpetition-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = fn => page.evaluate(fn);

  // A
  const fresh = await t(() => {
    G.goalIndex = GOALS.length;   // park the ladder
    buildWorkersUI();
    return { n: Object.keys(G.petitions).length, avail: petitionsAvailable(),
      board: [...document.querySelectorAll('#workers-list .w-name')].some(e => /City petitions/.test(e.textContent)),
      goal: GOALS.some(g => g.id === 'petition1') };
  });
  ok(fresh.n === 0 && !fresh.avail && !fresh.board, 'fresh camp: nothing won, the board stays hidden');
  ok(fresh.goal, 'the petition goal is on the ladder');

  // B — the rep gate
  const gated = await t(() => {
    G.goodwill = 50;
    doPetition('sanitation');
    return { n: Object.keys(G.petitions).length, goodwill: G.goodwill };
  });
  ok(gated.n === 0 && gated.goodwill === 50, 'below 50 rep the city won\'t read a petition');

  // C — the board renders
  const board = await t(() => {
    G.rep = 50;
    buildWorkersUI();
    const rows = [...document.querySelectorAll('#workers-list .worker-row')];
    return { head: rows.some(r => /City petitions/.test(r.textContent)),
      buttons: rows.filter(r => r.querySelector('.w-hire') && /🩶/.test(r.textContent)).length };
  });
  ok(board.head && board.buttons >= 3, 'at Respected the board renders with three live petitions');

  // D — broke, then funded
  const won = await t(() => {
    G.goodwill = 14;
    doPetition('sanitation');
    const refused = !G.petitions.sanitation && G.goodwill === 14;
    G.goodwill = 15;
    const rep0 = G.rep;
    doPetition('sanitation');
    const rows = [...document.querySelectorAll('#workers-list .worker-row')];
    const checked = rows.some(r => /Sanitation unit/.test(r.textContent) && /won ✓/.test(r.textContent));
    doPetition('sanitation');   // double-buy is inert
    return { refused, won: !!G.petitions.sanitation, goodwill: G.goodwill,
      rep: G.rep - rep0, checked };
  });
  ok(won.refused, 'a broke petition is refused');
  ok(won.won && won.goodwill === 0 && won.rep === 2 && won.checked,
    'a funded petition pays exactly, earns +2 rep and re-renders checked');

  // E — the grant
  const granted = await t(() => {
    G.goodwill = 30; G.food = 0; G.wood = 0; G.scraps = 0;
    doPetition('grant');
    const first = { food: G.food, wood: G.wood, scraps: G.scraps, goodwill: G.goodwill };
    G.goodwill = 30;
    doPetition('grant');
    return { first, again: G.food };
  });
  ok(granted.first.food === 8 && granted.first.wood === 8 && granted.first.scraps === 8
    && granted.first.goodwill === 0 && granted.again === 8,
    'the grant delivers +8 food / wood / scraps exactly once');

  // F — the sanitation unit at dawn
  const dawn = await t(() => {
    const real = Math.random; Math.random = () => 0.99;
    G.health = 50; G.food = 60; G.warmth = 80; G.weather = 'clear';
    G.lastEventDay = G.days;
    onNewDay();
    Math.random = real;
    return { health: G.health };
  });
  ok(dawn.health >= 51 && dawn.health <= 53,
    `the sanitation unit adds +1 health at dawn (health ${dawn.health})`);

  // G — the street light halves the thief
  const theft = await t(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'theft');
    G.goodwill = 20;
    doPetition('streetlight');
    G.dog = 0; G.structures.stash = false;
    G.cans = 100; G.food = 100; G.scraps = 100; G.morale = 80;
    const real = Math.random; Math.random = () => 0.5;
    ev.effect();
    Math.random = real;
    return { cans: G.cans, food: G.food, scraps: G.scraps };
  });
  ok(theft.cans === 82 && theft.food === 85 && theft.scraps === 90,
    `under the light thieves take exactly half (${theft.cans}/${theft.food}/${theft.scraps})`);

  // H — persistence + migration
  await t(() => saveGame());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const back = await t(() => ({ san: !!G.petitions.sanitation, grant: !!G.petitions.grant,
    n: Object.keys(G.petitions).length }));
  ok(back.san && back.grant && back.n === 3, 'the petitions map rides the save');
  await t(() => {
    const s = JSON.parse(localStorage.getItem('homeless_village_v1'));
    delete s.petitions;
    localStorage.setItem('homeless_village_v1', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const legacy = await t(() => Object.keys(G.petitions).length);
  ok(legacy === 0, 'pre-HV-15 saves migrate clean');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
