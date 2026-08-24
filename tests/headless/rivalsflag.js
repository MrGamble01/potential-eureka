/*
 * SITE — the flagship leaderboard (re-runnable). All six flagships ride
 * the rival share codes via per-game read() hooks over their JSON saves.
 *  A. All six flagship keys sit in the rivals table with formatters.
 *  B. Seeded saves encode their headline numbers into one share code.
 *  C. Corrupt blobs read as 0 and drop out (no crash).
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
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('rival-name', 'HERO');
    localStorage.setItem('aow-best-run', JSON.stringify({ waves: 14 }));
    localStorage.setItem('startup-tycoon-v7', JSON.stringify({ lifetimeCash: 123456 }));
    localStorage.setItem('hearthvale-v1', JSON.stringify({ peakPop: 17 }));
    localStorage.setItem('homeless_village_v1', JSON.stringify({ days: 33 }));
    localStorage.setItem('drug-lab-v1', JSON.stringify({ totalEarned: 9800 }));
    localStorage.setItem('voxel-garden-v1', JSON.stringify({ v: 1, state: { totalEarned: 4321 } }));
  });
  await page.goto(BASE + '/#halloffame', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  const t = fn => page.evaluate(fn);

  const KEYS = ['aow-best-run', 'startup-tycoon-v7', 'hearthvale-v1', 'homeless_village_v1', 'drug-lab-v1', 'voxel-garden-v1'];

  // A. table membership + formatters
  const table = await page.evaluate(keys => ({
    all: keys.every(k => k in Rivals.GAMES),
    tycoon: Rivals.GAMES['startup-tycoon-v7'].fmt(123456),
    vale: Rivals.GAMES['hearthvale-v1'].fmt(17),
  }), KEYS);
  ok(table.all, 'all six flagships sit in the rivals table');
  ok(table.tycoon === '$123,456 lifetime' && table.vale === '17 villagers at peak',
    `formatters read naturally (${table.tycoon} · ${table.vale})`);

  // B. one share code carries all six headline numbers
  const enc = await t(() => Rivals.decode(Rivals.encode()).s);
  ok(enc['aow-best-run'] === 14 && enc['startup-tycoon-v7'] === 123456 && enc['hearthvale-v1'] === 17,
    'AoW/Tycoon/Hearthvale numbers ride the code');
  ok(enc['homeless_village_v1'] === 33 && enc['drug-lab-v1'] === 9800 && enc['voxel-garden-v1'] === 4321,
    'HV/Grow Op/Voxel numbers ride the code');

  // C. corrupt blobs drop out
  const corrupt = await t(() => {
    localStorage.setItem('startup-tycoon-v7', 'not json{');
    localStorage.setItem('voxel-garden-v1', '42');   // not an object
    const s = Rivals.decode(Rivals.encode()).s;
    return { tycoon: 'startup-tycoon-v7' in s, voxel: 'voxel-garden-v1' in s, aow: s['aow-best-run'] };
  });
  ok(!corrupt.tycoon && !corrupt.voxel && corrupt.aow === 14, 'corrupt blobs drop out; the rest survive');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
