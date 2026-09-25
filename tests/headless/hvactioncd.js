/* Hook-free action cooldown regression: production completion arms the lock,
 * the re-enabled button explains repeat clicks, and expiry permits a new job.
 * Freeze Date only; real production timers and log feed remain in use. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
function ok(condition, name) {
  condition ? pass++ : fail++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}`);
}

(async () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../homeless-village/js/player.js'), 'utf8');
  const action = source.slice(source.indexOf('function doAction(a){'), source.indexOf('function finishAction(a){'));
  const gate = action.slice(action.indexOf('if(G.cooldowns[a.id]'), action.indexOf('// HV-63'));
  ok(/log\(/.test(gate) && /Math\.ceil\(/.test(gate) && /sfx\('error'\)/.test(gate) && /return;/.test(gate),
    'cooldown gate logs rounded-up seconds, plays error, and returns');
  ok(action.indexOf('if(G.cooldowns[a.id]') < action.indexOf('activeJobs[a.id]=') &&
    action.indexOf('if(G.cooldowns[a.id]') < action.indexOf('setTimeout'), 'cooldown guard precedes job creation and timer');

  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 880 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('hv-intro-seen', '1'));
    await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
    await page.waitForFunction(() => document.getElementById('action-trade'));
    const start = Date.now();
    await page.clock.setFixedTime(start);
    for (const id of ['trade', 'rest', 'forage']) {
      await page.clock.setFixedTime(start);
      const armed = await page.evaluate(id => {
        G.cans = 30; G.food = 20; G.health = 60; G.morale = 60;
        G.weather = 'clear'; G.dumpsterLockDay = -1; G.injuredUntil = 0;
        const a = ACTIONS.find(a => a.id === id);
        finishAction(a);
        const deadline = G.cooldowns[id];
        // finishAction just re-enabled the real button: exercise its handler
        // before the frame loop disables it again, without changing the UI.
        const before = JSON.stringify(G);
        const previousLine = document.querySelector('.log-line:last-child');
        document.getElementById('action-' + id).click();
        const lastLine = document.querySelector('.log-line:last-child');
        return { deadline, cooldown: a.cooldown, time: a.time,
          unchanged: before === JSON.stringify(G), job: !!activeJobs[id],
          fresh: lastLine !== previousLine, log: lastLine && lastLine.textContent,
          expected: a.icon + ' ' + a.label + ' ready in ' + Math.ceil(a.cooldown / 1000) + 's' };
      }, id);
      ok(armed.fresh && armed.log === '> ' + armed.expected, `${id}: completed action's button names cooldown seconds in the live log`);
      ok(armed.unchanged && !armed.job && armed.deadline === start + armed.cooldown,
        `${id}: repeat click leaves resources, deadline and jobs unchanged`);
      for (const remaining of [4101, 1]) {
        await page.clock.setFixedTime(armed.deadline - remaining);
        const repeat = await page.evaluate(id => {
          const a = ACTIONS.find(a => a.id === id);
          const before = JSON.stringify(G);
          const previousLine = document.querySelector('.log-line:last-child');
          doAction(a);
          const line = document.querySelector('.log-line:last-child');
          return { unchanged: before === JSON.stringify(G), job: !!activeJobs[id],
            fresh: line !== previousLine, text: line && line.textContent,
            expected: '> ' + a.icon + ' ' + a.label + ' ready in ' + Math.ceil((G.cooldowns[id] - Date.now()) / 1000) + 's' };
        }, id);
        ok(repeat.fresh && repeat.text === repeat.expected && repeat.unchanged && !repeat.job,
          `${id}: ${remaining}ms rounds up to ${Math.ceil(remaining / 1000)}s without mutation`);
      }
      await page.clock.setFixedTime(armed.deadline);
      const ready = await page.evaluate(id => {
        doAction(ACTIONS.find(a => a.id === id));
        return { job: activeJobs[id], deadline: G.cooldowns[id],
          active: document.getElementById('action-' + id).classList.contains('active-job') };
      }, id);
      ok(ready.job && ready.job.startTime === armed.deadline && ready.job.duration === armed.time &&
        ready.active && ready.deadline === armed.deadline, `${id}: exact expiry starts the normal job without rewriting cooldown`);
      // Wait for the actual timer, also proving no timer was queued by refusals.
      await page.waitForFunction(id => !activeJobs[id], id);
      ok(await page.evaluate(({ id, deadline, cooldown }) => G.cooldowns[id] === deadline + cooldown,
        { id, deadline: armed.deadline, cooldown: armed.cooldown }), `${id}: normal completion rearms its original cooldown`);
    }
    ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join('; ') : ''}`);
  } finally {
    await browser.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });
