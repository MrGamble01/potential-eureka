/*
 * HV-236 — Theft said trust no one, then Word never faded.
 *
 * The card is titled Theft. The body says someone raided your stash
 * in the night. Trust no one. Goods leave. Morale drops. Word on
 * the Street — the neighborhood's trust — never moved.
 *
 * Dawn's ordinary −1 fade is not this card. Gentrify's harassment
 * Word fade is HV-216 / #909 (addRep(-5)); Busk thinning on that
 * card is HV-234 / #928. This card is the raid's own −3. Trade
 * still paying after a raid is not this card. Biscuit, the stash,
 * and the street light still cut the take.
 *
 *  A. Source: the theft effect names Word.
 *  B. The card still says trust no one.
 *  C. A raid fades Word. Goods still leave.
 *  D. Gentrify still keeps its own −5 fade, not this −3.
 *  E. Trade still pays after a raid.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives triggerEvent() on the production theft card.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const theftAt = loop.indexOf("id:'theft'");
const injuryAt = loop.indexOf("id:'injury'");
const theftBlock = theftAt >= 0 && injuryAt > theftAt ? loop.slice(theftAt, injuryAt) : '';
const gentrifyAt = loop.indexOf("id:'gentrify'");
const sicknessAt = loop.indexOf("id:'sickness'");
const gentrifyBlock = gentrifyAt >= 0 && sicknessAt > gentrifyAt ? loop.slice(gentrifyAt, sicknessAt) : '';

ok(theftAt >= 0 && /Trust no one/.test(theftBlock),
  'the theft card still says trust no one');
ok(/addRep\s*\(\s*-3\s*\)/.test(theftBlock),
  'HV-236: the theft effect fades Word');
ok(/homeless-village\/js\/ui\.js/.test(loop) === false && !/homeless-village\/js\/ui\.js/.test(player),
  'the fade lives on the theft card — ui.js is not this ticket');
ok(gentrifyAt >= 0 && /addRep\s*\(\s*-5\s*\)/.test(gentrifyBlock) && !/addRep\s*\(\s*-3\s*\)/.test(gentrifyBlock),
  'gentrify still keeps HV-216\'s −5 fade, not this −3');

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
    if (!sessionStorage.getItem('hvtrust-init')) {
      sessionStorage.setItem('hvtrust-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const raid = await t(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'theft');
    const real = Math.random;
    Math.random = () => 0.5;
    G.dog = 0;
    G.structures.stash = false;
    if (G.petitions) G.petitions.streetlight = false;
    G.cans = 20; G.food = 20; G.scraps = 20;
    G.morale = 50; G.rep = 20;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(ev, false);
    Math.random = real;
    return {
      title: document.getElementById('ev-title').textContent,
      body: document.getElementById('ev-body').textContent,
      rep: G.rep,
      cans: G.cans, food: G.food, scraps: G.scraps,
      morale: G.morale,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n'),
    };
  });
  ok(raid.title === 'Theft' && /trust no one/i.test(raid.body),
    `the card still titles itself Theft and says trust no one (${raid.title})`);
  ok(raid.rep === 17,
    `a raid fades Word 20 → 17 (now ${raid.rep})`);
  ok(raid.cans < 20 && raid.food < 20 && raid.scraps < 20,
    `goods still leave (cans ${raid.cans}, food ${raid.food}, scraps ${raid.scraps})`);
  ok(raid.morale < 50,
    `morale still drops (${raid.morale})`);
  ok(/Trust frays|Word fades|could not keep/.test(raid.log),
    'the feed names the frayed trust');

  const gentrify = await t(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'gentrify');
    const real = Math.random;
    Math.random = () => 0.5;
    G.rep = 20; G.morale = 50; G.goodwill = 10;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(ev, false);
    Math.random = real;
    return { rep: G.rep, morale: G.morale, goodwill: G.goodwill };
  });
  ok(gentrify.rep === 15 && gentrify.morale < 50 && gentrify.goodwill < 10,
    `gentrify still keeps its own −5 fade, not this −3 (rep ${gentrify.rep})`);

  const trade = await t(() => {
    G.cans = 6; G.food = 0; G.rep = 10;
    finishAction({ id: 'trade', time: 2000, cooldown: 18000 });
    return { cans: G.cans, food: G.food, rep: G.rep };
  });
  ok(trade.cans === 3 && trade.food === 2 && trade.rep === 11,
    `Trade still pays after a raid (${trade.cans} cans, ${trade.food} food, rep ${trade.rep})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
