/*
 * HV-200 — Biscuit's keep said warmth against your back, then
 * the fire-held check never felt it.
 *
 * Fed Biscuit's dawn keep is +3 warmth and +2 morale. The fire
 * held (HV-13) pays +2 morale when the camp wakes at 50+ after
 * the night's drain. The keep block sits after cook / garden /
 * the empty-larder bite, so the +3 lands after the 50 check.
 * A camp Biscuit pushed from 47 to 50 never hears the fire held.
 *
 * Distinct from HV-132 (#815: the join card never warmed the
 * camp — a one-shot on Biscuit Comes Closer), HV-13 (the
 * fire-held check itself), and the hungry-keep log (#759).
 * This is the keep × the fire-held check the same dawn.
 *
 * Do not move the food spend before cook or the empty-larder
 * bite. Do not delay the fire-held line past morale −3 (hvfire
 * D pins +2 then −3). Overnight warmth just has to land first.
 *
 *  A. Source: keep warmth is applied before the fire-held check.
 *  B. The keep still promises warmth against your back, and
 *     still spends food later.
 *  C. Live: warmth 55 → 47 after the drain; fed Biscuit pushes
 *     50 and the fire held. Morale 50 +2 −3 +2 = 51.
 *  D. No Biscuit: 55 → 47, no fire held, plain −3.
 *  E. Hungry Biscuit (food already gone after the drain): no
 *     +3, no fire held, he curls up hungry.
 *  F. Already warm (80): fire held still; warmth 80 −8 +3 = 75.
 *  G. Join is not this card — Biscuit Comes Closer still does
 *     not steal the keep's +3.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives onNewDay() on the production keep.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const src = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const onNew = src.slice(src.indexOf('function onNewDay'), src.indexOf('function bumpRegular'));
const fireAt = onNew.indexOf('The fire held all night');
const warmAt = onNew.indexOf('G.warmth=Math.min(100,G.warmth+3)');
ok(fireAt >= 0 && /G\.warmth\s*>=\s*50/.test(onNew),
  'HV-13: a camp that wakes at 50+ still hears the fire held');
ok(/warmth against your back/.test(onNew) && /G\.dog===2/.test(onNew) && /G\.food-=1/.test(onNew),
  'Biscuit keep still promises warmth against your back and still spends food');
ok(warmAt >= 0 && fireAt >= 0 && warmAt < fireAt,
  'HV-200: Biscuit keep warmth lands before the fire-held check');
ok(/id:'dog_joins'[\s\S]*?falls asleep against the barrel fire/.test(src)
  && !/id:'dog_joins'[\s\S]*?warmth\s*\+\s*3/.test(src.slice(src.indexOf("id:'dog_joins'"), src.indexOf('function checkDog'))),
  'Biscuit Comes Closer is not this card — the join still does not steal the keep\'s +3');

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
    if (!sessionStorage.getItem('hvkeep-init')) {
      sessionStorage.setItem('hvkeep-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const dawn = (opts) => page.evaluate((o) => {
    const lines = [];
    const realLog = log;
    log = function (s) { lines.push(String(s)); realLog(s); };
    const real = Math.random;
    Math.random = () => 0.99;
    G.dog = o.dog;
    G.dogMetDay = 99;
    G.dogHungry = false;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days + 5;
    G.forecast = 'clear';
    G.weather = 'clear';
    G.season = 0;
    G.snapUntil = null;
    G.warmth = o.warmth;
    G.morale = 50;
    G.food = o.food;
    G.health = 90;
    G.population = 1;
    G.rep = 0;
    G.workers.cook = false;
    G.workers.scrapper = false;
    G.structures.garden = false;
    G.structures.coats = false;
    G.structures.soup_kitchen = false;
    G.structures.pantry = false;
    onNewDay();
    Math.random = real;
    log = realLog;
    return {
      warmth: G.warmth,
      morale: G.morale,
      food: G.food,
      hungry: !!G.dogHungry,
      held: lines.some(s => /fire held/i.test(s)),
      hungryLog: lines.some(s => /curls up hungry/i.test(s)),
      log: lines.join('\n'),
    };
  }, opts);

  // C. fed Biscuit pushes a 47-warmth wake over 50
  const fed = await dawn({ dog: 2, warmth: 55, food: 10 });
  ok(fed.warmth === 50 && fed.held && fed.morale === 51 && !fed.hungry,
    `fed keep: 55 → 47 +3 = 50, fire held, morale 50 +2 −3 +2 = 51 (warmth=${fed.warmth}, morale=${fed.morale}, held=${fed.held})`);
  ok(fed.food === 7.5, `keep still spends its bowl after the drain (food=${fed.food})`);

  // D. no Biscuit — the fire-held check is unchanged
  const none = await dawn({ dog: 1, warmth: 55, food: 10 });
  ok(none.warmth === 47 && !none.held && none.morale === 47,
    `no Biscuit: 55 → 47, no fire held, plain −3 (warmth=${none.warmth}, morale=${none.morale}, held=${none.held})`);

  // E. hungry — scraps already gone after the night's drain
  const hungry = await dawn({ dog: 2, warmth: 55, food: 1 });
  ok(hungry.warmth === 47 && !hungry.held && hungry.hungry && hungry.hungryLog,
    `hungry keep: no +3, no fire held, he curls up hungry (warmth=${hungry.warmth}, held=${hungry.held})`);

  // F. already warm — fire held still, keep warmth still stacks
  const warm = await dawn({ dog: 2, warmth: 80, food: 10 });
  ok(warm.warmth === 75 && warm.held && warm.morale === 51,
    `already warm: 80 −8 +3 = 75, fire held still (warmth=${warm.warmth}, morale=${warm.morale})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
