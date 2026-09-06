/* P8 tail — metadata/rivals/manifest sweep (re-runnable). */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext()).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0,150)));
  await p.addInitScript(() => localStorage.setItem('maze-best', '777'));
  await p.goto(BASE + '/index.html#halloffame', { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  const meta = await p.evaluate(() => ({
    desc: document.querySelector('meta[name="description"]').content,
    og: document.querySelector('meta[property="og:description"]').content,
  }));
  ok(/Twenty-one games/.test(meta.desc) && !/Fourteen/.test(meta.desc), 'meta description says twenty-one games');
  ok(/16 more/.test(meta.og), 'og:description updated');
  // maze-best rides the share code
  const code = await p.evaluate(() => { Rivals.setMyName('T'); return Rivals.shareUrl(); });
  const decoded = await p.evaluate(c => Rivals.decode(decodeURIComponent(c.replace(/^.*#hof=/, ''))), code);
  ok(decoded && decoded.s && decoded.s['maze-best'] === 777, `maze-best rides the share code (${decoded && decoded.s && decoded.s['maze-best']})`);
  const mf = await p.evaluate(async () => (await (await fetch('/manifest.json')).json()));
  ok(Array.isArray(mf.shortcuts) && mf.shortcuts.length === 3 && mf.shortcuts.every(s => s.name && s.url),
    'manifest carries 3 well-formed shortcuts');
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  await b.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
