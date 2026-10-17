/* Hub career: profile, XP, trophies, themes.
 *
 * The schema half runs in Node against the shared progress document.
 * The browser half opens the trophy room, checks it on a phone, and
 * confirms Hearthvale's own Begin building button awards a trophy.
 */
const { chromium } = require('playwright');
const Persist = require('../../js/persist.js');
const Progress = require('../../js/progression.js');

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

function careerApi(store) {
  const box = store || mem();
  return { store: box, persist: Persist.create(box), api: Progress.create(Persist.create(box)) };
}

{
  const box = mem();
  const persist = Persist.create(box);
  const api = Progress.create(persist);
  ok(api.profile().level === 1 && api.profile().xp === 0 && api.profile().displayName === 'Player',
    'a fresh career is level 1 with no name');
  ok(box.getItem(Persist.PROGRESS_KEY) == null, 'reading the career does not write a document');
  ok(Progress.levelFor(0) === 1 && Progress.levelFor(39) === 1 && Progress.levelFor(40) === 2 && Progress.levelFor(100) === 3,
    'level 2 starts at 40 XP and level 3 at 100');
}

{
  const box = mem();
  const persist = Persist.create(box);
  const api = Progress.create(persist);
  const first = api.emit('hearthvale', 'found', 1);
  ok(first.indexOf('hearth-found') >= 0 && api.profile().xp === 25, 'founding a valley awards Valley Founded once');
  ok(api.emit('hearthvale', 'found', 1).length === 0 && api.profile().xp === 25, 'the same event does not pay twice');
  ok(api.emit('tycoon', 'nope').length === 0, 'an unknown event is ignored');
  api.emit('hearthvale', 'pop', 3);
  ok(!api.profile().unlocked['hearth-folk'], 'three villagers are not five hearths yet');
  api.emit('hearthvale', 'pop', 5);
  ok(!!api.profile().unlocked['hearth-folk'], 'five villagers award Five Hearths');
  api.emit('hearthvale', 'pop', 4);
  ok(api.profile().stats['hearthvale.pop'] === 5, 'population keeps the high-water mark');
}

{
  const box = mem();
  const persist = Persist.create(box);
  const api = Progress.create(persist);
  api.emit('tycoon', 'visit', 1);
  ok(!!api.profile().unlocked['tycoon-open'] && !api.profile().unlocked['beagle-open'],
    'Startup Tycoon and Beagle Sim do not share a shelf');
  api.setTheme('lantern');
  ok(api.profile().theme === '', 'Lantern stays locked before 3 trophies');
  api.emit('beagle', 'visit', 1);
  ok(!!api.profile().unlocked['beagle-open'] && !!api.profile().unlocked['cross-two'],
    'a second flagship awards Making the Rounds');
  api.setTheme('lantern');
  ok(api.profile().theme === 'lantern', 'the third trophy unlocks Lantern');
}

{
  const box = mem();
  const persist = Persist.create(box);
  const api = Progress.create(persist);
  api.emit('tycoon', 'visit', 1);
  api.emit('tycoon', 'hire');
  api.emit('tycoon', 'ship');
  ok(api.profile().level === 2 && !api.profile().unlocked['cross-warm'], 'three early trophies land at level 2');
  api.emit('tycoon', 'ipo');
  ok(!!api.profile().unlocked['cross-warm'] && api.profile().xp === 195,
    'the IPO crosses level 3 and Warming Up pays its XP (195)');
  api.setName('  A ');
  ok(api.profile().name === 'A' && !api.profile().unlocked['cross-name'], 'a one-letter name is not a signature');
  api.setName('Ada Lovelace the long');
  ok(api.profile().name === 'Ada Lovelace the' && !!api.profile().unlocked['cross-name'],
    'a name is kept to 16 characters and signs the ledger');
  api.setTheme('lantern');
  ok(api.profile().theme === 'lantern', 'three trophies unlock the Lantern theme');
  api.setTheme('glacier');
  ok(api.profile().theme === 'glacier' && api.profile().level === 4, 'level 4 unlocks Glacier');
}

