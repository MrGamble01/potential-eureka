/* Sound, the local alley, and phone walking.
 *
 * Hook-free. The alley ghosts are a pure function of the UTC date, so the
 * chip on a frozen clock has to name the same neighbor the source computes.
 * Friend codes never leave the browser. The phone dock is the way a thumb
 * finishes a harvest.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const src = fs.readFileSync(path.join(ROOT, 'drug-lab.html'), 'utf8');
const polo = 'UG9sbzo5MDA.1yylmov';
ok(/sfx\('harvest'\)/.test(src) && /sfx\('sale'/.test(src) && /sfx\('bust'\)/.test(src),
  'harvest, sale and bust each play a sound');
ok(/function todaysGhosts/.test(src) && /let bar = 100/.test(src) && /bar \+= 60 \+ Math\.floor\(rnd\(\) \* 180\)/.test(src)
  && /const ALLEY_NAMES = \['Rae', 'Moss', 'Junie'/.test(src) && !/fetch\(/.test(src.slice(src.indexOf('const ALLEY_FRIENDS_KEY'), src.indexOf('function walkToward'))),
  'the alley is a local date ghost, not a request');

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  const errors = [];
  try {
    const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await desk.newPage();
    page.on('pageerror', e => errors.push(String(e).split('\n')[0]));
    await page.clock.install({ time: new Date('2026-10-17T15:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-17T15:00:01Z'));
    await page.goto(BASE + '/drug-lab.html', { waitUntil: 'load' });
    await page.click('#diff-careful');
    await page.click('#intro-go');
    const line = await page.locator('#alley-line').textContent();
    ok(line === 'Rae · $182', `the chip names today's neighbor (${line})`);
    const dockShown = await page.locator('#touch-dock').isVisible();
    ok(!dockShown, 'the walk dock stays off a desktop pointer');
    await page.click('#sfx-btn');
    const muted = await page.locator('#sfx-btn').getAttribute('aria-pressed');
    const stored = await page.evaluate(() => localStorage.getItem('growop-muted'));
    ok(muted === 'true' && stored === '1', `the speaker mutes and remembers it (${muted}, ${stored})`);
    await page.click('#alley-btn');
    await page.fill('#alley-paste', polo);
    await page.click('#alley-add');
    const list = await page.locator('#alley-list').innerText();
    ok(/Polo \(friend\)/.test(list) && /\$900/.test(list), `a pasted code pins Polo (${list.replace(/\n/g, ' | ')})`);
    const still = await page.locator('#alley-line').textContent();
    ok(still === 'Rae · $182', `Polo at $900 does not jump the nearer neighbor (${still})`);
    await page.fill('#alley-paste', 'not-a-code');
    await page.click('#alley-add');
    const list2 = await page.locator('#alley-list').innerText();
    ok(list2 === list, 'a bad code does not change the board');
    ok(errors.length === 0, `desktop page errors (${errors.join('; ')})`);
    await desk.close();

    const phoneErrors = [];
    const phone = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const p = await phone.newPage();
    p.on('pageerror', e => phoneErrors.push(String(e).split('\n')[0]));
    await p.clock.install({ time: new Date('2026-10-17T15:00:00Z') });
    await p.clock.pauseAt(new Date('2026-10-17T15:00:01Z'));
    await p.goto(BASE + '/drug-lab.html', { waitUntil: 'load' });
    await p.click('#diff-careful');
    await p.click('#intro-go');
    const hit = await p.evaluate(() => {
      const own = id => {
        const el = document.getElementById(id);
        if (!el) return id + ' missing';
        const b = el.getBoundingClientRect();
        if (b.width < 2 || b.height < 2) return id + ' hidden';
        const x = b.left + b.width / 2, y = b.top + b.height / 2;
        const top = document.elementFromPoint(x, y);
        const okHit = top && (top === el || el.contains(top) || top.contains(el));
        return okHit ? '' : id + ' covered by ' + (top && (top.id || top.className));
      };
      return [own('stick'), own('next-step'), own('sfx-btn'), own('alley-btn')].filter(Boolean);
    });
    ok(hit.length === 0, `phone controls own their centres${hit.length ? ' — ' + hit.join('; ') : ''}`);
    for (let i = 0; i < 30; i++) {
      await p.clock.runFor(800);
      const label = await p.locator('#next-step').textContent();
      if (label === 'Harvest') break;
    }
    ok((await p.locator('#next-step').textContent()) === 'Harvest', 'a ripe plant labels the big button Harvest');
    await p.click('#next-step');
    let carrying = null;
    for (let i = 0; i < 40; i++) {
      await p.clock.runFor(200);
      carrying = await p.evaluate(() => {
        window.dispatchEvent(new Event('pagehide'));
        return JSON.parse(localStorage.getItem('drug-lab-v1') || '{}').pCarrying || null;
      });
      if (carrying === 'bud') break;
    }
    ok(carrying === 'bud', `the Harvest button walks over and picks the plant (carrying ${carrying})`);
    ok((await p.locator('#next-step').textContent()) === 'Trim', 'the button then says Trim');
    await p.click('#next-step');
    let queued = 0;
    for (let i = 0; i < 40; i++) {
      await p.clock.runFor(200);
      queued = await p.evaluate(() => {
        window.dispatchEvent(new Event('pagehide'));
        const s = JSON.parse(localStorage.getItem('drug-lab-v1') || '{}');
        return s.trimQueue || 0;
      });
      if (queued > 0) break;
    }
    ok(queued > 0, `Trim walks the bud onto the table (queue ${queued})`);
    ok(phoneErrors.length === 0, `phone page errors (${phoneErrors.join('; ')})`);
    await phone.close();
  } finally {
    await browser.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
