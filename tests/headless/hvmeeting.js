/* HV-14 — the Camp Meeting (one-shot, classic-script globals).
 * A. Fresh camp of one: no circle offered; the meet3 goal is on the ladder.
 * B. At three residents the button appears, live.
 * C. Holding the circle: +2 morale a head, one pot item per resident
 *    beyond you, +2 rep, the tally and day stamp.
 * D. The circle rests: doAction refuses, the button renders ✓-disabled.
 * E. Three days on, a full village of five: +10 morale, 4 pot items,
 *    +2 goodwill for five voices speaking as one.
 * F. Tally and day stamp ride the save; legacy saves migrate clean.
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
    if (!sessionStorage.getItem('hvmeeting-init')) {
      sessionStorage.setItem('hvmeeting-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = fn => page.evaluate(fn);

  // A
  const fresh = await t(() => {
    buildActionUI();
    return { meetings: G.meetings, avail: meetingAvailable(),
      btn: !!document.getElementById('action-meeting'),
      goal: GOALS.some(g => g.id === 'meet3') };
  });
  ok(fresh.meetings === 0 && !fresh.avail && !fresh.btn, 'a camp of one holds no circle');
  ok(fresh.goal, 'the meet3 goal is on the ladder');

  // B
  const offered = await t(() => {
    G.population = 3;
    buildActionUI();
    const b = document.getElementById('action-meeting');
    return { avail: meetingAvailable(), btn: !!b, live: b && !b.disabled };
  });
  ok(offered.avail && offered.btn && offered.live, 'at three residents the button appears, live');

  // C — the circle, to the digit
  const held = await t(() => {
    G.goalIndex = GOALS.length;   // park the ladder so rewards don't pollute
    G.morale = 50; G.rep = 0;
    G.food = 0; G.cans = 0; G.scraps = 0; G.wood = 0; G.cardboard = 0;
    finishAction(meetingAction());
    const pot = G.food + G.cans + G.scraps + G.wood + G.cardboard;
    return { morale: G.morale, pot, rep: G.rep,
      meetings: G.meetings, stamp: G.meetingDay === G.days };
  });
  ok(held.morale === 56 && held.pot === 2,
    `three heads: +6 morale, two pot items (morale ${held.morale}, pot ${held.pot})`);
  ok(held.rep === 2 && held.meetings === 1 && held.stamp,
    'the block hears about it: +2 rep, tally and day stamp set');

  // D — the circle rests
  const rested = await t(() => {
    doAction(meetingAction());
    buildActionUI();
    const b = document.getElementById('action-meeting');
    return { meetings: G.meetings, queued: !!activeJobs.meeting,
      done: meetingDone(), disabled: b && b.disabled, check: b && /✓/.test(b.textContent) };
  });
  ok(rested.meetings === 1 && !rested.queued && rested.done && rested.disabled && rested.check,
    'the circle rests: refused, ✓-disabled until the days pass');

  // E — full village, three days on
  const village = await t(() => {
    G.days += 3; G.population = 5;
    G.morale = 50; G.goodwill = 10;
    G.food = 0; G.cans = 0; G.scraps = 0; G.wood = 0; G.cardboard = 0;
    finishAction(meetingAction());
    const pot = G.food + G.cans + G.scraps + G.wood + G.cardboard;
    return { done: meetingDone(), morale: G.morale, pot, goodwill: G.goodwill, meetings: G.meetings };
  });
  ok(village.done && village.morale === 60 && village.pot === 4 && village.goodwill === 12,
    `five voices: +10 morale, four pot items, +2 goodwill (morale ${village.morale}, pot ${village.pot})`);

  // F — persistence + migration
  await t(() => saveGame());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const back = await t(() => ({ n: G.meetings, day: G.meetingDay === G.days }));
  ok(back.n === 2 && back.day, `the tally and day stamp ride the save (${back.n} circles held)`);
  await t(() => {
    const s = JSON.parse(localStorage.getItem('homeless_village_v1'));
    delete s.meetings; delete s.meetingDay;
    localStorage.setItem('homeless_village_v1', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const legacy = await t(() => ({ n: G.meetings, day: G.meetingDay }));
  ok(legacy.n === 0 && legacy.day === -9, 'pre-HV-14 saves migrate clean');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
