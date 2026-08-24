/*
 * IDEA-SITE-2 — zero-backend shared leaderboards.
 *  1. Player A (with scores) shares: code round-trips through decode.
 *  2. Player B opens A's #hof= link: rival imported, hash cleaned,
 *     HOF opens showing the rival chip on the right rows.
 *  3. Rival-leads highlighting is correct both ways.
 *  4. Paste-import works; garbage code is refused politely.
 *  5. Checksum tampering is rejected.
 *  6. Remove rival clears the chips.
 *  7. Same-name re-import updates rather than duplicates.
 *  8. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const errs = [];

  // Player A: seed scores, produce a code
  let codeA;
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push('A: ' + String(e).slice(0, 200)));
    await page.goto(BASE + '/index.html', { waitUntil: 'load' });
    await page.waitForTimeout(1000);
    codeA = await page.evaluate(() => {
      localStorage.setItem('snake-high', '420');
      localStorage.setItem('tetris-high', '9000');
      localStorage.setItem('mines-best-beginner', '35');
      Rivals.setMyName('ALICE');
      return Rivals.encode();
    });
    const roundtrip = await page.evaluate(c => Rivals.decode(c), codeA);
    ok(roundtrip && roundtrip.name === 'ALICE' && roundtrip.s['snake-high'] === 420 &&
       roundtrip.s['mines-best-beginner'] === 35,
       `code round-trips (${codeA.length} chars)`);
    // 5. tamper: flip a payload char
    const tampered = codeA.replace(/^./, c => c === 'A' ? 'B' : 'A');
    ok(await page.evaluate(c => Rivals.decode(c) === null, tampered), 'tampered code rejected by checksum');
    await ctx.close();
  }

  // Player B: import via link
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push('B: ' + String(e).slice(0, 200)));
    await page.goto(BASE + '/index.html', { waitUntil: 'load' });
    await page.waitForTimeout(800);
    await page.evaluate(() => { localStorage.setItem('snake-high', '600'); }); // B leads snake
    await page.goto(BASE + '/index.html#hof=' + encodeURIComponent(codeA), { waitUntil: 'load' });
    await page.waitForTimeout(1500);

    const st = await page.evaluate(() => ({
      view: document.getElementById('view-halloffame').classList.contains('active'),
      hash: location.hash,
      out: document.getElementById('hof-share-out').textContent,
      rivals: Object.keys(Rivals.list()),
    }));
    ok(st.view, 'import link lands on the Hall of Fame');
    ok(st.hash === '#halloffame', `hash cleaned to #halloffame (${st.hash})`);
    ok(/Rival added: ALICE/.test(st.out), 'confirmation names the rival');
    ok(st.rivals.length === 1 && st.rivals[0] === 'ALICE', 'rival stored');

    const rows = await page.evaluate(() => {
      const out = {};
      document.querySelectorAll('.hof-row').forEach(r => {
        const name = r.querySelector('.hof-name').textContent;
        const riv = r.querySelector('.hof-rival');
        out[name] = riv ? { text: riv.textContent, leads: riv.classList.contains('hof-rival-leads') } : null;
      });
      return out;
    });
    ok(rows['Snake'] && /ALICE · 420 pts/.test(rows['Snake'].text) && !rows['Snake'].leads,
       `Snake chip present, B leads (${rows['Snake'] && rows['Snake'].text})`);
    ok(rows['Tetris'] && rows['Tetris'].leads, 'Tetris chip lit — ALICE leads (B never played)');
    ok(rows['Minefield'] && rows['Minefield'].leads, 'Minefield chip lit (min-dir: 35s beats nothing)');
    ok(rows['Pong++'] === null, 'no chip on games the code lacks');

    // 7. same-name re-import updates
    const codeA2 = await page.evaluate(c => {
      const r = Rivals.decode(c);
      r.s['snake-high'] = 9999; r.t += 1;
      const payload = JSON.stringify({ v: 1, n: r.name, t: r.t, s: r.s });
      // rebuild through the real encoder path: use Rivals internals via add
      Rivals.add(r);
      return Object.keys(Rivals.list()).length;
    }, codeA);
    const after = await page.evaluate(() => Rivals.bestFor('snake-high'));
    ok(codeA2 === 1 && after.value === 9999, 'same-name re-import updates in place');

    // 6. remove
    await page.evaluate(() => { location.hash = '#halloffame'; });
    await page.waitForTimeout(300);
    await page.click('.hof-rival-x');
    await page.waitForTimeout(300);
    const gone = await page.evaluate(() => ({
      n: Object.keys(Rivals.list()).length,
      chips: document.querySelectorAll('.hof-rival').length,
    }));
    ok(gone.n === 0 && gone.chips === 0, 'remove clears rival and chips');

    // 4. paste-import + garbage
    await page.fill('#hof-rival-code', codeA);
    await page.click('#hof-rival-add');
    await page.waitForTimeout(300);
    const pasted = await page.evaluate(() => Object.keys(Rivals.list()));
    ok(pasted.length === 1 && pasted[0] === 'ALICE', 'paste-import works');
    await page.fill('#hof-rival-code', 'not-a-code');
    await page.click('#hof-rival-add');
    await page.waitForTimeout(300);
    const bad = await page.evaluate(() => document.getElementById('hof-share-out').textContent);
    ok(/didn't decode/.test(bad), 'garbage paste refused politely');

    await ctx.close();
  }

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
