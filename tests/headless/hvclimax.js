/* Hollow Wolf and the shared climax engine.
 *
 * The fight is pure state: tells, feints, hearts, combos, near misses.
 * A browser pass then stands the wolf from the town menu, on a phone
 * width and with the keyboard, and checks the night banner plus the
 * career trophy. The announcer bank is used with no network.
 */
const { chromium } = require('playwright');
const Persist = require('../../js/persist.js');
const Progress = require('../../js/progression.js');
const Climax = require('../../js/climax.js');
const AI = require('../../js/ai/arcade-ai.js');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

function mem() {
  const m = new Map();
  return {
    getItem(k) { return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { m.set(String(k), String(v)); },
    removeItem(k) { m.delete(k); },
  };
}

function playPerfect(enc) {
  const events = enc.start();
  let guard = 0;
  while (guard++ < 5000) {
    const snap = enc.snapshot();
    if (snap.status === 'won' || snap.status === 'lost') break;
    events.push.apply(events, enc.step(0.05));
    const now = enc.snapshot();
    if (now.status === 'open') events.push.apply(events, enc.press(now.lane));
  }
  return events;
}

{
  const a = Climax.create('hearthvale', { seed: 7 });
  const b = Climax.create('hearthvale', { seed: 7 });
  a.start(); b.start();
  let laneA = null, laneB = null;
  for (let i = 0; i < 80 && !laneA; i++) {
    a.step(0.05); b.step(0.05);
    if (a.snapshot().status === 'open') { laneA = a.snapshot().lane; laneB = b.snapshot().lane; }
  }
  ok(laneA && laneA === laneB, 'the same seed opens on the same gate (' + laneA + ')');
}

{
  const enc = Climax.create('hearthvale', { seed: 4 });
  const events = playPerfect(enc);
  const snap = enc.snapshot();
  ok(snap.status === 'won' && snap.hp === 0 && snap.hearts === 4, 'a clean read drops the wolf and keeps every heart');
  ok(events.some(e => e.type === 'combo'), 'three clean braces call a combo');
  ok(events.some(e => e.type === 'feint'), 'a later phase feints before the real gate');
  ok(events.some(e => e.type === 'phase' && (e.phase === 'charge' || e.phase === 'frenzy')), 'the wolf changes phase');
}

{
  const enc = Climax.create('tycoon', { seed: 9 });
  playPerfect(enc);
  ok(enc.snapshot().status === 'won', 'the takeover falls to the same read');
  const yard = Climax.create('beagle', { seed: 9 });
  playPerfect(yard);
  ok(yard.snapshot().status === 'won' && yard.snapshot().game === 'beagle', 'the yard raid uses the beagle skin');
}

{
  const enc = Climax.create('hearthvale', { seed: 2 });
  enc.start();
  enc.step(40);
  const snap = enc.snapshot();
  ok(snap.status === 'lost' && snap.hearts === 0 && snap.hp > 0, 'standing still spends the four hearts and does not clear the wolf');
}

{
  const enc = Climax.create('hearthvale', { seed: 5 });
  enc.start();
  let guard = 0;
  while (enc.snapshot().status !== 'open' && guard++ < 200) enc.step(0.05);
  const before = enc.snapshot();
  const wrong = before.lane === 'west' ? 'east' : 'west';
  const ev = enc.press(wrong);
  const after = enc.snapshot();
  ok(ev.some(e => e.type === 'miss') && after.hearts === before.hearts - 1 && after.hp === before.hp,
    'a wrong gate costs a heart and does not hurt the wolf');
}

{
  const enc = Climax.create('hearthvale', { seed: 6 });
  enc.start();
  enc.step(1.4);
  const before = enc.snapshot();
  const ev = enc.press('west');
  const after = enc.snapshot();
  ok(before.status === 'windup' && ev.some(e => e.type === 'early') && after.hp === before.hp && after.hearts === before.hearts && after.status === 'windup',
    'pressing during the tell does not resolve the strike');
}

{
  const enc = Climax.create('hearthvale', { seed: 8 });
  enc.start();
  let guard = 0;
  while (enc.snapshot().status !== 'open' && guard++ < 200) enc.step(0.05);
  const openFor = enc.snapshot().timer;
  enc.step(Math.max(0, openFor - 0.1));
  const now = enc.snapshot();
  const ev = enc.press(now.lane);
  ok(now.status === 'open' && now.timer <= 0.2 && now.timer > 0 && ev.some(e => e.type === 'nearmiss'),
    'a late-but-legal brace is a near miss (' + now.timer.toFixed(3) + 's left)');
}

{
  ok(Climax.keyLane('hearthvale', 'a') === 'west' && Climax.keyLane('hearthvale', 'ArrowLeft') === 'west', 'A and Left brace the west gate');
  ok(Climax.keyLane('tycoon', '2') === 'poach' && Climax.keyLane('beagle', 'd') === 'gate', 'number and letter keys map both offices');
  ok(Climax.keyLane('hearthvale', 'q') == null, 'an unbound key is not a gate');
  const a = Climax.line('hearthvale', 'hit', 0);
  const b = Climax.line('hearthvale', 'hit', 1);
  ok(a && b && a !== b && a.indexOf('Wren') === 0, 'the announcer bank varies Wren without a network call');
  ok(Climax.line('tycoon', 'win', 0).indexOf('Quinn') === 0 && Climax.line('beagle', 'feint', 1).indexOf('Biscuit') === 0,
    'Quinn and Biscuit keep their own lines');
}

(async () => {
  const flavored = await Climax.flavor('hearthvale', { type: 'event', detail: 'West gate held' }, AI.createStubProvider());
  ok(typeof flavored === 'string' && flavored.length > 0, 'the booth stub can season a line (' + flavored + ')');
  const quiet = await Climax.flavor('hearthvale', { type: 'hit', detail: 'hearth' }, {
    announce: function () { return Promise.reject(new Error('offline')); },
  });
  ok(quiet == null, 'a failed booth leaves the bank line in charge');

  const box = mem();
  const api = Progress.create(Persist.create(box));
  const first = api.emit('hearthvale', 'boss', 1);
  ok(first.indexOf('hearth-wolf') >= 0 && first.indexOf('cross-boss') >= 0, 'the wolf awards Hollow Wolf and First Boss Down');
  ok(api.emit('hearthvale', 'boss', 1).length === 0 && api.profile().stats['hearthvale.boss'] === 1, 'the same stand does not pay twice');
  const office = Progress.create(Persist.create(mem()));
  const bid = office.emit('tycoon', 'boss', 1);
  ok(bid.indexOf('tycoon-takeover') >= 0 && bid.indexOf('cross-boss') >= 0 && !office.profile().unlocked['hearth-wolf'],
    'the takeover has its own trophy and still counts as the first boss');
  const pack = Progress.create(Persist.create(mem()));
  ok(pack.emit('beagle', 'boss', 1).indexOf('beagle-raid') >= 0, 'the yard raid has its own trophy');

  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(BASE + '/hearthvale.html', { waitUntil: 'load', timeout: 30000 });
    await page.locator('#welcome-close').click({ timeout: 15000 });
    const before = await page.locator('#r-gold').innerText();
    await page.click('#menu-btn');
    await page.click('#m-wolf');
    await page.waitForSelector('#climax-root');
    const intro = await page.locator('#climax-call').innerText();
    const bar = await page.locator('.cx-bar').getAttribute('aria-valuenow');
    ok(/Wren:/.test(intro) && bar === '96', 'Wren calls the stand and the wolf bar starts full (' + intro + ')');
    const keys = await page.evaluate(() => {
      const view = document.getElementById('climax-root').__view;
      view.hold();
      let guard = 0;
      while (view.encounter.snapshot().status !== 'open' && guard++ < 200) view.encounter.step(0.05);
      return view.encounter.snapshot().lane;
    });
    await page.keyboard.press(keys === 'west' ? 'a' : keys === 'hearth' ? 's' : 'd');
    const braced = await page.evaluate(() => {
      const snap = document.getElementById('climax-root').__view.encounter.snapshot();
      return { hp: snap.hp, call: document.getElementById('climax-call').textContent };
    });
    ok(braced.hp < 96 && /Wren:/.test(braced.call), 'the A/S/D key that matches the gate lands (' + braced.call + ')');
    const end = await page.evaluate(() => document.getElementById('climax-root').__view.playout());
    ok(end.status === 'won', 'the rest of the stand finishes the wolf');
    await page.waitForFunction(() => {
      const profile = window.EurekaProgress && EurekaProgress.profile();
      return profile && profile.unlocked && profile.unlocked['hearth-wolf'];
    });
    const after = await page.evaluate(() => ({
      gold: document.getElementById('r-gold').textContent,
      call: document.getElementById('climax-call').textContent,
      reward: document.querySelector('.cx-reward').textContent,
      banner: document.getElementById('climax-root').__view.encounter.snapshot().status,
      boss: !!(EurekaProgress.profile().unlocked || {})['cross-boss'],
    }));
    ok(Number(after.gold) === Number(before) + 120 && /banner/i.test(after.reward) && after.boss,
      'the night banner pays 120 gold and First Boss Down (' + after.reward + ')');
    await page.click('#climax-close');
    ok(await page.locator('#climax-root').count() === 0, 'Back returns to the valley');
    await context.close();

    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const pp = await phone.newPage();
    pp.on('pageerror', e => errors.push(String(e)));
    await pp.goto(BASE + '/hearthvale.html', { waitUntil: 'load', timeout: 30000 });
    await pp.locator('#welcome-close').click({ timeout: 15000 });
    await pp.locator('#menu-btn').tap();
    await pp.locator('#m-wolf').tap();
    await pp.waitForSelector('#climax-root');
    const boxLane = await pp.locator('.cx-lane').first().boundingBox();
    const fit = await pp.evaluate(() => {
      const lane = document.querySelector('.cx-lane').getBoundingClientRect();
      const root = document.getElementById('climax-root').getBoundingClientRect();
      return {
        tall: lane.height,
        inside: lane.bottom <= window.innerHeight + 1 && lane.top >= 0,
        wide: root.width <= window.innerWidth + 1,
      };
    });
    ok(boxLane && fit.tall >= 48 && fit.inside && fit.wide, 'phone gates are at least 48px and on screen (' + Math.round(fit.tall) + 'px)');
    await pp.locator('.cx-lane').first().tap();
    const tapped = await pp.locator('#climax-call').innerText();
    ok(/Wren:/.test(tapped), 'a thumb gets a callout (' + tapped + ')');
    await phone.close();
  } catch (e) {
    ok(false, 'browser wolf: ' + String(e && e.message || e).split('\n')[0]);
  } finally {
    await browser.close();
  }
  ok(errors.length === 0, 'no page errors' + (errors.length ? ' — ' + errors[0] : ''));
  console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
