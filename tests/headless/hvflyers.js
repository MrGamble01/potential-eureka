/*
 * HV-156 — Hand out flyers said the owner is kind, then Marisol
 * never heard it.
 *
 * The bulletin posting is: "A local shop pays a little, and the
 * owner is kind. +3 goodwill, +4 morale." Marisol is the block's
 * named shop owner — she runs the taquería on the corner, and
 * kindness is how this game grows a regular (trade already calls
 * bumpRegular('marisol')). finishAction's odd-job branch paid the
 * numbers and walked away. Affinity stayed 0. The roster still
 * said ???.
 *
 * Not #809 (a filled favor said they won't forget). Not #833 (a
 * friend came by to paint). Not #844 (the depot's morning shift).
 * This ticket is the flyers card's unused word: kind.
 *
 *  A. Source: the posting still says the owner is kind; the
 *     odd-job branch calls bumpRegular('marisol'); ui.js is
 *     untouched.
 *  B. Day 1 is flyers. A set pays +3 goodwill, +4 morale, and
 *     Marisol moves 0 → 1. The roster learns her name.
 *  C. Depot / garden / scrapyard / dog-walk do not touch her.
 *  D. Trade still does. A mural visit still does not (HV-145).
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

const flyers = /id:'flyers'[\s\S]*?desc:'([^']+)'/.exec(cfg);
ok(!!flyers && /owner is kind/i.test(flyers[1]),
  'the Hand out flyers posting still says the owner is kind');

const odd = /else if\(a\.id==='oddjob'\)\{([\s\S]*?)\} else if\(a\.id==='mural'\)/.exec(player);
ok(!!odd, 'finishAction still owns the odd-job branch');
ok(odd && /bumpRegular\s*\(\s*['"]marisol['"]\s*\)/.test(odd[1]),
  'HV-156: the odd-job branch calls bumpRegular(\'marisol\') for the kind owner');
ok(!/bumpRegular\s*\(\s*['"]marisol['"]\s*\)/.test(ui),
  'ui.js is untouched — no Marisol bump lives in the HUD');

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
    if (!sessionStorage.getItem('hvflyers-init')) {
      sessionStorage.setItem('hvflyers-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  // B — flyers on day 1
  const flyersLive = await t(() => {
    G.days = 1;
    G.oddJobDay = -9;
    G.goalIndex = GOALS.length;
    G.regulars = { marisol: 0, ray: 0, dee: 0 };
    G.goodwill = 10;
    G.morale = 50;
    G.rep = 10;
    const id = todaysJob().id;
    finishAction(oddJobAction());
    const row = Array.from(document.querySelectorAll('#regulars-list .worker-row'))
      .map(d => d.textContent).join(' | ');
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' ');
    return {
      id,
      marisol: G.regulars.marisol,
      ray: G.regulars.ray,
      dee: G.regulars.dee,
      gw: G.goodwill,
      morale: G.morale,
      row,
      log,
    };
  });
  ok(flyersLive.id === 'flyers', `day 1 posts Hand out flyers (${flyersLive.id})`);
  ok(flyersLive.gw === 13 && flyersLive.morale === 54,
    `the posting still pays +3 goodwill, +4 morale (${flyersLive.gw}/${flyersLive.morale})`);
  ok(flyersLive.marisol === 1 && flyersLive.ray === 0 && flyersLive.dee === 0,
    `HV-156: the kind owner is Marisol — affinity 0 → 1 (now ${flyersLive.marisol})`);
  ok(/Marisol/.test(flyersLive.row) && /Marisol/.test(flyersLive.log),
    'the roster and the log name Marisol after the flyers run');

  // C — the other four postings do not borrow her kindness
  const others = await t(() => {
    const out = {};
    [0, 2, 3, 4].forEach((d) => {
      G.days = d;
      G.oddJobDay = -9;
      G.regulars = { marisol: 0, ray: 0, dee: 0 };
      G.goodwill = 10;
      G.morale = 50;
      G.scraps = 0;
      G.cans = 0;
      G.food = 0;
      const id = todaysJob().id;
      finishAction(oddJobAction());
      out[id] = G.regulars.marisol;
    });
    return out;
  });
  ok(others.depot === 0 && others.gardenh === 0 && others.scrapyd === 0 && others.dogwalk === 0,
    `depot / garden / scrapyard / dog-walk leave Marisol at 0 (${JSON.stringify(others)})`);

  // D — trade still names her; a mural visit still does not
  const trade = await t(() => {
    G.regulars = { marisol: 0, ray: 0, dee: 0 };
    G.cans = 6;
    finishAction(ACTIONS.find(a => a.id === 'trade'));
    return G.regulars.marisol;
  });
  ok(trade === 1, `Trade Goods still bumps Marisol (${trade})`);

  const mural = await t(() => {
    G.regulars = { marisol: 5, ray: 0, dee: 0 };
    G.rep = 30;
    G.mural = 0;
    G.muralDay = -9;
    G.scraps = 10;
    G.morale = 50;
    finishAction(muralAction());
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' ');
    return { mural: G.mural, marisol: G.regulars.marisol, painted: /came by to paint/.test(log) };
  });
  ok(mural.mural === 1 && mural.marisol === 5,
    `a friend who came by to paint still does not take this bump (${mural.marisol})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
