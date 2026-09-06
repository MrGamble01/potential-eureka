/*
 * HV-216 — Gentrification said harassment from locals is increasing,
 * then Word on the Street never faded.
 *
 * The card body is "New development nearby. Harassment from locals
 * is increasing." The effect drops morale and goodwill, then walks
 * away. Word on the Street is the neighborhood's name for you —
 * Known, Respected, Beloved. Locals getting more hostile never
 * moved that meter. The block still counted you the same.
 *
 *  A. Source: the gentrify effect calls addRep with a loss. The card
 *     still says harassment is increasing. ui.js is not this ticket.
 *  B. A Known camp (26) drops to A Stranger (21) and the fade logs.
 *  C. Morale and goodwill still fall. Theft / Illness / City Sweep
 *     do not steal the Word latch.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives triggerEvent() on the production event.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const gentAt = loop.indexOf("id:'gentrify'");
const gent = gentAt >= 0 ? loop.slice(gentAt, gentAt + 500) : '';

ok(gentAt >= 0 && /Harassment from locals is increasing/.test(gent),
  'the card still says harassment from locals is increasing');
ok(/addRep\s*\(\s*-/.test(gent),
  'HV-216: Gentrification fades Word on the Street');
ok(!/function buildActionUI/.test(loop) && !/gentrify/.test(ui),
  'the Word fade lives in gameloop — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvgentre-init')) {
      sessionStorage.setItem('hvgentre-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const seam = await t(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'gentrify');
    const real = Math.random;
    Math.random = () => 0.5;
    G.rep = 26; G.morale = 80; G.goodwill = 20;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(ev, false);
    Math.random = real;
    return {
      banner: document.getElementById('ev-title').textContent,
      body: document.getElementById('ev-body').textContent,
      rep: G.rep,
      tier: repTier(),
      morale: G.morale,
      goodwill: G.goodwill,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  });
  ok(seam.banner === 'Gentrification',
    `the card still titles itself Gentrification (${seam.banner})`);
  ok(/Harassment from locals is increasing/.test(seam.body),
    'the body still says harassment from locals is increasing');
  ok(seam.rep === 21 && seam.tier === 0,
    `a Known camp of 26 drops to A Stranger at 21 (rep=${seam.rep}, tier=${seam.tier})`);
  ok(/Word fades/.test(seam.log) && /A Stranger/.test(seam.log),
    `the fade names Word on the Street (${seam.log.slice(-120)})`);
  ok(seam.morale < 80 && seam.goodwill < 20,
    `morale and goodwill still fall (${seam.morale}, ${seam.goodwill})`);

  const other = await t(() => {
    const fire = (id) => {
      const ev = EVENTS_BAD.find(e => e.id === id);
      G.rep = 40; G.morale = 80; G.goodwill = 20; G.health = 80;
      G.food = 10; G.cans = 10; G.scraps = 10;
      G.structures.tent = false; G.structures.garden = false;
      G.structures.soup_kitchen = false; G.structures.workbench = false;
      G.garageCover = false; G.packedUp = false;
      G.dog = 0;
      G.lastEventDay = G.days;
      triggerEvent(ev, false);
      return G.rep;
    };
    return { theft: fire('theft'), sick: fire('sickness'), sweep: fire('sweep') };
  });
  ok(other.theft === 40 && other.sick === 40 && other.sweep === 40,
    `Theft / Illness / City Sweep leave Word standing (${other.theft}, ${other.sick}, ${other.sweep})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
