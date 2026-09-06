/* HV-112 — Garage Favor said the goods spend their nights across
 * the street, then thieves still raided the camp.
 *
 * Garage Favor's tooltip: 2 goodwill stows the camp's loose goods
 * in Marisol's garage till the next sweep. The log says the loose
 * goods spend their nights there. Theft is "in the night." The
 * cover zeroed the sweep and left the night raid on the same pile.
 *
 *  A. Source: the theft effect checks garageCover before it takes
 *     cans / food / scraps. The tooltip still says the goods spend
 *     their nights in the garage.
 *  B. A covered night: cans, food, scraps and morale hold. The
 *     cover stays armed — it is sweep insurance, not a one-raid
 *     charm.
 *  C. An uncovered night still takes the pinned cut.
 *  D. A covered sweep still confiscates nothing and spends the
 *     cover (hvgarage's seam).
 *  Z. Zero page errors.
 *
 * Hook-free. Drives EVENTS_BAD.theft.effect and sweep.effect.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const theftAt = loop.indexOf("id:'theft'");
const theft = theftAt >= 0 ? loop.slice(theftAt, theftAt + 900) : '';
const effectAt = theft.indexOf('effect:function(){');
const effect = effectAt >= 0 ? theft.slice(effectAt, theft.indexOf('}},', effectAt) + 1) : '';
const takeAt = effect.search(/G\.cans\s*=/);

ok(theftAt >= 0 && /id:'theft'/.test(theft),
  'Theft is still in the bad-event pool — guards the guard');
ok(/till the next sweep/.test(cfg) && /Marisol/.test(cfg) && /garage/.test(cfg),
  'Garage Favor still says the goods wait in Marisol\'s garage till the next sweep');
ok(takeAt > 0 && /garageCover/.test(effect.slice(0, takeAt)),
  'HV-112: theft checks the garage cover before it takes the pile');

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
    if (!sessionStorage.getItem('hvgaragenight-init')) {
      sessionStorage.setItem('hvgaragenight-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const tip = await t(() => (ACTIONS.find(a => a.id === 'garage') || {}).tooltip || '');
  ok(/garage/i.test(tip) && /sweep/i.test(tip),
    `the live tooltip still stows the goods till the next sweep (${tip.slice(0, 80)})`);

  // B — covered night. random=0.5 is the pinned uncovered cut;
  // if the cover is ignored, 20/20/20/80 become 13/14/16/~64.
  const covered = await t(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.garageCover = true; G.garageSaves = 0;
    G.dog = 0; G.structures.stash = false; G.petitions = {};
    G.cans = 20; G.food = 20; G.scraps = 20; G.morale = 80;
    EVENTS_BAD.find(e => e.id === 'theft').effect();
    Math.random = real;
    const feed = Array.from(document.querySelectorAll('.log-line')).map(el => el.textContent).join('\n');
    return {
      cans: G.cans, food: G.food, scraps: G.scraps, morale: G.morale,
      cover: G.garageCover, saves: G.garageSaves, feed,
    };
  });
  ok(covered.cans === 20 && covered.food === 20 && covered.scraps === 20 && covered.morale === 80,
    `HV-112: a covered night leaves the pile (cans ${covered.cans}, food ${covered.food}, scraps ${covered.scraps}, morale ${covered.morale})`);
  ok(covered.cover && covered.saves === 0,
    'the cover stays armed — it is for the sweep, not spent on a raid');
  ok(/garage/i.test(covered.feed) && /thieves|nothing/i.test(covered.feed),
    'the night log names the garage, not a raid');

  // C — uncovered night, same pinned roll as hvstash / hvpetition
  const raw = await t(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.garageCover = false; G.dog = 0; G.structures.stash = false; G.petitions = {};
    G.cans = 20; G.food = 20; G.scraps = 20; G.morale = 80;
    EVENTS_BAD.find(e => e.id === 'theft').effect();
    Math.random = real;
    return { cans: G.cans, food: G.food, scraps: G.scraps };
  });
  ok(raw.cans === 13 && raw.food === 14 && raw.scraps === 16,
    `an uncovered night still takes the pinned cut (cans ${raw.cans}, food ${raw.food}, scraps ${raw.scraps})`);

  // D — covered sweep still spends the cover (hvgarage isolation)
  const sweep = await t(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.garageCover = true; G.garageSaves = 0; G.packedUp = false;
    G.scraps = 10; G.food = 10; G.morale = 80;
    G.structures.tent = true; G.structures.stash = false;
    G.structures.soup_kitchen = false; G.structures.workbench = false; G.structures.garden = false;
    EVENTS_BAD.find(e => e.id === 'sweep').effect();
    Math.random = real;
    return { scraps: G.scraps, food: G.food, cover: G.garageCover,
      saves: G.garageSaves, tent: G.structures.tent };
  });
  ok(sweep.scraps === 10 && sweep.food === 10 && !sweep.cover && sweep.saves === 1,
    'a covered sweep still confiscates nothing and spends the cover');
  ok(!sweep.tent, 'the tent still falls — the garage holds goods, not shelter');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
