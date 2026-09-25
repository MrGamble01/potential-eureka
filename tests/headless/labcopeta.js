/* Hook-free: CDP evaluates the production module scope; no source injection. */
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
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Debugger.enable');
    const source = await (await page.request.get(BASE + '/drug-lab.html')).text();
    const lineNumber = source.slice(0, source.indexOf('  requestAnimationFrame(animate);', source.indexOf('function animate('))).split('\n').length - 1;
    // Pause at a real frame to access module bindings, then always resume it.
    const evaluate = async expression => {
      const { breakpointId } = await cdp.send('Debugger.setBreakpointByUrl', {
        url: BASE + '/drug-lab.html', lineNumber });
      const paused = new Promise(resolve => cdp.once('Debugger.paused', resolve));
      const tick = page.clock.runFor(16);
      const event = await paused;
      try {
        const result = await cdp.send('Debugger.evaluateOnCallFrame', {
          callFrameId: event.callFrames[0].callFrameId, expression, returnByValue: true });
        if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
      } finally {
        await cdp.send('Debugger.removeBreakpoint', { breakpointId });
        await cdp.send('Debugger.resume');
        await tick;
      }
    };
    await evaluate(`(() => {
      stashCount = 10;
      player.position.set(-10, 0, -10);
      for (const [id, undercover, whale] of [[9001, true, false], [9002, false, false], [9003, false, true]]) {
        const group = buildDealer();
        group.position.set(stashNode.x, 0, stashNode.z + 3);
        scene.add(group);
        dealers.push({ id, group, state: 'waiting', paid: false, buyCount: 1, undercover, whale, waitT: 12.2 });
      }
      updateLabels();
    })()`);
    const labels = () => page.locator('#labels').innerText();
    ok((await labels()).includes('💰 Buyer · 13s'), 'unwired undercover rounds 12.8 seconds up to 13s');
    await page.clock.runFor(1100);
    ok((await labels()).includes('💰 Buyer · 12s'), 'real frame loop decreases leave seconds');
    await evaluate('wireLeft = 90; updateLabels();');
    ok((await labels()).includes("🚨 Something's off… · 12s"), 'live wire retains danger warning with seconds');
    const ordinary = await evaluate(`JSON.stringify([9002, 9003].map(id => labelMap.get('deal_' + id).textContent))`);
    ok(ordinary === JSON.stringify(['💰 Buyer', '🐋 The Whale']), 'ordinary buyer and whale labels stay unchanged');
    const boundary = await evaluate(`(() => {
      const d = dealers.find(d => d.id === 9001);
      d.waitT = 24.5;
      updateDealers(0.5); updateLabels();
      return { state: d.state, text: labelMap.get('deal_9001').textContent };
    })()`);
    ok(boundary.state === 'waiting' && boundary.text === "🚨 Something's off… · 0s", 'exactly 25s still waits, preserving strict leave threshold');
    await page.clock.runFor(100);
    const departed = await evaluate(`({ state: dealers.find(d => d.id === 9001)?.state, label: labelMap.has('deal_9001') })`);
    ok(departed.state === 'leaving' && !departed.label, 'over 25s leaves and removes label through real frames');
    ok((await page.locator('#feed-list').innerText()).includes('The odd buyer drifts off empty-handed'), 'existing departure feed survives');
    ok(errors.length === 0, `no page errors ${errors.join('; ')}`);
  } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
