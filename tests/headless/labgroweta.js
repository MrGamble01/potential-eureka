/* Hook-free grow ETA through production saves, controls and page-clock time. */
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
    const read = () => page.evaluate(() => {
      window.dispatchEvent(new Event('pagehide'));
      return { save: JSON.parse(localStorage.getItem('drug-lab-v1')),
        labels: [...document.querySelectorAll('#labels > div')]
          .filter(el => el.textContent.startsWith('🌿'))
          .map(el => ({ text: el.textContent, cls: el.className, transform: el.style.transform })) };
    });
    const seed = (await read()).save;
    const load = async overrides => {
      await page.goto(BASE + '/404.html');
      await page.evaluate(s => {
        s.savedAt = Date.now();
        localStorage.setItem('drug-lab-v1', JSON.stringify(s));
      }, { ...seed, cash: 500, plots: [{ r: 'garage', g: 0.31 }, { r: 'garage', g: 0 }], ...overrides });
      await page.goto(BASE + '/drug-lab.html');
    };
    // growTime() is module-private: derive its duration from the production save.
    const duration = s => 18 / (1 + (s.upgrades.lights1 || 0) * 0.3) / (s.crunch ? 1.3 : 1);
    const seconds = (s, i) => Math.ceil(Math.max(0, (1-s.plots[i].g)*duration(s)));
    // Samples stay away from second boundaries; saves round progress to four decimals.
    const matches = (r, i) => r.labels[i]?.text === `🌿 ${seconds(r.save, i)}s` && r.labels[i]?.cls === '';
    await load({});
    await page.click('#lab-help-btn');
    await page.clock.runFor(32);
    const paused = await read();
    ok(matches(paused, 0) && seconds(paused.save, 0) === 13,
      'planted plot shows rounded-up seconds from progress and growTime');
    ok(paused.save.plots[1].g === 0 && paused.labels.length === 1,
      'empty plot stays unlabeled while production is held');
    await page.click('#intro-go');
    await page.clock.runFor(1100);
    const tick = await read();
    ok(tick.labels.length === 2 && tick.save.plots.every((_, i) => matches(tick, i)) &&
      tick.save.plots[0].g > paused.save.plots[0].g && seconds(tick.save, 0) < seconds(paused.save, 0),
      'every growing plot counts down through production time');
    await page.click('#crunch-toggle');
    await page.clock.runFor(32);
    const crunch = await read();
    ok(crunch.save.crunch && duration(crunch.save) < duration(tick.save) && matches(crunch, 0) &&
      seconds(crunch.save, 0) < seconds(tick.save, 0),
      'real night-shift toggle shortens ETA using live growTime');
    await page.getByRole('button', { name: /Better Grow Lights/ }).click();
    await page.clock.runFor(32);
    const lights = await read();
    ok(lights.save.upgrades.lights1 === 1 && duration(lights.save) < duration(crunch.save) &&
      matches(lights, 0) && seconds(lights.save, 0) < seconds(crunch.save, 0),
      'real lights purchase shortens ETA using live growTime');
    await page.click('#crunch-toggle');
    await page.clock.runFor(32);
    const day = await read();
    ok(!day.save.crunch && matches(day, 0) && seconds(day.save, 0) > seconds(lights.save, 0),
      'turning night shifts off restores the longer live ETA');
    await load({ plots: [{ r: 'garage', g: 0.999 }, { r: 'garage', g: 0.2 }] });
    await page.clock.runFor(32);
    const ready = await read();
    ok(ready.save.plots[0].g === 1 && ready.labels[0]?.text === '🌿 READY!' && ready.labels[0]?.cls === 'ready',
      'production completion replaces seconds with Ready labeling');
    await page.clock.runFor(160);
    const pulse = await read();
    ok(pulse.labels[0]?.text === '🌿 READY!' && pulse.labels[0]?.transform !== ready.labels[0]?.transform,
      'ready label keeps its bobbing pulse without a countdown');
    await page.keyboard.down('w');
    await page.keyboard.down('a');
    let harvested;
    for (let i = 0; i < 100; i++) {
      await page.clock.runFor(16);
      harvested = await read();
      if (harvested.save.pCarrying === 'bud') break;
    }
    await page.keyboard.up('w');
    await page.keyboard.up('a');
    ok(harvested.save.pCarrying === 'bud' && harvested.save.plots[0].g === 0 &&
      harvested.labels.length === 1 && !harvested.labels.some(l => /ready/i.test(l.text)),
      'real movement harvests the plant, clears its label and carries the bud');
    await page.clock.runFor(32);
    const regrowing = await read();
    ok(regrowing.save.plots[0].g > 0 && regrowing.labels.length === 2 &&
      regrowing.labels.some(l => l.text === `🌿 ${seconds(regrowing.save, 0)}s`),
      'automatic regrowth gets a fresh ETA after harvest');
    ok(errors.length === 0, `no page errors ${errors.join('; ')}`);
  } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
