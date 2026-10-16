/*
 * LAB-62 — Grow Op had no crash course.
 *
 * Five of the six flagships greeted a new player with one; this one
 * opened on a difficulty picker offering "heat you can manage" to
 * somebody who had not yet been told what heat is.
 *
 * The panel quotes real numbers, and quoted numbers rot. Every figure
 * below is recomputed from drug-lab.html and compared against the copy,
 * so a balance change that leaves the panel behind fails here instead of
 * lying to a new player (the HV-56 rule, applied to the corner).
 *
 *  A. Source: the crash course exists and ui-level constants back it.
 *  B. Drift: heat-per-unit, the raid line, the bust line and the demand
 *     band in the copy all match the code they describe.
 *  C. The stash cap is rendered from STASH_MAX_BASE, not typed.
 *  D. A fresh run shows the difficulty picker FIRST, then the course —
 *     the two panels never stack.
 *  E. Escape closes it and marks it seen; ? reopens it.
 *  F. A player who has seen it does not get it again.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives the production overlay.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const src = fs.readFileSync(path.join(ROOT, 'drug-lab.html'), 'utf8');
const introAt = src.indexOf('id="intro-modal"');
const body = introAt >= 0 ? src.slice(introAt, src.indexOf('</div>\n</div>', introAt)) : '';

ok(introAt >= 0 && /RUNNING THE CORNER/.test(body),
  'LAB-62: the corner has a crash course');

// B. every quoted number, recomputed from the code that owns it.
const heatPerUnit = /function heatGainPerSale\([^)]*\)\s*{\s*return Math\.max\(1,\s*(\d+)\s*-/.exec(src);
ok(!!heatPerUnit && new RegExp(`<b>${heatPerUnit[1]} per unit</b>`).test(body),
  `the copy's heat-per-unit matches heatGainPerSale (${heatPerUnit ? heatPerUnit[1] : '?'})`);

const raidLine = /state\.heat\s*>=\s*(\d+)\s*&&\s*!raidActive/.exec(src);
ok(!!raidLine && new RegExp(`At ${raidLine[1]} heat the raid comes`).test(body),
  `the copy's raid line matches the code (${raidLine ? raidLine[1] : '?'})`);

const bustLine = /if \(state\.heat >= (\d+)\) triggerBust\(\)/.exec(src);
ok(!!bustLine && new RegExp(`at ${bustLine[1]} you are busted`).test(body),
  `the copy's bust line matches triggerBust (${bustLine ? bustLine[1] : '?'})`);

const drift = /market\.target = ([\d.]+) \+ Math\.random\(\) \* ([\d.]+);/.exec(src);
const lo = drift && Number(drift[1]);
const hi = drift && +(Number(drift[1]) + Number(drift[2])).toFixed(2);
ok(!!drift && new RegExp(`${lo}× and ${hi}×`).test(body),
  `the copy's demand band matches the market roll (${lo}×–${hi}×)`);

ok(/id="intro-stash"/.test(body) && /cap\.textContent = String\(STASH_MAX_BASE\)/.test(src),
  'the stash cap is rendered from STASH_MAX_BASE, not typed into the copy');

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
    localStorage.removeItem('drug-lab-v1');
    localStorage.removeItem('growop-intro-seen');
  });
  await page.goto(BASE + '/drug-lab.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  const fresh = await page.evaluate(() => ({
    diff: document.getElementById('diff-modal').classList.contains('open'),
    intro: document.getElementById('intro-modal').classList.contains('open'),
  }));
  ok(fresh.diff && !fresh.intro,
    'a fresh run picks a difficulty first — the two panels do not stack');

  await page.click('#diff-careful');
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => ({
    diff: document.getElementById('diff-modal').classList.contains('open'),
    intro: document.getElementById('intro-modal').classList.contains('open'),
    stash: document.getElementById('intro-stash').textContent,
  }));
  ok(!after.diff && after.intro, 'the course opens once the difficulty is picked');

  const capConst = /const STASH_MAX_BASE = (\d+)/.exec(src);
  ok(!!capConst && after.stash === capConst[1],
    `the rendered cap is the live constant (${after.stash} = STASH_MAX_BASE)`);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const closed = await page.evaluate(() => ({
    open: document.getElementById('intro-modal').classList.contains('open'),
    seen: localStorage.getItem('growop-intro-seen'),
  }));
  ok(!closed.open && closed.seen === '1', 'Escape closes it and marks it seen');

  await page.click('#lab-help-btn');
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.getElementById('intro-modal').classList.contains('open')),
    'the ? button reopens it after it has been dismissed');

  // F. a returning player is not made to read it again.
  const page2 = await ctx.newPage();
  const errs2 = [];
  page2.on('pageerror', e => errs2.push(String(e).slice(0, 300)));
  await page2.goto(BASE + '/drug-lab.html', { waitUntil: 'load' });
  await page2.waitForTimeout(3000);
  ok(!(await page2.evaluate(() => document.getElementById('intro-modal').classList.contains('open'))),
    'a player who has seen it gets straight back to work');

  await browser.close();
  ok(errs.length === 0 && errs2.length === 0,
    `no page errors${errs.length ? ' — ' + errs[0] : errs2.length ? ' — ' + errs2[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
