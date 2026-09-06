/*
 * HV-121 — Play the Bridge Ballad said the hat fills, then only
 * paid food.
 *
 * Tooltip and success log: "the hat by the fire always fills
 * before the last verse." Elsewhere in this game a hat on the
 * corner is goodwill (Busk, panhandle coins). finishAction only
 * added the food dish. Goodwill did not move.
 *
 * Distinct from HV-19 Busk (a daily set, #775 / #793) and from
 * HV-113's bench "something warm" (#797) — this is the hat.
 *
 *  A. Source: the ballad still promises a filling hat, and the
 *     payout names goodwill.
 *  B. Live: a first playing still pays the food dish (hvballad C).
 *  C. The hat is goodwill — the purse rises and the log names it.
 *  D. A second playing the same session still refuses; food and
 *     goodwill hold.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction({id:'ballad'}). No ui.js.
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
const balladTip = /id:'ballad'[\s\S]{0,400}?tooltip:'([^']+)'/.exec(cfg);
const balladFn = /a\.id==='ballad'[\s\S]{0,900}?else if\(a\.id==='can'\)/.exec(player);

ok(balladTip && /hat by the fire/i.test(balladTip[1]),
  'the ballad tooltip still promises the hat fills');
ok(balladFn && /goodwill/i.test(balladFn[0]) && /HVSONG_HAT|hat/i.test(cfg + balladFn[0]),
  'finishAction names goodwill when the hat fills');

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
    if (!sessionStorage.getItem('hvhat-init')) {
      sessionStorage.setItem('hvhat-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-storyhour');
      localStorage.removeItem('hv-song');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const first = await page.evaluate(() => {
    saveHvStory({ tellings: 3 });
    saveHvSong({ plays: 0 });
    balladPlayed = false;
    G.food = 10;
    G.goodwill = 0;
    const dish = balladDish();
    finishAction({ id: 'ballad' });
    const feed = document.getElementById('log-feed');
    const log = feed ? feed.innerText : '';
    return {
      dish,
      food: G.food,
      gw: G.goodwill,
      plays: loadHvSong().plays,
      log,
      hat: typeof HVSONG_HAT === 'number' ? HVSONG_HAT : null,
    };
  });
  ok(first.dish === 10 && first.food === 20 && first.plays === 1,
    `the food dish still pays (10→20, plays=${first.plays})`);
  ok(first.hat === 3 && first.gw === 3 && /hat/i.test(first.log) && /goodwill|🩶/.test(first.log),
    `the hat is goodwill — purse ${first.gw}, HVSONG_HAT=${first.hat}, log names it`);

  const again = await page.evaluate(() => {
    const f0 = G.food, g0 = G.goodwill, p0 = loadHvSong().plays;
    finishAction({ id: 'ballad' });
    return { food: G.food, gw: G.goodwill, plays: loadHvSong().plays, f0, g0, p0 };
  });
  ok(again.food === again.f0 && again.gw === again.g0 && again.plays === again.p0,
    `a second playing the same session still refuses (food ${again.food}, gw ${again.gw}, plays ${again.plays})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
