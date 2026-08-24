/* HV-17 — the Bus Ticket (one-shot, classic-script globals).
 * A. Fresh camp: no ask, no button; the 'Send someone home' goal is
 *    on the ladder; the numbers read 12🩶 + 8🧱 / 4-day ask / letters
 *    every 6 days.
 * B. A small or unknown camp hears no ask at dawn; three residents
 *    and Respected rep open one, with the button on the rail.
 * C. A short fare is refused free; the funded fare sends a resident
 *    home — pop −1, +8 morale, +3 rep, the ask closes, one community
 *    figure leaves the scene.
 * D. The ask expires after 4 unfunded days, and the next only opens
 *    after the 10-day cadence.
 * E. Letters: every 6th dawn after a send, a pinned roll drops +2
 *    food and +2 morale; quiet dawns bring nothing.
 * F. The tally, cadence days and a pending ask ride the save; legacy
 *    saves migrate clean.
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
    if (!sessionStorage.getItem('hvticket-init')) {
      sessionStorage.setItem('hvticket-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = fn => page.evaluate(fn);

  // A
  const fresh = await t(() => ({
    ask: !!G.ticketAsk, sent: G.ticketsSent || 0,
    btn: !!document.getElementById('action-ticket'),
    consts: [TICKET_COST_GW, TICKET_COST_SCRAPS, TICKET_ASK_DAYS, TICKET_EVERY, LETTER_EVERY].join(','),
    goal: GOALS.some(g => g.id === 'ticket1'),
  }));
  ok(!fresh.ask && fresh.sent === 0 && !fresh.btn, 'fresh camp: no ask, no button');
  ok(fresh.consts === '12,8,4,10,6' && fresh.goal,
    'the numbers read 12🩶+8🧱 / 4-day ask / 10-day cadence / 6-day letters; the goal is on the ladder');

  // B — the gates, then the ask
  const asked = await t(() => {
    G.population = 2; G.rep = 60; G.days = 20;
    ticketAtDawn();
    const small = !!G.ticketAsk;
    G.population = 3; G.rep = 10;
    ticketAtDawn();
    const unknown = !!G.ticketAsk;
    G.rep = 60;
    ticketAtDawn();
    buildActionUI();
    return { small, unknown, ask: !!G.ticketAsk, day: G.ticketAsk && G.ticketAsk.day,
      btn: !!document.getElementById('action-ticket') };
  });
  ok(!asked.small && !asked.unknown, 'a small or unknown camp hears no ask');
  ok(asked.ask && asked.day === 20 && asked.btn, 'three residents + Respected open the ask; the button is on the rail');

  // C — the fare
  const sent = await t(() => {
    const before = {
      pop: G.population, morale: (G.morale = 50), rep: G.rep,
      figures: figures.filter(f => f.userData && f.userData.type === 'community').length,
    };
    G.goodwill = 5; G.scraps = 20;
    doAction(ticketAction());          // short fare — refused at the door
    const refused = { ask: !!G.ticketAsk, gw: G.goodwill };
    G.goodwill = 15;
    finishAction(ticketAction());      // the funded fare (action timer skipped)
    return { before, refused,
      pop: G.population, morale: G.morale, rep: G.rep, gw: G.goodwill, scraps: G.scraps,
      ask: !!G.ticketAsk, sent: G.ticketsSent,
      figures: figures.filter(f => f.userData && f.userData.type === 'community').length };
  });
  ok(sent.refused.ask && sent.refused.gw === 5, 'a short fare is refused free');
  ok(sent.pop === sent.before.pop - 1 && sent.morale === 58 && sent.rep === sent.before.rep + 3
    && sent.gw === 3 && sent.scraps === 12 && !sent.ask && sent.sent === 1,
    'the funded fare sends a resident home (pop −1, +8 morale, +3 rep, ask closed)');
  ok(sent.figures === Math.max(0, sent.before.figures - 1), 'one community figure boards the bus');

  // D — expiry + cadence
  const expiry = await t(() => {
    G.population = 3;                   // the camp filled back up
    G.ticketAsk = { day: G.days - 4 };  // four unfunded days
    G.ticketLastDay = G.days - 4;
    ticketAtDawn();
    const lapsed = !G.ticketAsk;
    ticketAtDawn();                     // cadence not yet met — stays quiet
    const quiet = !G.ticketAsk;
    G.ticketLastDay = G.days - 10;
    ticketAtDawn();
    return { lapsed, quiet, reopened: !!G.ticketAsk };
  });
  ok(expiry.lapsed && expiry.quiet, 'an unfunded ask expires; the next waits out the cadence');
  ok(expiry.reopened, 'ten days on, someone else opens up');

  // E — letters
  const letters = await t(() => {
    G.ticketAsk = null;
    G.lastLetterDay = G.days - 6;
    G.food = 10; G.morale = 50;
    const real = Math.random; Math.random = () => 0;   // rand(0,2) → 0 → food
    ticketAtDawn();
    Math.random = real;
    const first = { food: G.food, morale: G.morale, day: G.lastLetterDay };
    ticketAtDawn();                                    // next dawn — too soon
    return { first, food: G.food, morale: G.morale };
  });
  ok(letters.first.food === 12 && letters.first.morale === 52,
    'a letter lands on the 6th dawn: +2 food, +2 morale');
  ok(letters.food === 12 && letters.morale === 52, 'quiet dawns bring nothing');

  // F — persistence + legacy migration
  await t(() => { G.ticketAsk = { day: G.days }; saveGame(); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const back = await t(() => ({ sent: G.ticketsSent, ask: !!G.ticketAsk,
    btn: !!document.getElementById('action-ticket') }));
  ok(back.sent === 1 && back.ask && back.btn, 'the tally and the pending ask ride the save');
  await t(() => {
    const sv = JSON.parse(localStorage.getItem('homeless_village_v1'));
    delete sv.ticketsSent; delete sv.ticketLastDay; delete sv.lastLetterDay; delete sv.ticketAsk;
    localStorage.setItem('homeless_village_v1', JSON.stringify(sv));
    localStorage.setItem = () => {};
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const legacy = await t(() => ({ sent: G.ticketsSent, last: G.ticketLastDay,
    letter: G.lastLetterDay, ask: G.ticketAsk || null }));
  ok(legacy.sent === 0 && legacy.last === -9 && legacy.letter === -9 && !legacy.ask,
    'pre-HV-17 saves migrate clean');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
