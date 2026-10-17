/* Raid Night, the Night Lot, and Nia.
 *
 * Nia is local logic: her call is a pure function of heat, stash and cash.
 * The lot is not a cash buy. It opens when a raid night is survived, and
 * only after she has seen a harvest. Hook-free.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const src = fs.readFileSync(path.join(ROOT, 'drug-lab.html'), 'utf8');
ok(/id:'lot',\s*gx:-1,gz:-1/.test(src) && /Survive Raid Night/.test(src),
  'the Night Lot is a room gated on Raid Night');
ok(/function niaPlan\(\)/.test(src) && /LOT_DRAIN = 0\.2/.test(src)
  && !/fetch\(/.test(src.slice(src.indexOf('function niaPlan'), src.indexOf('function triggerEvent'))),
  'Nia decides locally');

function save(extra) {
  return JSON.stringify(Object.assign({
    cash: 50, totalEarned: 0, totalSold: 0, heat: 0,
    difficulty: 'careful', ownedRooms: ['garage'],
    niaSeenWork: false, raidNightWon: false, raidCool: 0,
    upgrades: {}, stashCount: 0,
  }, extra));
}

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
    await page.clock.install({ time: new Date('2026-10-17T16:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-17T16:00:01Z'));
    await page.goto(BASE + '/drug-lab.html', { waitUntil: 'load' });
    await page.click('#diff-careful');
    await page.click('#intro-go');
    const locked = await page.locator('#raid-call').evaluate(el => ({
      disabled: el.disabled,
      text: el.textContent,
    }));
    const line = await page.locator('#nia-line').textContent();
    const lot = await page.locator('#expand-list').innerText();
    ok(locked.disabled && /locked/i.test(locked.text) && /Harvest once/.test(line),
      `Nia will not call the night before a harvest (${locked.text} / ${line})`);
    ok(/Night Lot/.test(lot) && /Survive Raid Night/.test(lot),
      `the lot is listed as a raid unlock (${lot.split('\n').find(l => /Lot/.test(l))})`);

    for (let i = 0; i < 30; i++) {
      await page.clock.runFor(800);
      const ready = await page.evaluate(() => [...document.querySelectorAll('.grow-label,.label')].some(el => /READY/.test(el.textContent || ''))
        || /READY/.test(document.body.innerText));
      if (ready) break;
    }
    await page.locator('#nia-ask').click();
    let carrying = null;
    for (let i = 0; i < 40; i++) {
      await page.clock.runFor(200);
      carrying = await page.evaluate(() => {
        window.dispatchEvent(new Event('pagehide'));
        return JSON.parse(localStorage.getItem('drug-lab-v1') || '{}').pCarrying || null;
      });
      if (carrying === 'bud') break;
    }
    ok(carrying === 'bud', `Ask Nia walks a ripe plant into her hands (carrying ${carrying})`);
    const call = await page.locator('#raid-call').evaluate(el => ({ disabled: el.disabled, text: el.textContent }));
    ok(!call.disabled && call.text === 'Call Raid Night', `the harvest unlocks the night (${call.text}, disabled ${call.disabled})`);

    await page.locator('#raid-call').click();
    const body = await page.locator('#raid-night-body').innerText();
    const holdOff = await page.locator('#raid-hold').isDisabled();
    ok(/Sergeant Voss/.test(body) && /Nia would kill the lights/.test(body) && holdOff,
      `an empty shelf makes Nia kill the lights, and Hold stays shut (${body.slice(0, 80)})`);
    await page.locator('#raid-lights').click();
    const after = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('drug-lab-v1') || '{}');
      return {
        open: document.getElementById('raid-night-modal').classList.contains('open'),
        won: s.raidNightWon, rooms: s.ownedRooms, cool: s.raidCool,
        post: document.getElementById('nia-post').textContent,
        heat: document.getElementById('heat-rate').textContent,
        list: document.getElementById('expand-list').innerText,
      };
    });
    ok(!after.open && after.won && after.rooms.includes('lot') && after.cool === 50,
      `living through the night opens the lot (won ${after.won}, rooms ${after.rooms}, cool ${after.cool})`);
    ok(after.post === 'Night Lot' && /0\.5/.test(after.heat) && /Night Lot/.test(after.list),
      `Nia posts up and the lot cools the block (${after.post} / ${after.heat})`);
    const again = await page.locator('#raid-call').evaluate(el => ({
      disabled: el.disabled,
      text: el.textContent,
      open: document.getElementById('raid-night-modal').classList.contains('open'),
    }));
    ok(again.disabled && !again.open && /Laying low/.test(again.text),
      `a second night lays low (${again.text})`);
    ok(errors.length === 0, `desktop page errors (${errors.join('; ')})`);
    await desk.close();

    async function plan(name, extra, expect) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const p = await ctx.newPage();
      const errs = [];
      p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
      await p.addInitScript((raw) => {
        localStorage.setItem('growop-intro-seen', '1');
        localStorage.setItem('drug-lab-v1', raw);
      }, save(extra));
      await p.goto(BASE + '/drug-lab.html', { waitUntil: 'load' });
      await p.locator('#raid-call').click();
      const text = await p.locator('#raid-night-body').innerText();
      ok(text.includes(expect), `${name}: Nia would ${expect} (${text.slice(-40)})`);
      ok(errs.length === 0, `${name}: no page errors ${errs.join('; ')}`);
      await ctx.close();
    }
    await plan('quiet shelf', { niaSeenWork: true, heat: 10, cash: 40, stashCount: 3 }, 'hold the lot');
    await plan('cash on hand', { niaSeenWork: true, heat: 10, cash: 400, stashCount: 3 }, 'pay Voss off');
    await plan('hot block', { niaSeenWork: true, heat: 60, cash: 400, stashCount: 5 }, 'kill the lights');

    const phoneErrors = [];
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await phone.newPage();
    p.on('pageerror', e => phoneErrors.push(String(e).split('\n')[0]));
    await p.addInitScript((raw) => {
      localStorage.setItem('growop-intro-seen', '1');
      localStorage.setItem('drug-lab-v1', raw);
    }, save({ niaSeenWork: true }));
    await p.goto(BASE + '/drug-lab.html', { waitUntil: 'load' });
    await p.click('#manage-btn');
    await p.locator('#raid-call').scrollIntoViewIfNeeded();
    const hit = await p.evaluate(() => {
      const own = id => {
        const el = document.getElementById(id);
        const b = el.getBoundingClientRect();
        const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return top && (top === el || el.contains(top)) ? '' : id + ' covered by ' + (top && (top.id || top.className));
      };
      return [own('nia-ask'), own('raid-call')].filter(Boolean);
    });
    ok(hit.length === 0, `phone sheet: Nia owns her buttons${hit.length ? ' — ' + hit.join('; ') : ''}`);
    ok(phoneErrors.length === 0, `phone page errors (${phoneErrors.join('; ')})`);
    await phone.close();
  } finally {
    await browser.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
