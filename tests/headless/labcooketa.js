/* Hook-free batch ETAs: CDP inspects module scope at a real animation frame.
 * No source rewriting, exported test hooks, or save-schema additions. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (value, name) => { value ? pass++ : fail++; console.log(`${value ? 'PASS' : 'FAIL'} ${name}`); };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.clock.install({ time: new Date('2026-09-25T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-09-25T12:00:01Z'));
    await page.goto(BASE + '/drug-lab.html');
    await page.click('#diff-careful');
    await page.click('#intro-go');
    const seed = await page.evaluate(() => {
      window.dispatchEvent(new Event('pagehide'));
      return JSON.parse(localStorage.getItem('drug-lab-v1'));
    });
    Object.assign(seed, { cash: 10000, totalEarned: 2000,
      ownedRooms: ['garage', 'growroom', 'warehouse'], cooks: 0, trimmers: 0 });
    seed.upgrades.chemistry = 1;
    await page.goto(BASE + '/404.html');
    await page.evaluate(s => { s.savedAt = Date.now(); localStorage.setItem('drug-lab-v1', JSON.stringify(s)); }, seed);
    const response = await page.goto(BASE + '/drug-lab.html');
    const source = await response.text();
    const lineNumber = source.split('\n').findIndex(l => l.includes('const dt=Math.min((now_ms-lastTime)'));
    if (lineNumber < 0) throw new Error('Animation frame anchor missing');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Debugger.enable');
    const evaluate = async expression => {
      const { breakpointId } = await cdp.send('Debugger.setBreakpointByUrl', {
        url: BASE + '/drug-lab.html', lineNumber });
      const paused = new Promise(resolve => cdp.once('Debugger.paused', resolve));
      const ticking = page.clock.runFor(32);
      const frame = (await paused).callFrames[0];
      try {
        const result = await cdp.send('Debugger.evaluateOnCallFrame', {
          callFrameId: frame.callFrameId, expression, returnByValue: true });
        if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
      } finally {
        await cdp.send('Debugger.removeBreakpoint', { breakpointId });
        await cdp.send('Debugger.resume');
        await ticking;
      }
    };
    const read = () => evaluate(`({ chemQueue, chemProgress, trimQueue, trimProgress,
      chemProduct, trimBags, cooks: state.cooks, crunch: state.crunch,
      trimLevel: upgLv('trim'), trimmers: trimmerNPCs.length,
      chem: labelMap.get('chem').textContent, trim: labelMap.get('trim').textContent })`);
    const chemSeconds = r => Math.ceil(Math.max(0, (1-r.chemProgress)*12/((1+r.cooks*0.5)*(r.crunch?1.3:1))));
    const trimSeconds = r => Math.ceil(Math.max(0, (1-r.trimProgress)*8/(1+r.trimLevel*0.25+r.trimmers*0.4)));
    const matches = r => r.chem === `⚗️ Cooking — ${chemSeconds(r)}s · ${r.chemQueue} queued` &&
      r.trim === `✂️ Trimming — ${trimSeconds(r)}s · ${r.trimQueue} queued`;
    const idle = await read();
    ok(!/\d+s|Cooking|Trimming/.test(idle.chem + idle.trim) && idle.trim === '✂️ Trim Station', 'idle stations have no countdown');
    await evaluate('chemQueue=2; chemProgress=0.26; trimQueue=2; trimProgress=0.26');
    const start = await read();
    ok(matches(start) && chemSeconds(start) === 9 && trimSeconds(start) === 6, 'known progress rounds up both batch ETAs with queue counts');
    await page.clock.runFor(1100);
    const tick = await read();
    ok(matches(tick) && chemSeconds(tick) < chemSeconds(start) && trimSeconds(tick) < trimSeconds(start), 'both countdowns decrease with page-clock production');
    await page.click('#hire-cook-btn');
    await page.clock.runFor(32);
    const cook = await read();
    ok(matches(cook) && cook.cooks === 1 && chemSeconds(cook) < chemSeconds(tick), 'real cook hire shortens live ETA');
    await page.click('#crunch-toggle');
    await page.clock.runFor(32);
    const crunch = await read();
    ok(matches(crunch) && crunch.crunch && chemSeconds(crunch) < chemSeconds(cook), 'night shifts shorten live cook ETA');
    await page.click('#crunch-toggle');
    await page.clock.runFor(32);
    const day = await read();
    ok(matches(day) && !day.crunch && chemSeconds(day) > chemSeconds(crunch), 'turning night shifts off lengthens cook ETA');
    await evaluate("state.upgrades.trim=2; trimProgress=0.31");
    const upgrade = await read();
    ok(matches(upgrade) && trimSeconds(upgrade) === 4, 'trim upgrade uses its live multiplier');
    await page.click('#hire-trimmer-btn');
    await page.clock.runFor(32);
    const trimmer = await read();
    ok(matches(trimmer) && trimmer.trimmers === 1 && trimSeconds(trimmer) < trimSeconds(upgrade), 'real trimmer hire shortens trim ETA');
    await evaluate('chemProgress=0.999; trimProgress=0.999');
    const next = await read();
    ok(matches(next) && next.chemQueue === 1 && next.trimQueue === 1 && next.chemProduct === 2 && next.trimBags === 1,
      'batch completion with queued work shows fresh countdowns and unchanged yields');
    await evaluate('chemProgress=0.999; trimProgress=0.999');
    const done = await read();
    ok(done.chemQueue === 0 && done.trimQueue === 0 && done.chem.startsWith('⚗️ Cook Station [4 units') && done.trim === '✂️ 2 bags ready' &&
      !/\d+s|Cooking|Trimming/.test(done.chem + done.trim), 'final batches restore product and ready labels without countdowns');
    await page.clock.runFor(1000);
    const ready = await read();
    ok(ready.chem === done.chem && ready.trim === done.trim, 'ready labels remain stable after production stops');
    ok(errors.length === 0, `zero page errors ${errors.join('; ')}`);
  } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
