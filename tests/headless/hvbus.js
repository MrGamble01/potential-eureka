/*
 * HV-100 — Buy the bus ticket said "morning bus" and sent them at night.
 *
 * The tooltip and the success log both put them on the morning bus.
 * finishAction sent them the moment the 6s job ended, even at Night
 * (timeOfDay 0.85). The day clock never gated the send-off.
 *
 * Dawn and Morning are the first two sixths of the day (the HUD
 * labels). A fare paid then still boards now — hvticket's dawn
 * send-off stays honest. A fare paid later stamps a pending ride;
 * ticketAtDawn boards them when the morning bus actually comes.
 *
 *  A. Source: finishAction's ticket branch defers off-morning fares
 *     (ticketPending / morningBusHere). ticketAtDawn boards pending.
 *  B. The tooltip still promises the morning bus.
 *  C. A Night fare takes the money and leaves the resident until dawn.
 *  D. ticketAtDawn then sends them (pop −1, ticketsSent +1).
 *  E. A Dawn fare still boards immediately (hvticket's path).
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction(ticketAction()) + ticketAtDawn.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const ticket = /else if\(a\.id==='ticket'\)\{([\s\S]*?)\n  \}/.exec(player);
const dawn = /function ticketAtDawn\(\)\{([\s\S]*?)\n\}/.exec(loop);
ok(!!ticket && !!dawn, 'ticket finishAction and ticketAtDawn are still in place');
ok(ticket && /ticketPending|morningBusHere/.test(ticket[1]) &&
    dawn && /ticketPending/.test(dawn[1]),
  'HV-100: off-morning fares wait for ticketAtDawn (pending), they do not board at Night');
ok(/morning bus/.test(cfg), 'the tooltip still promises the morning bus');

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvbus-init')) {
      sessionStorage.setItem('hvbus-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const night = await t(() => {
    checkGoals();
    G.goalIndex = GOALS.length;
    G.ticketAsk = { day: G.days };
    G.ticketPending = false;
    G.ticketsSent = 0;
    G.population = 3;
    G.goodwill = 20;
    G.scraps = 20;
    G.morale = 50;
    G.timeOfDay = 0.85;
    G.lastEventDay = G.days + 5;
    G.lastLetterDay = G.days;   // letters are a different dawn; isolate the boarding
    const tip = ticketAction().tooltip;
    finishAction(ticketAction());
    return {
      tip,
      pop: G.population,
      sent: G.ticketsSent,
      pending: !!G.ticketPending,
      ask: !!G.ticketAsk,
      gw: G.goodwill,
      scraps: G.scraps,
      morale: G.morale,
      tod: G.timeOfDay,
    };
  });
  ok(/morning bus/.test(night.tip), 'the live tooltip still says morning bus');
  ok(night.pop === 3 && night.sent === 0 && night.pending && !night.ask,
    `HV-100: a Night fare does not board them (pop=${night.pop}, sent=${night.sent}, pending=${night.pending})`);
  ok(night.gw === 8 && night.scraps === 12 && night.morale === 50 && night.tod === 0.85,
    `the fare is taken and the clock stays Night (gw ${night.gw}, scraps ${night.scraps}, tod ${night.tod})`);

  const boarded = await t(() => {
    const pop0 = G.population;
    const figs0 = figures.filter(f => f.userData && f.userData.type === 'community').length;
    ticketAtDawn();
    return {
      pop: G.population,
      sent: G.ticketsSent,
      pending: !!G.ticketPending,
      morale: G.morale,
      figs: figures.filter(f => f.userData && f.userData.type === 'community').length - figs0,
      left: pop0 - G.population,
    };
  });
  ok(boarded.left === 1 && boarded.sent === 1 && !boarded.pending && boarded.morale === 58,
    `dawn boards the pending ride (pop Δ ${boarded.left}, sent ${boarded.sent}, morale ${boarded.morale})`);

  const dawnFare = await t(() => {
    G.ticketAsk = { day: G.days };
    G.ticketPending = false;
    G.ticketsSent = 0;
    G.population = 3;
    G.goodwill = 20;
    G.scraps = 20;
    G.morale = 50;
    G.timeOfDay = 0.05;
    finishAction(ticketAction());
    return { pop: G.population, sent: G.ticketsSent, pending: !!G.ticketPending, ask: !!G.ticketAsk };
  });
  ok(dawnFare.pop === 2 && dawnFare.sent === 1 && !dawnFare.pending && !dawnFare.ask,
    `a Dawn fare still boards immediately (pop ${dawnFare.pop}, sent ${dawnFare.sent})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
