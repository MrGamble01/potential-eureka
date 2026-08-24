/*
 * P6 — whole-arcade backup/restore (re-runnable).
 *  A. Backup downloads eureka-backup-<date>.json containing every seeded
 *     localStorage key in {v, when, data}.
 *  B. Restore in a FRESH profile brings the scores back (page reloads and
 *     the HOF board shows them).
 *  C. A garbage file is rejected with an alert and writes nothing.
 *  D. Zero page errors.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const TMP = require('os').tmpdir() + '/eureka-backup-dl';   // never inside the repo

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

(async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });

  let backupPath;
  // A. export
  {
    const ctx = await browser.newContext({ acceptDownloads: true });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await page.addInitScript(() => {
      localStorage.setItem('snake-high', '77');
      localStorage.setItem('g2048-best', '4096');
      localStorage.setItem('arcade-coins', JSON.stringify({ balance: 40, paid: {}, owned: { indigo: true }, equipped: 'indigo' }));
    });
    await page.goto(BASE + '/index.html#halloffame', { waitUntil: 'load' });
    await page.waitForTimeout(1000);
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#hof-backup'),
    ]);
    backupPath = TMP + '/' + dl.suggestedFilename();
    await dl.saveAs(backupPath);
    const j = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    ok(/^eureka-backup-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()),
      `download named ${dl.suggestedFilename()}`);
    ok(j.v === 1 && typeof j.when === 'string' && j.data, 'payload has {v, when, data}');
    // Booting with seeded scores legitimately unlocks achievements, which
    // mint coins on top of the seeded 40 — so ≥40, not ===40.
    ok(j.data['snake-high'] === '77' && j.data['g2048-best'] === '4096' &&
       JSON.parse(j.data['arcade-coins']).balance >= 40,
      `seeded keys all present in the backup (coins ${JSON.parse(j.data['arcade-coins']).balance})`);
    ok(errs.length === 0, `no page errors (export)${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  // B. restore into a fresh profile
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    page.on('dialog', d => d.accept());
    await page.goto(BASE + '/index.html#halloffame', { waitUntil: 'load' });
    await page.waitForTimeout(900);
    const empty = await page.evaluate(() => localStorage.getItem('snake-high'));
    ok(empty === null, 'fresh profile starts empty');
    await page.click('#hof-restore');
    await page.setInputFiles('#hof-restore-file', backupPath);
    await page.waitForFunction(() => localStorage.getItem('snake-high') === '77', null, { timeout: 10000 });
    await page.waitForLoadState('load');
    await page.waitForTimeout(1500);   // let the reloaded HOF render
    const restored = await page.evaluate(() => ({
      snake: localStorage.getItem('snake-high'),
      g2048: localStorage.getItem('g2048-best'),
      coins: JSON.parse(localStorage.getItem('arcade-coins') || '{}').balance,
      board: document.getElementById('hof-board').textContent,
    }));
    ok(restored.snake === '77' && restored.g2048 === '4096' && restored.coins >= 40,
      `restore writes the backed-up keys (coins ${restored.coins})`);
    ok(/77/.test(restored.board), 'reloaded HOF board shows the restored best');
    ok(errs.length === 0, `no page errors (restore)${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  // C. garbage file rejected
  {
    const junkPath = TMP + '/junk.json';
    fs.writeFileSync(junkPath, '{"totally":"unrelated"}');
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errs = []; const alerts = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    page.on('dialog', d => { alerts.push(d.type() + ':' + d.message().slice(0, 40)); d.accept(); });
    await page.goto(BASE + '/index.html#halloffame', { waitUntil: 'load' });
    await page.waitForTimeout(900);
    await page.setInputFiles('#hof-restore-file', junkPath);
    await page.waitForTimeout(800);
    const wrote = await page.evaluate(() => localStorage.getItem('totally'));
    ok(alerts.some(a => a.startsWith('alert:')), `junk file raises the rejection alert (${alerts[0] || 'none'})`);
    ok(wrote === null, 'junk file writes nothing');
    ok(errs.length === 0, `no page errors (junk)${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  await browser.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
