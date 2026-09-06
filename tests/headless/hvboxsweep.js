/* HV-184 — the Free Pantry said a little box on a post,
 * then the sweep left it standing.
 *
 * The pantry recipe promises a box on a post: take what you need,
 * leave what you can. City Sweep promises they destroy shelters and
 * confiscate supplies. The sweep takes the tent, the kitchen, the
 * bench, and the garden. The box on the post never moves. A generous
 * dawn still fills it after the trucks leave.
 *
 * The sweep now kicks the box over. Tent and garden still fall. The
 * buried stash still hides. Theft still leaves the box. A dawn with
 * no box leaves nothing.
 *
 *  A. Source: the sweep effect assigns G.structures.pantry false;
 *     ui.js does not.
 *  B. The pantry still promises a box on a post. The sweep still
 *     promises they destroy shelters.
 *  C. A pinned sweep with a live pantry takes it. The log names the box.
 *  D. A generous dawn after the sweep leaves nothing.
 *  E. Tent and garden still fall. The buried stash still hides.
 *  F. Theft still leaves the pantry (control — different event).
 *  Z. Zero page errors.
 *
 * Hook-free. Drives the production sweep effect.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const block = /id:'sweep'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(loop);
ok(!!block, 'city sweep is still in gameloop.js');
ok(block && /G\.structures\.pantry\s*=\s*false/.test(block[1]),
  'HV-184: sweep effect kicks over the pantry box');
ok(/id:'pantry'[\s\S]{0,220}?A little box on a post/.test(cfg),
  'the pantry still promises a box on a post');
ok(/destroy shelters and confiscate supplies/.test(loop),
  'the sweep still promises they destroy shelters');
ok(!/G\.structures\.pantry\s*=\s*false/.test(ui),
  'ui.js untouched — the take lives on the sweep effect');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvboxsweep-init')) {
      sessionStorage.setItem('hvboxsweep-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2200);

  const t = fn => page.evaluate(fn);

  // C — pinned sweep with a live pantry
  const hit = await t(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'sweep');
    G.structures.pantry = true;
    G.structures.tent = true;
    G.structures.garden = true;
    G.structures.stash = true;
    G.structures.soup_kitchen = false;
    G.structures.workbench = false;
    G.packedUp = false;
    G.garageCover = false;
    G.scraps = 20; G.food = 20; G.morale = 50;
    ev.effect();
    return {
      pantry: !!G.structures.pantry,
      tent: !!G.structures.tent,
      garden: !!G.structures.garden,
      stash: !!G.structures.stash,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  });
  ok(hit.pantry === false,
    `HV-184: the sweep kicks over the pantry box (pantry ${hit.pantry})`);
  ok(/pantry|box/i.test(hit.log),
    `the log names the box (${hit.log.slice(-100)})`);

  // D — a generous dawn after the sweep leaves nothing
  const dawn = await t(() => {
    const mr = Math.random;
    Math.random = () => 0;
    G.food = 10; G.pantryFills = 0;
    pantryAtDawn();
    Math.random = mr;
    return { food: G.food, fills: G.pantryFills || 0, pantry: !!G.structures.pantry };
  });
  ok(dawn.pantry === false && dawn.food === 10 && dawn.fills === 0,
    `a generous dawn after the sweep leaves nothing (${dawn.food}/${dawn.fills})`);

  // E — tent and garden still fall; the hole is never found
  ok(hit.tent === false && hit.garden === false,
    'tent and garden still fall');
  ok(hit.stash === true,
    'a sweep never finds the buried stash');

  // F — theft still leaves the pantry
  const theft = await t(() => {
    G.structures.pantry = true;
    G.cans = 20; G.food = 20; G.scraps = 20;
    EVENTS_BAD.find(e => e.id === 'theft').effect();
    return { pantry: !!G.structures.pantry };
  });
  ok(theft.pantry === true,
    'theft still leaves the pantry box (different event)');

  await page.screenshot({ path: '/tmp/hvboxsweep.png', fullPage: true });

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
