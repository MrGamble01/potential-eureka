/* HV-186 — Gentrification said harassment is increasing,
 * then Hand out flyers still paid the kind-owner take.
 *
 * The Gentrification card promises: "Harassment from locals is
 * increasing." The bulletin posting promises: "A local shop pays a
 * little, and the owner is kind. +3 goodwill, +4 morale."
 * The card was a one-shot morale/goodwill hit. The flyer job never
 * read it. A player who watched the block turn hostile and then
 * walked the shop's papers still got the kind-owner lift.
 *
 * The card now stamps the day. Flyers still pay the shop's +3; the
 * +4 kindness is gone until dawn. Depot, scrapyard and the dog walk
 * still pay. A quiet day still gets the kind owner. ui.js untouched.
 *
 *  A. Source: the gentrify effect stamps G.gentrifyDay; the odd-job
 *     finisher reads it on flyers. ui.js does not.
 *  B. Source: both promises still exist.
 *  C. Live: after the card, flyers pay +3🩶 and +0😊. The log names
 *     the missing kindness.
 *  D. A quiet day still pays +3 / +4.
 *  E. Depot and the scrapyard still pay after the card.
 *  F. The next flyers day (gentrifyDay !== today) is kind again.
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
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const save = fs.readFileSync(path.join(ROOT, 'homeless-village/js/save.js'), 'utf8');

const gent = /id:'gentrify'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(loop);
const odd = /else if\(a\.id==='oddjob'\)\{([\s\S]*?)\n  \} else if\(a\.id==='mural'\)/.exec(player);
const body = odd ? odd[1] : '';

ok(!!gent, 'gentrification is still in gameloop.js');
ok(gent && /G\.gentrifyDay\s*=\s*G\.days/.test(gent[1]),
  'HV-186: the card stamps G.gentrifyDay so dawn owns the hostility');
ok(/Harassment from locals is increasing/.test(loop),
  'the card still promises harassment is increasing');
ok(/id:'flyers'[\s\S]{0,180}?the owner is kind/.test(cfg),
  'the flyer posting still promises the owner is kind');
ok(body && /flyers/.test(body) && /gentrifyDay/.test(body),
  'HV-186: the odd-job finisher reads gentrifyDay on flyers');
ok(!/gentrifyDay/.test(ui),
  'ui.js untouched — the kindness cut lives on the job');
ok(/gentrifyDay/.test(save),
  'loadGame migrates a save that never wrote gentrifyDay');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvgentfly-init')) {
      sessionStorage.setItem('hvgentfly-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2200);

  const t = fn => page.evaluate(fn);

  const runFlyers = (days, afterCard) => page.evaluate(({ days, afterCard }) => {
    G.days = days;
    G.oddJobDay = -1;
    G.weather = 'clear';
    G.structures.toolbox = false;
    if (afterCard) {
      EVENTS_BAD.find(e => e.id === 'gentrify').effect();
    } else {
      G.gentrifyDay = -1;
    }
    const before = { gw: G.goodwill, mo: G.morale };
    const j = todaysJob();
    finishAction(oddJobAction());
    return {
      job: j.id,
      desc: j.desc,
      dGw: G.goodwill - before.gw,
      dMo: G.morale - before.mo,
      day: G.oddJobDay,
      stamp: G.gentrifyDay,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  }, { days, afterCard });

  // C — the card, then the shop
  const hostile = await runFlyers(1, true);
  ok(hostile.job === 'flyers' && /owner is kind/i.test(hostile.desc),
    `day 1 still posts flyers (${hostile.job})`);
  ok(hostile.stamp === 1,
    `the card stamped today (gentrifyDay ${hostile.stamp})`);
  ok(hostile.dGw === 3 && hostile.dMo === 0 && hostile.day === 1,
    `HV-186: the shop still pays +3, the kindness is gone (Δ ${hostile.dGw}/${hostile.dMo})`);
  ok(/kind|harass|hostile/i.test(hostile.log),
    `the log names the missing kindness (${hostile.log.slice(-100)})`);

  // D — a quiet day still gets the kind owner
  const quiet = await runFlyers(1, false);
  ok(quiet.dGw === 3 && quiet.dMo === 4,
    `a quiet day still pays +3 / +4 (${quiet.dGw}/${quiet.dMo})`);

  // E — other postings still pay after the card
  const depot = await t(() => {
    G.days = 0; G.oddJobDay = -1; G.gentrifyDay = 0; G.goodwill = 10;
    finishAction(oddJobAction());
    return { job: todaysJob().id, gw: G.goodwill };
  });
  ok(depot.job === 'depot' && depot.gw === 15,
    `the depot still pays after the card (${depot.gw})`);
  const scrap = await t(() => {
    G.days = 3; G.oddJobDay = -1; G.gentrifyDay = 3; G.scraps = 0; G.cans = 0;
    finishAction(oddJobAction());
    return { job: todaysJob().id, scraps: G.scraps, cans: G.cans };
  });
  ok(scrap.job === 'scrapyd' && scrap.scraps === 5 && scrap.cans === 2,
    `the scrapyard still hauls after the card (${scrap.scraps}/${scrap.cans})`);

  // F — a later flyers day is kind again
  const later = await runFlyers(6, false);
  ok(later.job === 'flyers' && later.dGw === 3 && later.dMo === 4,
    `the next flyers day is kind again (${later.dGw}/${later.dMo})`);

  await page.screenshot({ path: '/tmp/hvgentfly.png', fullPage: true });

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
