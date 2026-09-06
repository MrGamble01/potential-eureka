/* HV-102 — Old Ray said he points out dumpsters, then halved empties.
 *
 * The Community roster sells Ray's friendship as: "points out which
 * dumpsters are worth the walk." The scavenge path never marks a bin.
 * Friendship only cuts the empty-haul chance in half (.2 → .1). The
 * comment above that roll already tells the truth. The roster does not.
 *
 * Distinct from HV-99 / #772 (the friend log called him "Old") and
 * HV-77 / #739 (Borrow locked while a loan was out). This ticket is
 * the perk the roster sold. ui.js is not this ticket; it still only
 * paints r.perk.
 *
 * Write-first. Hook-free.
 *
 *  A. Source: Ray's perk names the empty-haul half, not "points out
 *     which dumpsters." The .2 → .1 roll stays.
 *  B. Live: Ray's roster tip matches that perk.
 *  C. Isolation: the same 0.15 roll is empty as a stranger and pays
 *     as a friend (hvregulars already owns this math — keep it).
 *  Z. Zero page errors.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg    = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const ui     = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const rayAt = cfg.indexOf("id:'ray'");
const ray = rayAt >= 0 ? cfg.slice(rayAt, rayAt + 280) : '';
const scavAt = player.indexOf('The dumpster is empty');
const scav = scavAt >= 0 ? player.slice(Math.max(0, scavAt - 280), scavAt + 80) : '';

ok(rayAt >= 0 && /id:'ray'/.test(ray),
  'Old Ray is still a regular — guards the guard');
ok(/Rest nearby/.test(ray),
  'Ray still watches Rest — that is how you meet him');
ok(!/points out which dumpsters/.test(ray) && /empty/i.test(ray) && /half/i.test(ray),
  'HV-102: Ray\'s perk names the empty-haul half, not a pointed-out bin');
ok(/regularStage\('ray'\)===2\s*\?\s*\.5\s*:\s*1/.test(scav)
  && /Math\.random\(\)<\.2/.test(scav),
  'scavenge still halves the empty roll once Ray is a friend');
ok(!/points out which dumpsters/.test(ui) && /r\.perk/.test(ui),
  'ui.js is not this ticket — it still only paints r.perk');

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.addInitScript(() => {
    localStorage.setItem('hv-intro-seen', '1');
    if (!sessionStorage.getItem('hvrayhaul-init')) {
      sessionStorage.setItem('hvrayhaul-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2200);

  const tip = await page.evaluate(() => {
    G.regulars.ray = 5;
    buildRegularsUI();
    const rows = Array.from(document.querySelectorAll('#regulars-list .worker-row'));
    const rayRow = rows.find(r => /Ray/.test(r.textContent));
    return rayRow ? rayRow.getAttribute('data-tip') || '' : '';
  });
  ok(!!tip && /Ray/.test(tip) && /Rest nearby/.test(tip),
    'B. Ray\'s roster tip still says how you meet him');
  ok(!/points out which dumpsters/.test(tip) && /empty/i.test(tip) && /half/i.test(tip),
    'HV-102: the roster sells the empty-haul half');

  const haul = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.15;
    G.weather = 'clear';
    G.season = 0;
    G.cooldowns = {};
    G.regulars.ray = 0;
    G.cans = 0;
    G.scraps = 0;
    G.food = 0;
    finishAction(ACTIONS.find(a => a.id === 'scavenge'));
    const stranger = { scraps: G.scraps, cans: G.cans, food: G.food };
    G.regulars.ray = 5;
    G.cooldowns = {};
    G.scraps = 0;
    G.cans = 0;
    G.food = 0;
    finishAction(ACTIONS.find(a => a.id === 'scavenge'));
    const friend = { scraps: G.scraps, cans: G.cans, food: G.food };
    Math.random = real;
    return { stranger: stranger, friend: friend };
  });
  ok(haul.stranger.scraps === 0 && haul.stranger.cans === 0 && haul.stranger.food === 0,
    'C. a 0.15 roll is still an empty bin without Ray');
  ok((haul.friend.scraps + haul.friend.cans + haul.friend.food) > 0,
    `C. the same roll still pays once Ray is a friend (+${haul.friend.scraps} scraps)`);

  ok(errs.length === 0, `live path: no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
