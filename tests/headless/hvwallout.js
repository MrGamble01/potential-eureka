/*
 * HV-123 — Read the Wall said out loud, then the fire never felt it.
 *
 * The tooltip: "Read them out to whoever’s around." The goal: "Read
 * the writing on the wall out loud twice." The fridge-door note is
 * the same numbers read privately, and it "lifts the fire" (+2
 * morale). A successful wall reading only logged the chalk lines.
 * Morale did not move.
 *
 * Distinct from HV-98 (#768 / #771): those refuse a bare wall before
 * the timer. This ticket is the success path — the wall has a story,
 * you read it out, and whoever was around never felt it.
 *
 *  A. Source: the tooltip and the goal still say out loud / whoever's
 *     around. The wall branch lifts morale by HVNOTE_MORALE. ui.js
 *     does not own the read.
 *  B. A bare wall still refuses. Morale does not move. Opens stay 0.
 *  C. A wall with a story lifts morale by exactly the note's 2, ticks
 *     the tally, and the log names the fire.
 *  D. The fridge-door note still lifts +2 on its own. Kind Stranger
 *     is still a food drop.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction({id:'wall'}) on the production page.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const wallTip = /id:'wall'[\s\S]{0,280}?tooltip:'([^']+)'/.exec(cfg);
const wallGoal = /id:'wall2'[\s\S]{0,160}?desc:'([^']+)'/.exec(cfg);
const wallFn = /a\.id==='wall'[\s\S]*?(?=else if\(a\.id==='thermos'\))/.exec(player);
const noteMorale = /var HVNOTE_KEY='hv-letter', HVNOTE_MORALE=(\d+)/.exec(cfg);

ok(!!wallTip && /whoever.s around|whoever’s around|whoever\\u2019s around/i.test(wallTip[1]),
  'the wall tooltip still says read them out to whoever’s around');
ok(!!wallGoal && /out loud/i.test(wallGoal[1]),
  'the wall2 goal still says read the writing out loud');
ok(!!noteMorale && noteMorale[1] === '2',
  'the fridge-door note still lifts the fire by 2 — same numbers, private');
ok(!!wallFn && /G\.morale/.test(wallFn[0]) && /HVNOTE_MORALE/.test(wallFn[0]),
  'HV-123: reading the wall out loud lifts the fire by HVNOTE_MORALE');
ok(!/finishAction/.test(ui) && !/id==='wall'/.test(ui),
  'ui.js does not own the wall read — the fire lift lives in player.js');

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
    if (!sessionStorage.getItem('hvwallout-init')) {
      sessionStorage.setItem('hvwallout-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-fridge');
      localStorage.removeItem('hv-record');
      localStorage.removeItem('hv-letter');
      localStorage.removeItem('hv-history');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  // B — bare wall: refuse, no fire
  const bare = await t(() => {
    G.morale = 50;
    G.goalIndex = GOALS.length;
    finishAction({ id: 'wall' });
    return {
      morale: G.morale,
      opens: loadHvWall().opens,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  });
  ok(bare.opens === 0 && bare.morale === 50,
    `a bare wall still refuses — the fire does not move (${bare.morale})`);
  ok(/bare/.test(bare.log),
    'the bare-wall log is still the refuse, not a reading');

  // C — a wall with a story, read out loud
  const read = await t(() => {
    saveFridge({ built: true, camps: 2 });
    saveHvRec({ days: 9, beats: 1 });
    saveHvNote({ read: 1 });
    G.morale = 50;
    G.goalIndex = GOALS.length;
    finishAction({ id: 'wall' });
    return {
      morale: G.morale,
      opens: loadHvWall().opens,
      note: HVNOTE_MORALE,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  });
  ok(read.opens === 1,
    `a reading still ticks the wall tally (opens=${read.opens})`);
  ok(read.morale === 50 + read.note,
    `HV-123: whoever was around felt it (morale 50 → ${read.morale}, want ${50 + read.note})`);
  ok(/fire|fuller|heard/i.test(read.log) && /\+2/.test(read.log),
    `the log names the fire lift (${read.log.slice(-120)})`);

  // D — the note is still its own +2; Kind Stranger is still food
  const note = await t(() => {
    G.morale = 40;
    const before = G.morale;
    deliverHvNote();
    return { before, morale: G.morale, note: HVNOTE_MORALE };
  });
  ok(note.morale === note.before + note.note,
    `the fridge-door note still lifts +${note.note} on its own (${note.before} → ${note.morale})`);

  const stranger = await t(() => {
    const ev = EVENTS_GOOD.find(e => e.id === 'kind_stranger');
    const real = Math.random;
    Math.random = () => 0.5;
    G.goodwill = 10; G.food = 0; G.morale = 50;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(ev, true);
    Math.random = real;
    return { goodwill: G.goodwill, food: G.food };
  });
  ok(stranger.goodwill === 10 && stranger.food > 0,
    `Kind Stranger is still a food drop, not a wall-morale swap (food=${stranger.food})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
