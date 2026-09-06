/* HV-69 — Injury must slow crafts, not only camp actions.
 *
 * The Injury event sets G.injuredUntil = Date.now()+90000 and logs
 * "Actions will be slower for a while." doAction() honors that with
 * time*1.8. doCraft() never reads injuredUntil, so Blanket / Firewood
 * finish at full speed while Rest / Scavenge limp. The event's only
 * ongoing penalty skips half the verbs.
 *
 * Hook-free. Reverting the craft multiplier fails the named assertion.
 * Builder still halves; a healthy camp still crafts at base time.
 *
 * A. Source: doCraft reads injuredUntil. ui.js untouched.
 * B. Injury still slows Rest (3000 → 5400).
 * C. Injury also slows Firewood (2000 → 3600).
 * D. A healthy camp still crafts Firewood in 2000ms.
 * Z. Zero page errors.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const ui     = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const loop   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');

const craftAt = player.indexOf('function doCraft(r){');
const craft = craftAt >= 0 ? player.slice(craftAt, craftAt + 900) : '';
ok(/injuredUntil/.test(craft),
  'HV-69: doCraft() reads injuredUntil');
ok(/Actions will be slower/.test(loop) && /injuredUntil/.test(loop),
  'the Injury event still promises slower actions');
ok(!/injuredUntil/.test(ui),
  'ui.js is untouched — the multiplier lives in doCraft');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.addInitScript(() => { localStorage.setItem('hv-intro-seen', '1'); });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2200);

  const rest = await page.evaluate(() => {
    G.injuredUntil = Date.now() + 90000;
    G.cooldowns.rest = 0;
    delete activeJobs.rest;
    const a = ACTIONS.find(x => x.id === 'rest');
    doAction(a);
    return activeJobs.rest ? activeJobs.rest.duration : null;
  });
  ok(rest === 5400,
    `Injury still slows Rest (3000 → ${rest})`);

  // C — named assertion. Revert the doCraft multiplier and Firewood
  // stays at 2000 while Rest is 5400.
  const wood = await page.evaluate(() => {
    G.injuredUntil = Date.now() + 90000;
    G.workers.builder = false;
    G.wood = 20;
    delete G.activeCrafts.fire_ration;
    const r = RECIPES.find(x => x.id === 'fire_ration');
    doCraft(r);
    const job = G.activeCrafts.fire_ration;
    return job ? job.duration : null;
  });
  ok(wood === 3600,
    `HV-69: Injury also slows Firewood (2000 → ${wood})`);

  const healthy = await page.evaluate(() => {
    G.injuredUntil = 0;
    G.workers.builder = false;
    G.wood = 20;
    delete G.activeCrafts.fire_ration;
    const r = RECIPES.find(x => x.id === 'fire_ration');
    doCraft(r);
    const job = G.activeCrafts.fire_ration;
    return job ? job.duration : null;
  });
  ok(healthy === 2000,
    `a healthy camp still crafts Firewood in 2000ms (${healthy})`);

  const built = await page.evaluate(() => {
    G.injuredUntil = Date.now() + 90000;
    G.workers.builder = true;
    G.wood = 20;
    delete G.activeCrafts.fire_ration;
    const r = RECIPES.find(x => x.id === 'fire_ration');
    doCraft(r);
    const job = G.activeCrafts.fire_ration;
    return job ? job.duration : null;
  });
  ok(built === 1800,
    `Builder still halves, then Injury multiplies (1000 × 1.8 = ${built})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
