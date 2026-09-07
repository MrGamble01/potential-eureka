/* HV-270 — "Make room" ran a 6-second job, chimed, and seated nobody
 * once the camp was full.
 *
 * newcomerAtDawn opens the ask only while population < NEWCOMER_POP_MAX
 * (6). The ask then holds three days, and in those three days the camp
 * can fill by another door: hireWorker() adds a resident with no cap
 * check. Five by the fire, the stranger waiting, hire the Lookout — six.
 *
 * The 🫂 Make room button stays on the rail, lit, funded. Clicking it
 * started the 6-second job, dimmed the button, filled the bar, and at
 * the end finishAction's re-check (`population < NEWCOMER_POP_MAX`)
 * quietly failed — but the shared tail still played sfx('action'), the
 * success blip. Nothing was said. No one sat down. The ask stayed open,
 * the button stayed lit, and every further click was another silent
 * six seconds with a chime at the end.
 *
 * Every other refuse this button knows — no ask, short pantry — happens
 * in doAction BEFORE the timer, with a log line and the error blip
 * (HV-21, and the same shape HV-61 gave Trade). The cap is now the
 * third one. ui.js is untouched.
 *
 * Write-first; hook-free (real page, real doAction, real hireWorker).
 *
 * A. Source: doAction's newcomer block refuses on NEWCOMER_POP_MAX
 *    before setTimeout, and ui.js is not part of the fix.
 * B. Live: a Respected camp of five with the ask open hires a worker
 *    and fills. Make room then starts NO job, spends nothing, and says
 *    why. Reverting the gate fails the named assertion (the job
 *    starts).
 * C. Control: one bed short of the cap, the same click still seats the
 *    newcomer — pop +1, 6 food and 4 wood spent, the ask closed.
 * Z. Zero page errors.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

// ── A. Source ──
const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const doAt = player.indexOf('function doAction(');
const timerAt = player.indexOf('setTimeout(function(){ finishAction(a); }', doAt);
const head = doAt >= 0 && timerAt > doAt ? player.slice(doAt, timerAt) : '';
const gateAt = head.indexOf("a.id==='newcomer'");
const gate = gateAt >= 0 ? head.slice(gateAt, gateAt + 700) : '';
ok(/NEWCOMER_POP_MAX/.test(gate),
  'HV-270: doAction refuses a full camp before the newcomer timer (NEWCOMER_POP_MAX is checked ahead of setTimeout)');
ok(/NEWCOMER_POP_MAX[^;]*\)\s*\{[^}]*sfx\('error'\)[^}]*return/.test(gate) || /NEWCOMER_POP_MAX[^}]*log\([^}]*sfx\('error'\)/.test(gate),
  'the full-camp refuse logs a line and plays the error blip, like the short-pantry refuse beside it');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvroom-init')) {
      sessionStorage.setItem('hvroom-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  // ── B. Five by the fire, the stranger waiting, one hire fills it ──
  const full = await t(() => {
    const lastLog = () => { const l = document.querySelectorAll('#log-feed .log-line'); return l.length ? l[l.length - 1].textContent : ''; };
    // A Respected camp with a tent, one bed short of the cap, ask open.
    G.rep = 60; G.structures.tent = true;
    G.population = NEWCOMER_POP_MAX - 1;
    G.newcomerAsk = { day: G.days };
    G.food = 20; G.wood = 20; G.goodwill = 50;
    G.workers = { scrapper: false, builder: false, cook: false, lookout: false };
    delete activeJobs.newcomer;
    buildActionUI(); buildWorkersUI();
    const btnBefore = document.getElementById('action-newcomer');
    const litBefore = !!btnBefore && !btnBefore.disabled;
    // The other door: hire the Lookout. No cap check here — the camp is now six.
    hireWorker('lookout');
    const popAfterHire = G.population;
    const askStillOpen = !!G.newcomerAsk;
    // Click Make room on the full camp.
    const food0 = G.food, wood0 = G.wood;
    doAction(newcomerAction());
    const btn = document.getElementById('action-newcomer');
    return {
      litBefore, popAfterHire, askStillOpen,
      cap: NEWCOMER_POP_MAX,
      jobStarted: !!activeJobs.newcomer,
      activeClass: !!btn && btn.classList.contains('active-job'),
      food: G.food - food0, wood: G.wood - wood0,
      line: lastLog(),
    };
  });
  ok(full.litBefore && full.askStillOpen && full.popAfterHire === full.cap,
    `the ask was open and lit at ${full.cap - 1}; one hire fills the camp to ${full.popAfterHire} and the ask stays open`);
  ok(!full.jobStarted && !full.activeClass,
    `HV-270: Make room on a full camp starts no job (activeJobs.newcomer=${full.jobStarted}, active-job=${full.activeClass}) — reverting the gate fails this by name`);
  ok(full.food === 0 && full.wood === 0, 'nothing is spent on the refused bed');
  ok(/full|no room/i.test(full.line),
    `the refuse says why, in the log — got ${JSON.stringify(full.line.slice(0, 90))}`);

  // Let the old 6s timer window pass: still no one seated, still nothing spent.
  await page.waitForTimeout(6500);
  const later = await t(() => ({ pop: G.population, welcomes: G.welcomes || 0, food: G.food, wood: G.wood, ask: !!G.newcomerAsk }));
  ok(later.pop === full.cap && later.welcomes === 0 && later.food === 20 && later.wood === 20,
    `6.5s on, the full camp is unchanged (pop ${later.pop}, welcomes ${later.welcomes}, food ${later.food}, wood ${later.wood})`);

  // ── C. Control: one bed short, the same click still seats them ──
  const seated = await t(() => {
    G.population = NEWCOMER_POP_MAX - 1;
    G.newcomerAsk = { day: G.days };
    G.food = 20; G.wood = 20;
    delete activeJobs.newcomer;
    buildActionUI();
    doAction(newcomerAction());
    return { jobStarted: !!activeJobs.newcomer };
  });
  ok(seated.jobStarted, 'one bed short of the cap, Make room still starts its job');
  await page.waitForTimeout(6500);
  const done = await t(() => ({ pop: G.population, welcomes: G.welcomes || 0, food: G.food, wood: G.wood, ask: !!G.newcomerAsk }));
  ok(done.pop === full.cap && done.welcomes === 1 && done.food === 14 && done.wood === 16 && !done.ask,
    `and seats the newcomer — pop ${done.pop}, 6🍞 + 4🪵 spent (food ${done.food}, wood ${done.wood}), the ask closes`);

  // ── Z ──
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
