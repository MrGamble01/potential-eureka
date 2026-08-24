/*
 * HVALE-6 — Hearthvale: the work roster (re-runnable; no test hook).
 *  A. The 🧭 The Right Hands achievement is registered in the modal.
 *  B. A worker building's panel offers the roster button; the Tavern,
 *     which needs no worker, does not.
 *  C. The roster lists every villager, ranked by projected output at that
 *     bench, with the sitting worker marked and unclickable.
 *  D. Picking a villager who already holds a post TRADES posts — the farm
 *     gets the pick, the fishing hut gets the displaced worker, neither
 *     bench is emptied.
 *  E. The swap survives a reload, and `postings` rides the save.
 *  F. Five postings unlock 🧭 The Right Hands.
 *  Z. Zero page errors.
 *
 * The game is a closed IIFE, so every leg drives the real UI: the minimap
 * centres the camera on a known tile, a click on the middle of the screen
 * selects what's under it, and every assertion reads rendered DOM.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

const TILE = 16, MAP_W = 56, MAP_H = 42;
const W = MAP_W * TILE, H = MAP_H * TILE;

// Buildings sit mid-map so centring never hits the camera clamp.
const HOUSE = { tx: 18, ty: 20 }, FARM = { tx: 26, ty: 20 }, FISH = { tx: 34, ty: 20 }, TAVERN = { tx: 26, ty: 27 };
const SAVE = {
  seed: 4242, day: 4, time: 10, _nextId: 10, _lastProdHour: 10, _prodAbs: 4 * 24 + 10,
  res: { wood: 200, stone: 200, food: 120, gold: 400 },
  happy: 60, seenIntro: true, goalIndex: 0, sadDays: 0, roads: [], muted: true,
  nextEventDay: 99, nextTraderDay: 99, traderDay: 0, achievements: [], townName: 'Hearthvale',
  difficulty: 'normal', decrees: [], chronicle: [], postings: 0,
  buildings: [
    { id: 1, type: 'house', tx: HOUSE.tx, ty: HOUSE.ty, level: 1, done: true },
    { id: 2, type: 'farm', tx: FARM.tx, ty: FARM.ty, level: 1, done: true },
    { id: 3, type: 'fishing', tx: FISH.tx, ty: FISH.ty, level: 1, done: true },
    { id: 4, type: 'tavern', tx: TAVERN.tx, ty: TAVERN.ty, level: 1, done: true },
  ],
  villagers: [
    { id: 5, homeId: 1, jobId: 2, tx: HOUSE.tx, ty: HOUSE.ty + 2, name: 'Alfa', xp: 0, color: '#e06a5c', ph: 0 },
    { id: 6, homeId: 1, jobId: 3, tx: HOUSE.tx + 1, ty: HOUSE.ty + 2, name: 'Bravo', xp: 90, color: '#5f83c8', ph: 1 },
  ],
};

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  // seed once — the reload leg must keep what the first leg wrote
  await page.addInitScript(save => {
    if (sessionStorage.getItem('hvr-init')) return;
    sessionStorage.setItem('hvr-init', '1');
    localStorage.setItem('hearthvale-v1', JSON.stringify(save));
  }, SAVE);
  await page.goto(BASE + '/hearthvale.html', { waitUntil: 'load' });
  await page.waitForTimeout(2200);

  const txt = sel => page.$eval(sel, el => el.innerText.trim()).catch(() => '');
  const has = sel => page.$(sel).then(el => !!el);

  // Centre the camera on a tile via the minimap, then click the middle of the
  // screen. Villagers win the hit test within 8 world px, so nudge and retry
  // until the panel names the building we're after.
  async function select(tx, ty, name) {
    const box = await page.$eval('#minimap', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    await page.mouse.move(box.x + box.w * ((tx + 0.5) * TILE / W), box.y + box.h * ((ty + 0.5) * TILE / H));
    await page.mouse.down(); await page.mouse.up();
    await page.waitForTimeout(120);
    for (const [dx, dy] of [[0, 0], [16, 0], [0, 16], [16, 16], [-16, 8], [8, -16]]) {
      await page.mouse.move(700 + dx, 450 + dy);
      await page.mouse.down(); await page.mouse.up();
      await page.waitForTimeout(160);
      if ((await txt('#p-name')).indexOf(name) === 0) return true;
    }
    return false;
  }
  const rosterRows = () => page.$$eval('#roster-list .roster-row', rows => rows.map(r => ({
    name: r.querySelector('.rname').innerText.trim(),
    desc: r.querySelector('.rdesc').innerText.trim(),
    tag: r.querySelector('.rtag').innerText.trim(),
    here: r.classList.contains('here'),
  })));

  // A. the achievement is registered
  await page.click('#menu-btn'); await page.click('#m-achv'); await page.waitForTimeout(150);
  const achv = await txt('#achv-list');
  ok(/The Right Hands/.test(achv) && /five times/i.test(achv), 'A. 🧭 The Right Hands is on the achievement board');
  await page.click('#achv-close'); await page.waitForTimeout(120);

  // B. the panel button, only where a worker belongs
  ok(await select(FARM.tx, FARM.ty, 'Farm'), 'B1. the Farm can be selected');
  ok(await has('#p-roster'), 'B2. a worker building offers the roster button');
  ok(/Reassign/.test(await txt('#p-roster')), 'B3. a staffed bench reads "Reassign"');
  ok(await select(TAVERN.tx, TAVERN.ty, 'Tavern'), 'B4. the Tavern can be selected');
  ok(!(await has('#p-roster')), 'B5. a workerless building offers no roster button');

  // C. the roster, ranked
  await select(FARM.tx, FARM.ty, 'Farm');
  await page.click('#p-roster'); await page.waitForTimeout(200);
  ok(await page.$eval('#roster', el => el.classList.contains('show')), 'C1. the roster opens');
  const rows = await rosterRows();
  ok(rows.length === 2, 'C2. every villager is listed (2)');
  const nums = rows.map(r => parseInt(r.tag, 10));
  ok(nums.every(n => n > 0) && nums[0] >= nums[1], 'C3. rows are ranked by projected output, best first (' + nums.join(' ≥ ') + ')');
  const sitting = rows.filter(r => r.here);
  ok(sitting.length === 1 && sitting[0].name.indexOf('Alfa') === 0, 'C4. the sitting worker is marked "here now"');
  ok(rows.some(r => /Grandmaster/.test(r.desc)) && rows.some(r => /Novice/.test(r.desc)), 'C5. each row states nature, mastery and current post');
  ok(rows.some(r => /at the Fishing Hut/.test(r.desc)), 'C6. a villager who holds another post says so');

  // D. picking trades posts
  const pickIdx = rows.findIndex(r => !r.here);
  await page.$$eval('#roster-list .roster-row', (els, i) => els[i].click(), pickIdx);
  await page.waitForTimeout(300);
  ok(!(await page.$eval('#roster', el => el.classList.contains('show'))), 'D1. the roster closes on a pick');
  ok(/Bravo/.test(await txt('#p-stats')), 'D2. the Farm now names the picked villager');
  ok(await select(FISH.tx, FISH.ty, 'Fishing Hut'), 'D3. the Fishing Hut can be selected');
  ok(/Alfa/.test(await txt('#p-stats')), 'D4. the displaced worker took the picked villager’s old post — no empty bench');

  // E. it survives a reload, and the counter rides the save
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('hearthvale-v1')));
  ok(stored.postings === 1, 'E1. `postings` is written to the save');
  ok(stored.villagers.find(v => v.name === 'Bravo').jobId === 2 && stored.villagers.find(v => v.name === 'Alfa').jobId === 3,
    'E2. both jobIds are persisted swapped');
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2200);
  await select(FARM.tx, FARM.ty, 'Farm');
  ok(/Bravo/.test(await txt('#p-stats')), 'E3. the posting holds across a reload');

  // F. five postings unlock the trophy
  for (let i = 0; i < 4; i++) {
    await select(FARM.tx, FARM.ty, 'Farm');
    await page.click('#p-roster'); await page.waitForTimeout(180);
    const r = await rosterRows();
    const idx = r.findIndex(x => !x.here);
    await page.$$eval('#roster-list .roster-row', (els, j) => els[j].click(), idx);
    await page.waitForTimeout(220);
  }
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('hearthvale-v1')));
  ok(after.postings === 5, 'F1. five postings counted (' + after.postings + ')');
  ok((after.achievements || []).indexOf('foreman') >= 0, 'F2. 🧭 The Right Hands unlocked at five');

  // Z. clean console
  ok(errs.length === 0, 'Z. zero page errors' + (errs.length ? ' — ' + errs.join(' | ') : ''));

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