{
  const box = mem();
  const persist = Persist.create(box);
  persist.progress.note('hearthvale', { day: 4, name: 'Mill' });
  const api = Progress.create(persist);
  api.emit('clinic', 'visit', 1);
  api.emit('clinic', 'dawn', 3);
  ok(!!api.profile().unlocked['clinic-in'] && !!api.profile().unlocked['clinic-three'],
    'Night Clinic dawns award Clocked In and Three Dawns');
  ok(persist.progress.clear('hearthvale') === true && persist.progress.has('hearthvale') === false, 'clearing a town drops its continue');
  ok(!!api.profile().unlocked['clinic-three'] && api.profile().xp > 0, 'a game reset does not wipe the career');
  ok(persist.progress.get('hearthvale') == null, 'the cleared town stays cleared');
}

{
  const box = mem();
  box.setItem(Persist.PROGRESS_KEY, JSON.stringify({
    v: 4,
    extra: true,
    games: { hearthvale: { savedAt: 5, summary: { day: 2 }, badge: 'oak' } },
  }));
  const persist = Persist.create(box);
  const api = Progress.create(persist);
  api.setName('Ada');
  const raw = JSON.parse(box.getItem(Persist.PROGRESS_KEY));
  ok(raw.v === 4 && raw.extra === true && raw.career && raw.career.name === 'Ada'
    && raw.games.hearthvale.badge === 'oak' && raw.games.hearthvale.summary.day === 2,
    'saving a career on a newer progress document keeps its version, extra fields, and the other game');
}

