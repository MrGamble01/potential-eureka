/*
 * HV-70 — Found $5 paid a random handful.
 *
 * The card title is "Found $5". The effect was G.goodwill+=rand(3,6)
 * and the log said "a few dollars. +goodwill." Three of the four
 * rolls are not five. Goodwill is the camp's money; the title is
 * the amount.
 *
 *  A. Source: found_money adds exactly 5 goodwill.
 *  B. The card is still titled Found $5.
 *  C. A roll that used to pay 3 now pays 5.
 *  D. A roll that used to pay 6 now pays 5.
 *  E. Morale still rises. Kind Stranger is still a food drop.
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

const src = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const block = /id:'found_money'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(src);
ok(!!block, 'found_money event is still in gameloop.js');
ok(block && /G\.goodwill\s*\+=\s*5/.test(block[1]) && !/rand\s*\(\s*3\s*,\s*6\s*\)/.test(block[1]),
  'HV-70: found_money effect adds exactly 5 goodwill');
ok(/title:'Found \$5'/.test(src), 'the card is still titled Found $5');

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
    if (!sessionStorage.getItem('hvfive-init')) {
      sessionStorage.setItem('hvfive-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const pay = (roll) => page.evaluate((r) => {
    const ev = EVENTS_GOOD.find(e => e.id === 'found_money');
    const real = Math.random;
    Math.random = () => r;
    G.goodwill = 10; G.morale = 50;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(ev, true);
    Math.random = real;
    return {
      goodwill: G.goodwill,
      morale: G.morale,
      banner: document.getElementById('ev-title').textContent,
      body: document.getElementById('ev-body').textContent,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  }, roll);

  // rand(3,6) with Math.random=0 → 3; with 0.99 → 6
  const low = await pay(0);
  ok(low.banner === 'Found $5', `the card still titles itself Found $5 (${low.banner})`);
  ok(/crumpled bill/i.test(low.body), 'the body is still a crumpled bill');
  ok(low.goodwill === 15, `a low roll pays +5, not +3 (10 → ${low.goodwill})`);
  ok(low.morale > 50, `morale still rises (${low.morale})`);
  ok(/\+5/.test(low.log),
    `the log names the five (${low.log.slice(-80)})`);

  const high = await pay(0.99);
  ok(high.goodwill === 15, `a high roll pays +5, not +6 (10 → ${high.goodwill})`);

  const stranger = await t(() => {
    const ev = EVENTS_GOOD.find(e => e.id === 'kind_stranger');
    const real = Math.random;
    Math.random = () => 0.5;
    G.goodwill = 10; G.food = 0;
    triggerEvent(ev, true);
    Math.random = real;
    return { goodwill: G.goodwill, food: G.food };
  });
  ok(stranger.goodwill === 10 && stranger.food > 0,
    `Kind Stranger is still a food drop, not five goodwill (food=${stranger.food})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
