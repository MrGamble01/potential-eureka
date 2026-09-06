/*
 * HV-158 — Walk the neighbor's dogs said wagging tails, then hungry
 * Biscuit never came along.
 *
 * The bulletin posting is: "Fresh air, wagging tails. +2 goodwill,
 * +6 morale." Biscuit is the camp dog. A hungry camp dog wears 🐕💢
 * on the population badge — the opposite of wagging tails.
 * finishAction's odd-job branch paid the numbers and walked away.
 * dogHungry stayed true. The badge still growled.
 *
 * Not #738 (hungry Biscuit still chased thieves). Not #759 (a fed
 * dawn stayed silent). Not #815 (he fell asleep against the barrel).
 * Not #844 / #845 (depot morning / flyer owner). This ticket is the
 * dog-walk card's unused words: wagging tails.
 *
 *  A. Source: the posting still says wagging tails; the odd-job
 *     branch clears dogHungry on dogwalk when Biscuit is in camp;
 *     ui.js is untouched.
 *  B. Day 4 is dogwalk. A hungry camp dog comes along — dogHungry
 *     flips false, the badge drops the growl, +2 goodwill / +6
 *     morale still pay.
 *  C. Depot / flyers / garden / scrapyard leave him hungry.
 *  D. A walk with no camp dog does not join him. Dawn with an
 *     empty pot still hungers him. Theft still halves on dog===2.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction(oddJobAction()) on the production
 * posting.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const walk = /id:'dogwalk'[\s\S]*?desc:'([^']+)'/.exec(cfg);
ok(!!walk && /wagging tails/i.test(walk[1]),
  'the Walk the neighbor\'s dogs posting still says wagging tails');

const odd = /else if\(a\.id==='oddjob'\)\{([\s\S]*?)\} else if\(a\.id==='mural'\)/.exec(player);
ok(!!odd, 'finishAction still owns the odd-job branch');
ok(odd && /dogwalk/.test(odd[1]) && /dogHungry\s*=\s*false/.test(odd[1]),
  'HV-158: the odd-job branch clears dogHungry on the dog-walk');
ok(!/dogHungry\s*=\s*false/.test(ui),
  'ui.js is untouched — the badge only reads the flag');

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
    if (!sessionStorage.getItem('hvdogwalk-init')) {
      sessionStorage.setItem('hvdogwalk-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  // B — day 4 dogwalk with a hungry camp dog
  const walked = await t(() => {
    G.days = 4;
    G.oddJobDay = -9;
    G.goalIndex = GOALS.length;
    G.dog = 2;
    G.dogHungry = true;
    G.goodwill = 10;
    G.morale = 50;
    G.rep = 10;
    updateHUD();
    const before = document.getElementById('pop-val').textContent;
    const id = todaysJob().id;
    finishAction(oddJobAction());
    updateHUD();
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' ');
    return {
      id,
      hungry: G.dogHungry,
      gw: G.goodwill,
      morale: G.morale,
      before,
      badge: document.getElementById('pop-val').textContent,
      log,
    };
  });
  ok(walked.id === 'dogwalk', `day 4 posts Walk the neighbor's dogs (${walked.id})`);
  ok(walked.gw === 12 && walked.morale === 56,
    `the posting still pays +2 goodwill, +6 morale (${walked.gw}/${walked.morale})`);
  ok(walked.hungry === false,
    `HV-158: a hungry Biscuit comes along — dogHungry flips false (now ${walked.hungry})`);
  ok(/🐕💢/.test(walked.before) && /🐕/.test(walked.badge) && !/💢/.test(walked.badge),
    `the badge drops the growl (${walked.before} → ${walked.badge})`);
  ok(/Biscuit came along|wagging tails/i.test(walked.log),
    `the log names the walk with Biscuit (${walked.log.slice(-90)})`);

  // C — the other four postings do not cheer him
  const others = await t(() => {
    const out = {};
    [0, 1, 2, 3].forEach((d) => {
      G.days = d;
      G.oddJobDay = -9;
      G.dog = 2;
      G.dogHungry = true;
      G.goodwill = 10;
      G.morale = 50;
      G.scraps = 0;
      G.cans = 0;
      G.food = 0;
      const id = todaysJob().id;
      finishAction(oddJobAction());
      out[id] = G.dogHungry;
    });
    return out;
  });
  ok(others.depot && others.flyers && others.gardenh && others.scrapyd,
    `depot / flyers / garden / scrapyard leave him hungry (${JSON.stringify(others)})`);

  // D — no camp dog; dawn hunger; theft still halves
  const stray = await t(() => {
    G.days = 4;
    G.oddJobDay = -9;
    G.dog = 0;
    G.dogHungry = true;
    finishAction(oddJobAction());
    return { dog: G.dog, hungry: G.dogHungry };
  });
  ok(stray.dog === 0 && stray.hungry === true,
    'a walk with no camp dog does not join Biscuit');

  const dawn = await t(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.dog = 2;
    G.dogHungry = false;
    G.food = 0;
    G.population = 1;
    G.workers.scrapper = false;
    G.workers.cook = false;
    G.structures.garden = false;
    G.structures.tent = false;
    G.rep = 0;
    G.snapUntil = null;
    G.lastEventDay = G.days + 5;
    G.forecast = 'clear';
    G.warmth = 90;
    onNewDay();
    Math.random = real;
    return G.dogHungry;
  });
  ok(dawn === true, 'dawn with an empty pot still hungers him');

  const theft = await t(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'theft');
    const real = Math.random;
    Math.random = () => 0.5;
    G.dog = 2;
    G.dogHungry = true;
    G.cans = 20;
    G.food = 20;
    G.scraps = 20;
    G.morale = 50;
    G.structures.stash = false;
    G.petitions = {};
    triggerEvent(ev, false);
    Math.random = real;
    return { cans: G.cans, food: G.food, scraps: G.scraps };
  });
  ok(theft.cans === 17,
    `theft still halves with a hungry Biscuit in camp (20 → ${theft.cans}, not the full 13)`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
