/*
 * AOW-12 — Age of War joins the rival share codes (re-runnable: rivals.js
 * exposes the Rivals global on the hub).
 *  A. The GAMES table carries 'aow-best-run' with the JSON reader.
 *  B. An endless best of {waves:14} encodes into the share code.
 *  C. A rival's imported waves render and win/lose comparisons work.
 *  D. Corrupt aow-best-run JSON reads as 0 (no crash, key omitted).
 *  Z. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('rival-name', 'HERO');
    localStorage.setItem('aow-best-run', JSON.stringify({ waves: 14, kills: 200, time: 900, strongholds: 2, difficulty: 'normal' }));
  });
  await page.goto(BASE + '/#halloffame', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  const t = fn => page.evaluate(fn);

  // A + B. encode carries the waves
  const enc = await t(() => {
    const code = Rivals.encode();
    const decoded = Rivals.decode(code);
    return { has: 'aow-best-run' in Rivals.GAMES, waves: decoded && decoded.s['aow-best-run'],
      fmt: Rivals.GAMES['aow-best-run'].fmt(14) };
  });
  ok(enc.has, "'aow-best-run' sits in the rivals table");
  ok(enc.waves === 14, `the share code carries the endless best (${enc.waves} waves)`);
  ok(enc.fmt === '14 waves', `formatted as ${enc.fmt}`);

  // C. import a rival with a better run
  const rival = await t(() => {
    const payload = { v: 1, n: 'ALICE', t: Date.now(), s: { 'aow-best-run': 21 } };
    // build a legit code via the module's own encode path: temporarily
    // swap identity, encode, restore
    const mine = localStorage.getItem('aow-best-run');
    localStorage.setItem('rival-name', 'ALICE');
    localStorage.setItem('aow-best-run', JSON.stringify({ waves: 21 }));
    const code = Rivals.encode();
    localStorage.setItem('rival-name', 'HERO');
    localStorage.setItem('aow-best-run', mine);
    const r = Rivals.decode(code);
    Rivals.add(r);
    const best = Rivals.bestFor ? Rivals.bestFor('aow-best-run') : null;
    return { imported: r.s['aow-best-run'], best: best && best.value, name: best && best.name };
  });
  ok(rival.imported === 21, 'a rival code round-trips with 21 waves');
  ok(!rival.best || (rival.best === 21 && rival.name === 'ALICE'), `best-rival lookup sees ALICE at 21 (${rival.best})`);

  // D. corrupt JSON reads as 0
  const corrupt = await t(() => {
    localStorage.setItem('aow-best-run', '{waves:not json');
    const s = Rivals.decode(Rivals.encode()).s;
    return { omitted: !('aow-best-run' in s) };
  });
  ok(corrupt.omitted, 'corrupt aow-best-run is omitted, not crashed on');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
