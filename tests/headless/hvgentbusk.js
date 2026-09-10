/*
 * HV-234 — Gentrification said harassment is increasing, then
 * Busk a set still paid the quiet-corner take.
 *
 * The Gentrification card says "Harassment from locals is
 * increasing." Busk is a set on the corner — the same locals.
 * The effect was a one-shot morale/goodwill hit. buskPay still
 * returned 1 + morale/25 (doubled on heat) as if the block
 * had not turned.
 *
 * #736 / HV-76 is panhandle vs the stamp. #876 is flyers vs
 * the kind owner. #823 is Busk vs a named snap. #869 is Busk
 * vs rain. This ticket is Gentrification vs the guitar take.
 * ui.js is not this ticket.
 *
 *  A. Source: the card still promises increasing harassment.
 *     The effect stamps gentrifyDay. buskPay reads it. Panhandle
 *     is not this card. ui.js is not this ticket.
 *  B. Live: morale 50 on a quiet clear corner still pays +3.
 *     After the card the same spirits pay +1, and the log names
 *     the new neighbors.
 *  C. Heat still doubles, then the stamp halves (6 → 3).
 *  D. A new dawn lifts the stamp — the same roll pays +3 again.
 *  E. Rain and a named snap do not steal the cut. Panhandle
 *     still uses the quiet 0.55 threshold (HV-76).
 *  Z. Zero page errors.
 *
 * Hook-free. Drives the production gentrify effect + buskPay.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const gent = /id:'gentrify'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(loop);
const buskPay = /function buskPay\(\)\{([\s\S]*?)\n\}/.exec(cfg);
const pan = /if\(a\.id==='panhandle'\)\{([\s\S]*?)\n  \} else if\(a\.id==='rest'\)/.exec(player);

ok(/Harassment from locals is increasing/.test(loop),
  'the card still promises increasing harassment');
ok(/one set a day on the corner/.test(cfg) && /function buskPay/.test(cfg),
  'Busk is still a set on the corner whose take rides the spirits');
ok(gent && /gentrifyDay/.test(gent[1]),
  'HV-234: the gentrify effect stamps the day');
ok(buskPay && /gentrify/.test(buskPay[1]),
  'HV-234: buskPay reads the gentrify stamp');
ok(pan && !/gentrify/.test(pan[1]) && !/GENTRIFY_PAN/.test(pan[1]),
  'panhandle is not this card — the corner odds stay HV-76');
ok(!/gentrifyDay/.test(ui) && !/gentrifyHostile/.test(ui),
  'ui.js untouched — the hostility cut lives on buskPay');

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
    if (!sessionStorage.getItem('hvgentbusk-init')) {
      sessionStorage.setItem('hvgentbusk-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const quiet = await t(() => {
    G.structures.guitar = true;
    G.buskDay = -9;
    G.gentrifyDay = -1;
    G.morale = 50;
    G.goodwill = 0;
    G.weather = 'clear';
    G.goalIndex = GOALS.length;
    const pay = buskPay();
    finishAction(buskAction());
    return { pay, gw: G.goodwill, morale: G.morale };
  });
  ok(quiet.pay === 3 && quiet.gw === 3,
    `a quiet clear corner still pays +3 at morale 50 (${quiet.pay} / ${quiet.gw})`);

  const hostile = await t(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'gentrify');
    G.structures.guitar = true;
    G.buskDay = -9;
    G.goalIndex = GOALS.length;
    G.morale = 50;
    G.goodwill = 10;
    G.weather = 'clear';
    ev.effect();
    const stamped = G.gentrifyDay === G.days;
    G.morale = 50;
    G.goodwill = 0;
    const pay = buskPay();
    const before = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    finishAction(buskAction());
    const after = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const added = after.filter((line, i) => line !== before[i]).join('\n');
    return {
      stamped,
      pay,
      gw: G.goodwill,
      added,
    };
  });
  ok(hostile.stamped,
    'Gentrification stamps today');
  ok(hostile.pay === 1 && hostile.gw === 1,
    `HV-234: a hostile corner pays +1, not the quiet +3 (${hostile.pay} / ${hostile.gw})`);
  ok(/hostil|neighbor|gentrif|linger|crowd/i.test(hostile.added),
    `the set names the new neighbors — not a silent half (${hostile.added.slice(-90)})`);

  const heat = await t(() => {
    G.structures.guitar = true;
    G.buskDay = -9;
    G.gentrifyDay = -1;
    G.morale = 50;
    G.weather = 'heat';
    const quietHeat = buskPay();
    G.gentrifyDay = G.days;
    const hostileHeat = buskPay();
    return { quietHeat, hostileHeat };
  });
  ok(heat.quietHeat === 6 && heat.hostileHeat === 3,
    `heat still doubles, then the stamp halves (6 → 3) (${heat.quietHeat} → ${heat.hostileHeat})`);

  const dawn = await t(() => {
    G.gentrifyDay = G.days;
    G.days = G.days + 1;
    G.structures.guitar = true;
    G.buskDay = -9;
    G.morale = 50;
    G.weather = 'clear';
    return { pay: buskPay(), day: G.gentrifyDay, days: G.days };
  });
  ok(dawn.pay === 3 && dawn.day !== dawn.days,
    `a new dawn lifts the stamp — the corner pays +3 again (${dawn.pay})`);

  const otherSky = await t(() => {
    G.gentrifyDay = -1;
    G.morale = 50;
    G.weather = 'rain';
    G.snapUntil = G.days + 2;
    const rainSnap = buskPay();
    G.snapUntil = null;
    G.weather = 'clear';
    const clear = buskPay();
    return { rainSnap, clear, snap: snapActive() };
  });
  ok(otherSky.rainSnap === 3 && otherSky.clear === 3,
    `rain and a named snap do not steal the cut — those are #869 / #823 (${otherSky.rainSnap} / ${otherSky.clear})`);

  const corner = await t(() => {
    const real = Math.random;
    G.gentrifyDay = G.days;
    G.weather = 'clear';
    G.dog = 0;
    G.morale = 50;
    G.goodwill = 0;
    Math.random = () => 0.40;
    finishAction({ id: 'panhandle' });
    Math.random = real;
    return { gw: G.goodwill };
  });
  ok(corner.gw > 0,
    `panhandle still pays a 0.40 roll after the card — the 0.55 cut is HV-76 (+${corner.gw})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
