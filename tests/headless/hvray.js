/* HV-99 — Old Ray counted you as a friend, and the log called him Old.
 *
 * bumpRegular writes: "Old Ray counts you as a friend now — " plus
 * d.name.split(' ')[0] plus the perk. Marisol and Dee are one word.
 * Old Ray is two. The friendship line becomes "Old points out which
 * dumpsters are worth the walk." The perk is Ray's. The name is not.
 *
 * Not HV-7 (the regulars themselves — hvregulars proves Marisol's
 * friendship log and Ray's empty-haul perk). Not HV-77 (#739, Borrow
 * from Ray). Not HV-98 (#769, Dee always stops). This is the name.
 *
 * This suite is write-first and source-driven.
 *
 * A. Source: the friendship clause uses the last name token, not [0].
 *    His name is still Old Ray. ui.js is not touched.
 * B. A fifth Rest befriends Ray; the log says "Ray points", not
 *    "Old points". Marisol's friendship line still uses Marisol.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const cfg  = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const ui   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const bumpAt = loop.indexOf('function bumpRegular(id){');
const nextAt = loop.indexOf('function regularFavorsAtDawn(){');
const bump = bumpAt >= 0 && nextAt > bumpAt ? loop.slice(bumpAt, nextAt) : '';
const ray = /id:'ray'[\s\S]*?perk:'([^']+)'/.exec(cfg);

ok(bumpAt >= 0 && /counts you as a friend now/.test(bump),
  'the friendship log still lives in bumpRegular');
ok(/name:'Old Ray'/.test(cfg) && ray && /dumpsters/.test(ray[1]),
  'his name is still Old Ray — the perk is still the dumpsters');
ok(/split\(' '\)\.pop\(\)/.test(bump),
  'HV-99: the friendship clause uses the last name token, not [0]');
ok(!/split\(' '\)\[0\]/.test(bump),
  'split()[0] is gone — that is what called him Old');
ok(!/bumpRegular/.test(ui) && !/Old points/.test(ui),
  'ui.js is not this ticket — it still only draws the roster');

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
    try { localStorage.setItem('hv-intro-seen', '1'); } catch (e) {}
    try { localStorage.removeItem('homeless_village_v1'); } catch (e) {}
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => ({
    intro: !!(document.getElementById('intro-modal') && document.getElementById('intro-modal').classList.contains('open')),
    name: (regularDef('ray') || {}).name,
    perk: (regularDef('ray') || {}).perk,
  }));
  ok(!boot.intro && boot.name === 'Old Ray',
    'a returning camp can rest by Old Ray — not behind the crash course');
  ok(/dumpsters/.test(boot.perk || ''),
    'the perk is still his — points out which dumpsters are worth the walk');

  const rayFriend = await page.evaluate(() => {
    G.regulars = { marisol: 0, ray: 4, dee: 0 };
    G.cooldowns = {};
    const heard = [];
    const prev = log;
    log = function (msg) { heard.push(String(msg)); prev(msg); };
    finishAction(ACTIONS.find(a => a.id === 'rest'));
    log = prev;
    return {
      a: G.regulars.ray,
      log: heard.join(' '),
    };
  });
  ok(rayFriend.a === 5 && /counts you as a friend/.test(rayFriend.log),
    'a fifth Rest still befriends Old Ray');
  ok(/Ray points/.test(rayFriend.log),
    'HV-99: the friendship log names Ray, not the honorific');
  ok(!/Old points/.test(rayFriend.log),
    'HV-99: the log does not call him Old');

  const mari = await page.evaluate(() => {
    G.regulars = { marisol: 4, ray: 5, dee: 0 };
    G.cans = 30; G.cooldowns = {};
    const heard = [];
    const prev = log;
    log = function (msg) { heard.push(String(msg)); prev(msg); };
    finishAction(ACTIONS.find(a => a.id === 'trade'));
    log = prev;
    return { a: G.regulars.marisol, log: heard.join(' ') };
  });
  ok(mari.a === 5 && /Marisol sends leftovers/.test(mari.log),
    'isolation: Marisol\'s friendship line still uses Marisol');

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
