/* HV-80 — Dena's Case Worker card fired on goodwill alone.
 *
 * Sold copy (ARC_EVENTS.card): she looks around and sees "people fed,
 * fire going, something like order." The intro log says she visits
 * camps that "hold together." Stage 0 only required day 10 + 15
 * goodwill, so a starving, freezing, solo camp still got the card.
 *
 * This suite is write-first and source-driven.
 *
 *  A. Card copy still sells fed / fire / order. checkArc's first gate
 *     reads leftover food and warmth, not only days + goodwill.
 *     Stage 1 (kitchen + pop 4) and stage 2 (goodwill 25 + morale)
 *     stay intact. ui.js is not this ticket.
 *  B. Live: day 10, goodwill 20, empty pot + dying fire → no card.
 *     Leftover food with a dying fire still no. Same days/goodwill
 *     with leftover food, fire ≥ 50, two people → card, arcStage 1.
 *     Goodwill 14 and a one-person camp stay at stage 0.
 *  C. Dawn drain: leftover food after breakfast still qualifies;
 *     an empty pot after drain does not.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives checkArc() and onNewDay() on the live page.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const main = fs.readFileSync(path.join(ROOT, 'homeless-village/js/main.js'), 'utf8');
const ui   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const cardAt = loop.indexOf("id:'arc_card'");
const card = cardAt >= 0 ? loop.slice(cardAt, cardAt + 700) : '';
const checkAt = loop.indexOf('function checkArc(){');
const check = checkAt >= 0 ? loop.slice(checkAt, checkAt + 700) : '';

ok(cardAt >= 0 && /The Case Worker/.test(card),
  'A. The Case Worker card is still the stage-0 beat');
ok(/people fed/i.test(card) && /fire going/i.test(card),
  'A. card copy still sells people fed and fire going');
ok(/hold together/.test(main),
  'A. intro log still says Dena visits camps that hold together');

const stage0 = (check.match(/if\s*\(\s*G\.arcStage\s*===\s*0[^)]*\)/) || [''])[0];
ok(/G\.food/.test(stage0) && /G\.warmth/.test(stage0),
  'A. stage-0 gate reads leftover food and warmth, not only days + goodwill');
ok(/G\.population/.test(stage0),
  'A. stage-0 gate also wants more than a solo tent — "people" / order');
ok(/soup_kitchen/.test(check) && /population\s*>=\s*4/.test(check),
  'A. stage 1 is still soup kitchen + four people');
ok(/goodwill\s*>=\s*25/.test(check) && /morale\s*>\s*60/.test(check),
  'A. stage 2 is still 25 goodwill and morale above 60');
ok(!/arcStage/.test(ui) && !/checkArc/.test(ui),
  'A. ui.js is not this ticket — it still only paints the banner');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.addInitScript(() => {
    try { localStorage.setItem('hv-intro-seen', '1'); } catch (e) {}
    try { localStorage.removeItem('homeless_village_v1'); } catch (e) {}
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2200);

  const cardOn = () => page.evaluate(() => {
    const banner = document.getElementById('event-banner');
    const titleEl = document.getElementById('ev-title');
    const shown = !!(banner && banner.style.display === 'block');
    return {
      stage: G.arcStage,
      title: shown && titleEl ? titleEl.textContent : '',
      shown
    };
  });

  await page.evaluate(() => {
    closeEvent();
    Object.assign(G, {
      days: 10, goodwill: 20, food: 0, warmth: 15, population: 2,
      morale: 70, health: 80, arcStage: 0, arcDone: false
    });
    checkArc();
  });
  const starving = await cardOn();
  ok(starving.stage === 0 && starving.title !== 'The Case Worker',
    `B. empty pot + dying fire must not fire Dena (stage ${starving.stage}, ${starving.title || 'no card'})`);

  await page.evaluate(() => {
    closeEvent();
    Object.assign(G, {
      days: 10, goodwill: 20, food: 4, warmth: 20, population: 2,
      arcStage: 0, arcDone: false
    });
    checkArc();
  });
  const dyingFire = await cardOn();
  ok(dyingFire.stage === 0,
    `B. leftover food with a dying fire still is not "fire going" (stage ${dyingFire.stage})`);

  await page.evaluate(() => {
    closeEvent();
    Object.assign(G, {
      days: 10, goodwill: 20, food: 3, warmth: 62, population: 2,
      morale: 70, health: 80, arcStage: 0, arcDone: false
    });
    checkArc();
  });
  const held = await cardOn();
  ok(held.stage === 1 && held.title === 'The Case Worker',
    `B. fed + fire going + two people fires Dena (stage ${held.stage}, ${held.title || 'no card'})`);

  await page.evaluate(() => {
    closeEvent();
    Object.assign(G, {
      days: 12, goodwill: 14, food: 6, warmth: 70, population: 3,
      arcStage: 0, arcDone: false
    });
    checkArc();
  });
  const lowGw = await cardOn();
  ok(lowGw.stage === 0,
    `B. 14 goodwill still stays off Dena even when the camp holds together (stage ${lowGw.stage})`);

  await page.evaluate(() => {
    closeEvent();
    Object.assign(G, {
      days: 11, goodwill: 20, food: 5, warmth: 70, population: 1,
      arcStage: 0, arcDone: false
    });
    checkArc();
  });
  const solo = await cardOn();
  ok(solo.stage === 0,
    `B. a one-person camp is not "people" / order (stage ${solo.stage})`);

  const emptyDawn = await page.evaluate(() => {
    closeEvent();
    Object.assign(G, {
      dog: 1, dogMetDay: 999, lastEventDay: 9999, goalIndex: 9999,
      days: 9, timeOfDay: 0.98, goodwill: 20, food: 1, warmth: 70,
      population: 2, morale: 70, health: 80, money: 20,
      weather: 'clear', forecast: 'clear', snapUntil: null,
      rayDebt: 0, rainBetOn: false,
      workers: { scrapper: false, builder: false, cook: false, lookout: false },
      structures: { tent: false, fire: true, stash: false, garden: false, kitchen: false, clinic: false, soup_kitchen: false },
      arcStage: 0, arcDone: false
    });
    Math.random = () => 0.9;
    onNewDay();
    const banner = document.getElementById('event-banner');
    const titleEl = document.getElementById('ev-title');
    const shown = !!(banner && banner.style.display === 'block');
    return {
      food: G.food, stage: G.arcStage,
      title: shown && titleEl ? titleEl.textContent : ''
    };
  });
  ok(emptyDawn.food === 0 && emptyDawn.stage === 0 && emptyDawn.title !== 'The Case Worker',
    `C. dawn that empties the pot must not fire Dena (food ${emptyDawn.food}, stage ${emptyDawn.stage})`);

  const leftover = await page.evaluate(() => {
    closeEvent();
    Object.assign(G, {
      dog: 1, dogMetDay: 999, lastEventDay: 9999, goalIndex: 9999,
      days: 9, timeOfDay: 0.98, goodwill: 20, food: 5, warmth: 70,
      population: 2, morale: 70, health: 80, money: 20,
      weather: 'clear', forecast: 'clear', snapUntil: null,
      rayDebt: 0, rainBetOn: false,
      workers: { scrapper: false, builder: false, cook: false, lookout: false },
      structures: { tent: false, fire: true, stash: false, garden: false, kitchen: false, clinic: false, soup_kitchen: false },
      arcStage: 0, arcDone: false
    });
    Math.random = () => 0.9;
    onNewDay();
    const banner = document.getElementById('event-banner');
    const titleEl = document.getElementById('ev-title');
    const shown = !!(banner && banner.style.display === 'block');
    return {
      food: G.food, warmth: G.warmth, stage: G.arcStage,
      title: shown && titleEl ? titleEl.textContent : ''
    };
  });
  ok(leftover.food > 0 && leftover.warmth >= 50 && leftover.stage === 1 && leftover.title === 'The Case Worker',
    `C. breakfast leftover + fire still going fires Dena (food ${leftover.food}, warmth ${leftover.warmth}, stage ${leftover.stage})`);

  await browser.close();
  ok(errs.length === 0, `Z. no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
