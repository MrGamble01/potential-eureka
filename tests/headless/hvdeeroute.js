/* HV-187 — Dee said she walks home from night shifts,
 * then a midday panhandle still counted as her route.
 *
 * Dee's roster line is player-facing: she "walks home from night
 * shifts at County" and you "Panhandle her route — she always stops."
 * A successful panhandle bumped her at any hour. Midday is not the
 * walk home from a night shift. The coins still land; she does not.
 * Dawn and night still catch her. The rain bet is a sit-down with
 * Dee, not her route, and still counts. ui.js untouched.
 *
 *  A. Source: Dee's who/how still name the night-shift walk home.
 *  B. Source: the panhandle success path reads her route (timeOfDay
 *     / deeOnRoute). ui.js does not.
 *  C. Live: a pinned midday success pays coins and leaves Dee at 0.
 *     The log names the shift.
 *  D. The same roll at dawn (and at night) bumps her to 1.
 *  E. The rain bet still bumps her at midday.
 *  Z. Zero page errors.
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

const pan = /a\.id==='panhandle'[\s\S]*?} else if\(a\.id==='rest'\)/.exec(player);
const body = pan ? pan[0] : '';

ok(/id:'dee'[\s\S]{0,200}?walks home from night shifts/.test(cfg)
  && /Panhandle her route/.test(cfg),
  'Dee still walks home from night shifts; her route is still the how');
ok(/function deeOnRoute/.test(cfg) || /timeOfDay/.test(body),
  'HV-187: panhandle success reads Dee\'s night-shift route');
ok(body && /bumpRegular\('dee'\)/.test(body),
  'a successful panhandle on her route still bumps Dee');
ok(!/deeOnRoute/.test(ui) && !/night shift/.test(ui),
  'ui.js untouched — the route gate lives on the action');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvdeeroute-init')) {
      sessionStorage.setItem('hvdeeroute-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2200);

  const panAt = (tod, known) => page.evaluate(({ tod, known }) => {
    const mr = Math.random;
    Math.random = () => 0.1;
    G.timeOfDay = tod;
    G.weather = 'clear';
    G.season = 0;
    G.dog = 0;
    G.rep = 0;
    G.mural = 0;
    G.snapUntil = null;
    G.structures.awning = false;
    G.regulars.dee = known ? 1 : 0;
    G.goodwill = 10;
    finishAction({ id: 'panhandle', cooldown: 0, time: 0 });
    Math.random = mr;
    return {
      dee: G.regulars.dee,
      gw: G.goodwill,
      label: ['Dawn','Morning','Midday','Afternoon','Dusk','Night'][Math.floor(tod * 6) % 6],
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  }, { tod, known });

  // C — midday is not the walk home
  const noon = await panAt(0.40, true);
  ok(noon.label === 'Midday' && noon.gw > 10,
    `midday still pays coins (${noon.label}, gw ${noon.gw})`);
  ok(noon.dee === 1,
    `HV-187: a midday success does not count as Dee's route (dee ${noon.dee})`);
  ok(/shift|route|walk home/i.test(noon.log),
    `the log names the shift (${noon.log.slice(-90)})`);

  // D — dawn and night still catch her
  const dawn = await panAt(0.05, false);
  ok(dawn.label === 'Dawn' && dawn.dee === 1,
    `a dawn success still bumps Dee (${dawn.label}, dee ${dawn.dee})`);
  const night = await panAt(0.90, false);
  ok(night.label === 'Night' && night.dee === 1,
    `a night success still bumps Dee (${night.label}, dee ${night.dee})`);

  // E — the rain bet is a sit-down, not her route
  const bet = await page.evaluate(() => {
    G.timeOfDay = 0.40;
    G.regulars.dee = 0;
    G.goodwill = 10;
    G.rainBetDay = -9;
    finishAction({ id: 'rainbet', cooldown: 0, time: 0 });
    return { dee: G.regulars.dee, gw: G.goodwill };
  });
  ok(bet.dee === 1 && bet.gw === 8,
    `the rain bet still bumps Dee at midday (dee ${bet.dee}, gw ${bet.gw})`);

  await page.screenshot({ path: '/tmp/hvdeeroute.png', fullPage: true });

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
