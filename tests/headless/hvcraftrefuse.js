/* Hook-free: production craft clicks and log feed, including recovery.
 * Refusals must happen before spending resources or starting a timer.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };
const player = fs.readFileSync(path.resolve(__dirname, '../../homeless-village/js/player.js'), 'utf8');
const craft = player.slice(player.indexOf('function doCraft(r){'), player.indexOf('function finishCraft(r){'));
const guard = /if\(!canCraft\(r\)\)\s*\{([\s\S]*?)\}/.exec(craft);
ok(guard && /log\(/.test(guard[1]) && /sfx\('error'\)/.test(guard[1]) && /return;/.test(guard[1]) &&
  guard.index < craft.indexOf('G[e[0]]-=e[1]') && guard.index < craft.indexOf('G.activeCrafts[r.id]='),
  'craft refusal logs and sounds before cost deduction and activeCraft assignment');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(() => {
      localStorage.removeItem('homeless_village_v1');
      localStorage.setItem('hv-intro-seen', '1');
    });
    await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
    await page.waitForFunction(() => typeof G !== 'undefined' && document.getElementById('craft-workbench'));
    const results = await page.evaluate(() => {
      G.goalIndex = GOALS.length;
      G.lastEventDay = G.days;
      G.activeCrafts = {};
      G.structures = {};
      G.wood = 2; G.scraps = 1;
      function attempt(id) {
        const recipe = RECIPES.find(r => r.id === id);
        const snapshot = () => JSON.stringify(Object.keys(recipe.cost).map(k => G[k]));
        const before = snapshot();
        buildCraftUI();
        const button = document.getElementById('craft-' + id);
        const tip = button.getAttribute('data-tip');
        const lines = document.querySelectorAll('.log-line');
        const oldLast = lines[lines.length - 1];
        button.click();
        const first = document.querySelector('.log-line:last-child');
        return { log: first && first !== oldLast ? first.textContent : '', tip,
          same: before === snapshot(), active: !!G.activeCrafts[id] };
      }
      const broke = attempt('workbench');
      G.wood = 5; G.scraps = 4;
      updateHUD();
      const recoveredTip = document.getElementById('craft-workbench').getAttribute('data-tip');
      G.wood = 2; G.scraps = 1;
      // Already built wins even when the camp cannot afford a duplicate.
      G.structures.workbench = true;
      const built = attempt('workbench');
      delete G.structures.workbench;
      G.cardboard = 8; G.scraps = 6; G.wood = 3;
      const locked = attempt('tent');
      G.wood = 5; G.scraps = 4;
      const funded = attempt('workbench');
      const after = { wood: G.wood, scraps: G.scraps };
      const active = JSON.stringify(G.activeCrafts.workbench);
      doCraft(RECIPES.find(r => r.id === 'workbench'));
      const mutex = G.wood === after.wood && G.scraps === after.scraps && JSON.stringify(G.activeCrafts.workbench) === active;
      return { broke, built, locked, funded, after, mutex, recoveredTip };
    });
    for (const [key, pattern] of [
      ['broke', /Workbench.*3 wood.*3 scraps/i],
      ['built', /Workbench.*already built/i],
      ['locked', /Tent.*requires.*Workbench/i],
    ]) {
      const r = results[key];
      ok(pattern.test(r.log), `${key}: immediate named reason in production log (${r.log})`);
      ok(r.same && !r.active, `${key}: no resources spent and no active craft`);
      ok(pattern.test(r.tip), `${key}: hover explains the same refusal`);
    }
    ok(results.funded.active && results.after.wood === 0 && results.after.scraps === 0,
      'affordable Workbench starts and deducts its exact cost');
    ok(!/missing|requires|already built/i.test(results.funded.tip), 'funded recipe clears stale refusal tip');
    ok(!/missing/i.test(results.recoveredTip), 'HUD refresh clears shortfall without rebuilding craft buttons');
    ok(results.mutex, 'repeat call leaves the active craft and resources unchanged');
    ok(errors.length === 0, `no page errors: ${errors.join('; ')}`);
  } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