{
  const box = mem();
  box.setItem(Persist.PROGRESS_KEY, JSON.stringify({
    v: 1,
    games: {},
    career: { name: '12345678901234567890', xp: -4, unlocked: { 'nope!': 1, ok: 5 }, stats: null, avatar: 'BAD' },
  }));
  const career = Persist.create(box).progress.career();
  ok(career.name.length === 16 && career.xp === 0 && career.unlocked.ok === 5 && !career.unlocked['nope!'] && career.avatar === '',
    'a messy career blob is clamped and does not throw');
  const stamped = mem();
  const stampedApi = Progress.create(Persist.create(stamped));
  stampedApi.emit('tycoon', 'visit', 1);
  const at = stampedApi.profile().unlocked['tycoon-open'];
  const reloaded = Persist.create(stamped).progress.career().unlocked['tycoon-open'];
  ok(at > 1e12 && reloaded === at, 'an unlock remembers the day it happened');
  const broken = mem();
  broken.setItem(Persist.PROGRESS_KEY, '{nope');
  let threw = false;
  try { Persist.create(broken).progress.career(); } catch (e) { threw = true; }
  ok(!threw, 'corrupt progress does not throw when the career is read');
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errs = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 240)));
    await page.goto(BASE + '/#trophy', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#view-trophy.active .trophy-card', { timeout: 15000 });
    const room = await page.evaluate(() => ({
      title: document.querySelector('.trophy-title') && document.querySelector('.trophy-title').textContent,
      shelves: document.querySelectorAll('.trophy-shelf').length,
      cards: document.querySelectorAll('.trophy-card').length,
      got: document.querySelectorAll('.trophy-card.is-got').length,
      night: /Night Clinic/.test(document.body.innerText),
      tycoon: /Startup Tycoon/.test(document.body.innerText),
      beagle: /Beagle Sim/.test(document.body.innerText),
      chip: (document.getElementById('career-chip') || {}).innerText || '',
    }));
    ok(room.title === 'Trophy Room' && room.shelves === 7 && room.cards === Progress.ACHIEVEMENTS.length && room.got === 0,
      `trophy room lists every shelf empty (${room.shelves} shelves, ${room.cards} cards)`);
    ok(room.night && room.tycoon && room.beagle && /Lv 1/.test(room.chip),
      'Night Clinic, Tycoon, and Beagle are on the wall and the chip starts at level 1');

    await page.locator('.trophy-name-input').fill('Ada');
    await page.locator('.trophy-name-row').evaluate((form) => form.requestSubmit());
    await page.waitForFunction(() => {
      const toast = document.querySelector('.career-toast-name');
      return toast && /Signed the Ledger/.test(toast.textContent);
    });
    const named = await page.evaluate(() => EurekaProgress.profile());
    ok(named.name === 'Ada' && named.unlocked['cross-name'] && named.level >= 1, 'saving a name signs the ledger');

    await page.evaluate(() => {
      const ev = [
        ['tycoon', 'visit', 1], ['tycoon', 'hire'], ['tycoon', 'ship'], ['tycoon', 'ipo'],
        ['beagle', 'visit', 1], ['beagle', 'hire'], ['beagle', 'ship'], ['beagle', 'ipo'],
        ['hearthvale', 'found', 1], ['hearthvale', 'build', 3], ['hearthvale', 'pop', 6], ['hearthvale', 'festival', 1],
        ['voxel', 'visit', 1], ['voxel', 'harvest', 4], ['voxel', 'level', 3], ['voxel', 'build', 1],
        ['growop', 'visit', 1], ['growop', 'sale', 2], ['growop', 'earned', 800], ['growop', 'hire', 1],
        ['clinic', 'visit', 1], ['clinic', 'dawn', 3], ['clinic', 'rest'],
      ];
      ev.forEach((e) => EurekaProgress.emit(e[0], e[1], e[2]));
    });
    await page.waitForSelector('.trophy-card.is-got', { timeout: 5000 });
    const filled = await page.evaluate(() => ({
      got: document.querySelectorAll('.trophy-card.is-got').length,
      level: EurekaProgress.profile().level,
    }));
    ok(filled.got >= 24 && filled.level >= 5, `the room fills in (${filled.got} trophies, level ${filled.level})`);
    await page.evaluate(() => EurekaProgress.setTheme('lantern'));
    const themed = await page.evaluate(() => document.documentElement.dataset.theme);
    ok(themed === 'lantern', 'equipping Lantern paints the hub');

    const saved = await ctx.storageState();
    await ctx.close();

    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, storageState: saved });
    const pp = await phone.newPage();
    pp.on('pageerror', (e) => errs.push(String(e).slice(0, 240)));
    await pp.goto(BASE + '/#trophy', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await pp.waitForSelector('#view-trophy.active .trophy-card.is-got', { timeout: 15000 });
    const fit = await pp.evaluate(() => {
      const input = document.querySelector('.trophy-name-input');
      const btn = document.querySelector('.trophy-btn');
      const play = document.querySelector('.trophy-play');
      return {
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        font: parseFloat(getComputedStyle(input).fontSize),
        btn: btn.getBoundingClientRect().height,
        play: play.getBoundingClientRect().height,
        name: (document.querySelector('.trophy-name-input') || {}).value,
      };
    });
    ok(!fit.overflow && fit.font >= 16 && fit.btn >= 44 && fit.play >= 44 && fit.name === 'Ada',
      `phone trophy room fits (${fit.font}px input, ${Math.round(fit.btn)}px button, overflow ${fit.overflow})`);
    await phone.close();

    const game = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const gp = await game.newPage();
    gp.on('pageerror', (e) => errs.push(String(e).slice(0, 240)));
    await gp.goto(BASE + '/hearthvale.html', { waitUntil: 'load', timeout: 30000 });
    await gp.locator('#welcome-close').click({ timeout: 15000 });
    await gp.waitForSelector('.career-toast', { timeout: 8000 });
    const toast = await gp.locator('.career-toast-name').innerText();
    const awarded = await gp.evaluate(() => !!(EurekaProgress.profile().unlocked || {})['hearth-found']);
    ok(/Valley Founded/.test(toast) && awarded, `Begin building unlocks in the game (${toast})`);
    await game.close();
  } catch (e) {
    ok(false, 'browser career: ' + String(e && e.message || e).split('\n')[0]);
  } finally {
    await browser.close();
  }
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
