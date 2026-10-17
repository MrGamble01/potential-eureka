/* Hearthvale Wilds Expedition.
 *
 * The generator is pure and runs in Node: one seed, one trail,
 * and a cautious walk of strikes and shrines reaches the camp.
 * The browser half opens the real overlay, steps the scout,
 * and checks the seed, the phone targets, and today's daily trail.
 */
const { chromium } = require('playwright');
const Exp = require('../../js/hearthvale-expedition.js');
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

function digest(exp) {
  return JSON.stringify(exp);
}

function reachable(exp) {
  const walk = { trail: 1, glade: 1, gate: 1, camp: 1 };
  const q = [exp.gate];
  const seen = new Set([exp.gate.x + ',' + exp.gate.y]);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (q.length) {
    const p = q.shift();
    if (p.x === exp.camp.x && p.y === exp.camp.y) return true;
    for (let i = 0; i < dirs.length; i++) {
      const nx = p.x + dirs[i][0];
      const ny = p.y + dirs[i][1];
      const k = nx + ',' + ny;
      if (seen.has(k)) continue;
      if (nx < 0 || ny < 0 || nx >= exp.cols || ny >= exp.rows) continue;
      const tile = exp.tiles[ny][nx];
      if (!tile || !walk[tile.kind]) continue;
      seen.add(k);
      q.push({ x: nx, y: ny });
    }
  }
  return false;
}

function threat(exp) {
  let t = 0;
  for (let y = 0; y < exp.rows; y++) {
    for (let x = 0; x < exp.cols; x++) {
      const e = exp.tiles[y][x].enemy;
      if (e) t += e.hp + e.atk * 2;
    }
  }
  return t;
}

function rewardSum(exp) {
  let n = 0;
  for (let y = 0; y < exp.rows; y++) {
    for (let x = 0; x < exp.cols; x++) {
      const tile = exp.tiles[y][x];
      if (tile.enemy) n += tile.enemy.gold;
      if (tile.feature && tile.feature.type === 'cache') n += tile.feature.gold;
    }
  }
  return n;
}

function assertMap(exp, name) {
  ok(exp.gate && exp.camp && exp.path.length >= 8, name + ' has a gate, a camp and a trail');
  ok(exp.tiles[exp.gate.y][exp.gate.x].kind === 'gate', name + ' gate tile is the gate');
  ok(exp.tiles[exp.camp.y][exp.camp.x].kind === 'camp', name + ' camp tile is the camp');
  let steps = true;
  const seen = new Set();
  for (let i = 0; i < exp.path.length; i++) {
    const p = exp.path[i];
    const k = p.x + ',' + p.y;
    if (seen.has(k)) steps = false;
    seen.add(k);
    if (i === 0) continue;
    const prev = exp.path[i - 1];
    const dist = Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y);
    if (dist !== 1) steps = false;
  }
  ok(steps, name + ' path is a simple 4-connected walk');
  ok(reachable(exp), name + ' camp is reachable through open ground');
  let enemies = 0;
  let validLoot = true;
  for (let y = 0; y < exp.rows; y++) {
    for (let x = 0; x < exp.cols; x++) {
      const tile = exp.tiles[y][x];
      const open = tile.kind === 'trail' || tile.kind === 'glade' || tile.kind === 'gate' || tile.kind === 'camp';
      if (tile.enemy) {
        enemies += 1;
        if (!open || tile.enemy.hp < 1 || tile.enemy.atk < 1 || tile.enemy.gold < tile.depth) validLoot = false;
      }
      if (tile.feature && tile.feature.type === 'cache') {
        if (!open || tile.feature.gold < tile.depth || tile.feature.food < 1) validLoot = false;
      }
      if (tile.feature && tile.feature.type === 'shrine' && !(tile.feature.heal > 0)) validLoot = false;
      if ((tile.kind === 'wood' || tile.kind === 'rock' || tile.kind === 'water') && (tile.enemy || tile.feature)) validLoot = false;
    }
  }
  ok(enemies >= 1 && validLoot, name + ' enemies and caches sit on open ground and pay with depth (' + enemies + ' beasts)');
  const cleared = Exp.cautiousClear(exp);
  ok(cleared.ok && cleared.hp > 0, name + ' cautious strikes reach the camp with health left (' + cleared.hp + ')');
}

const seeds = ['willow', 'hearth', 'a', '12345', 'fen-9', 'Millwater', '  spaced  ', 'daily-2026-10-17-DEADBEEF'];
const digests = new Set();
for (let i = 0; i < seeds.length; i++) {
  const a = Exp.generate(seeds[i], 1);
  const b = Exp.generate(seeds[i], 1);
  ok(digest(a) === digest(b), 'seed ' + JSON.stringify(seeds[i]) + ' is deterministic');
  digests.add(digest(a));
  assertMap(a, 'floor 1 ' + a.label);
  assertMap(Exp.generate(seeds[i], 2), 'floor 2 ' + a.seed);
  assertMap(Exp.generate(seeds[i], 3), 'floor 3 ' + a.seed);
}
ok(digests.size === seeds.length, 'eight seeds grow eight different trails');
ok(digest(Exp.generate('  spaced  ', 1)) === digest(Exp.generate('spaced', 1)), 'a padded seed matches its trimmed form');
ok(digest(Exp.generate('willow', 1)) !== digest(Exp.generate('willow', 2)), 'the next stretch of a seed is a new map');

let ramped = 0;
for (let i = 0; i < seeds.length; i++) {
  const low = Exp.generate(seeds[i], 1);
  const high = Exp.generate(seeds[i], 3);
  if (threat(high) > threat(low) && rewardSum(high) > rewardSum(low)) ramped += 1;
}
ok(ramped >= 6, 'deeper stretches hit harder and pay more (' + ramped + '/' + seeds.length + ')');

{
  const day = Exp.dailySeed('2026-10-17', 'ab12cd34');
  ok(day === Exp.dailySeed('2026-10-17', 'AB12CD34'), 'a daily seed ignores flag-label case');
  ok(day !== Exp.dailySeed('2026-10-18', 'AB12CD34'), 'the next day is a different trail');
  ok(digest(Exp.generate(day, 1)) === digest(Exp.generate(day, 1)), 'today’s trail is replayable');
  ok(Exp.seedLabel(day).length === 8, 'the visible seed is eight hex characters (' + Exp.seedLabel(day) + ')');
}

{
  const exp = Exp.generate('willow', 1);
  const first = Exp.createRun(exp);
  const second = Exp.createRun(exp);
  let target = null;
  for (let i = 1; i < exp.path.length; i++) {
    const tile = exp.tiles[exp.path[i].y][exp.path[i].x];
    if (tile.enemy) { target = i; break; }
  }
  function walk(run) {
    for (let i = 1; i <= target; i++) {
      const step = exp.path[i];
      const prev = exp.path[i - 1];
      Exp.move(run, step.x - prev.x, step.y - prev.y);
    }
  }
  walk(first);
  walk(second);
  const sneakA = Exp.sneak(first);
  const sneakB = Exp.sneak(second);
  ok(sneakA.passed === sneakB.passed && first.hp === second.hp && first.food === second.food && first.phase === second.phase,
    'the same sneak on the same seed resolves the same way');
}

{
  const exp = Exp.generate('briar-2', 1);
  const run = Exp.createRun(exp);
  const back = { x: run.x, y: run.y };
  let fought = false;
  for (let i = 1; i < exp.path.length; i++) {
    const step = exp.path[i];
    const prev = exp.path[i - 1];
    Exp.move(run, step.x - prev.x, step.y - prev.y);
    if (run.phase === 'encounter') {
      const spot = { x: run.x, y: run.y };
      ok(Exp.fallBack(run).ok && run.x === back.x && run.y === back.y && run.phase === 'explore', 'falling back leaves the beast holding the trail');
      Exp.move(run, spot.x - run.x, spot.y - run.y);
      while (run.phase === 'encounter') Exp.strike(run);
      fought = run.hp > 0;
      break;
    }
    back.x = step.x;
    back.y = step.y;
  }
  ok(fought, 'a strike clears the first beast');
}

{
  const exp = Exp.generate('campfire', 1);
  const run = Exp.createRun(exp);
  run.live = true;
  const cleared = Exp.cautiousClear(exp);
  ok(cleared.ok, 'campfire seed still clears after a live flag is unused by the solver');
  for (let i = 1; i < exp.path.length; i++) {
    const step = exp.path[i];
    const prev = exp.path[i - 1];
    Exp.move(run, step.x - prev.x, step.y - prev.y);
    while (run.phase === 'encounter') Exp.strike(run);
  }
  ok(run.phase === 'camp' && run.bestDepth >= 8, 'reaching camp records a deep trail (' + run.bestDepth + ')');
  const purse = run.gold;
  const pressed = Exp.pressOn(run);
  ok(pressed.ok && run.floor === 2 && run.gold === purse && run.phase === 'explore', 'pressing on keeps the purse and starts the next stretch');
  ok(Exp.cautiousClear(run.exp).ok, 'the second stretch is still solvable');
  ok(threat(run.exp) >= threat(exp) || rewardSum(run.exp) > rewardSum(exp), 'stretch 2 is at least as dangerous or richer');
}

{
  const box = mem();
  const api = Progress.create(Persist.create(box));
  api.emit('hearthvale', 'expedition', 3);
  ok(!api.profile().unlocked['hearth-wilds'], 'depth 3 is still inside the palisade');
  api.emit('hearthvale', 'expedition', 4);
  ok(!!api.profile().unlocked['hearth-wilds'] && api.profile().xp === 35, 'depth 4 mints Beyond the Palisade');
  api.emit('hearthvale', 'expedition', 4);
  ok(api.profile().xp === 35, 'the same depth does not pay twice');
  api.emit('hearthvale', 'expedition', 10);
  ok(!!api.profile().unlocked['hearth-far'] && api.profile().stats['hearthvale.expedition'] === 10,
    'depth 10 mints The Far Camp and keeps the high-water mark');
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
    await page.addInitScript(() => {
      localStorage.setItem('hearthvale-v1', JSON.stringify({ seenIntro: true, seed: 42424 }));
    });
    await page.goto(BASE + '/hearthvale.html?expedition=willow', { waitUntil: 'load', timeout: 30000 });
    await page.waitForSelector('#hvx-root[data-open="1"]', { timeout: 15000 });
    const opened = await page.evaluate(() => ({
      seed: document.getElementById('hvx-seed').textContent,
      raw: document.getElementById('hvx-seedraw').textContent,
      phase: document.getElementById('hvx-root').dataset.phase,
      colors: (function () {
        const c = document.getElementById('hvx-canvas');
        const ctx = c.getContext('2d');
        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        const keys = {};
        for (let i = 0; i < data.length; i += 16 * 4) {
          if (data[i + 3] < 16) continue;
          const key = (data[i] & 240) + ((data[i + 1] & 240) << 8) + ((data[i + 2] & 240) << 16);
          keys[key] = 1;
        }
        return Object.keys(keys).length;
      })(),
    }));
    const label = Exp.seedLabel('willow');
    ok(opened.raw === 'willow' && opened.seed === label && opened.phase === 'explore',
      'the overlay shows seed willow as ' + label);
    ok(opened.colors >= 4, 'the generated trail paints more than one colour (' + opened.colors + ')');

    const plan = Exp.generate('willow', 1);
    const start = await page.evaluate(() => ({
      x: Number(document.getElementById('hvx-root').dataset.x),
      y: Number(document.getElementById('hvx-root').dataset.y),
    }));
    ok(start.x === plan.gate.x && start.y === plan.gate.y, 'the scout starts on the generated gate');
    const next = plan.path[1];
    const key = next.x === start.x + 1 ? 'ArrowRight' : next.x === start.x - 1 ? 'ArrowLeft' : next.y === start.y + 1 ? 'ArrowDown' : 'ArrowUp';
    await page.keyboard.press(key);
    await page.waitForFunction((pos) => {
      const root = document.getElementById('hvx-root');
      return Number(root.dataset.x) === pos.x && Number(root.dataset.y) === pos.y;
    }, next);
    const stepped = await page.evaluate(() => document.getElementById('hvx-root').dataset.depth);
    ok(Number(stepped) >= 1, 'the first step counts as depth (' + stepped + ')');

    await page.locator('#hvx-daily').click();
    const daily = await page.evaluate(() => ({
      raw: document.getElementById('hvx-seedraw').textContent,
      label: document.getElementById('hvx-seed').textContent,
      log: document.getElementById('hvx-log').textContent,
    }));
    const spec = await page.evaluate(() => FlagDaily.challengeFor(FlagDaily.activeDate()));
    const flagLabel = (spec.seed >>> 0).toString(16).toUpperCase().padStart(8, '0');
    const expectSeed = Exp.dailySeed(spec.date, flagLabel);
    ok(daily.raw === expectSeed && daily.raw.indexOf(spec.date) >= 0 && daily.label === Exp.seedLabel(expectSeed),
      'Today’s trail uses the flagship daily date and seed (' + daily.raw + ')');
    ok(/flagship daily seed/i.test(daily.log), 'the log names the shared daily seed');

    await page.locator('#hvx-leave').click();
    await page.waitForFunction(() => document.getElementById('hvx-root').hidden);
    const back = await page.evaluate(() => ({
      gold: document.getElementById('r-gold').textContent,
      hidden: document.getElementById('hvx-root').hidden,
    }));
    ok(back.hidden && back.gold !== '', 'returning closes the trail and the valley is still there');
    await ctx.close();

    const phone = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    const pp = await phone.newPage();
    pp.on('pageerror', (e) => errs.push(String(e).slice(0, 240)));
    await pp.addInitScript(() => {
      localStorage.setItem('hearthvale-v1', JSON.stringify({ seenIntro: true, seed: 42424 }));
    });
    await pp.goto(BASE + '/hearthvale.html?expedition=fen-9', { waitUntil: 'load', timeout: 30000 });
    await pp.waitForSelector('#hvx-root[data-open="1"]', { timeout: 15000 });
    await pp.locator('#menu-btn').click({ timeout: 5000 }).catch(() => {});
    const fit = await pp.evaluate(() => {
      const ids = ['hvx-north', 'hvx-south', 'hvx-west', 'hvx-east', 'hvx-daily', 'hvx-leave', 'hvx-input'];
      return ids.map((id) => {
        const el = document.getElementById(id);
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        const b = el.getBoundingClientRect();
        const hit = document.elementFromPoint(b.left + b.width / 2, b.top + Math.min(b.height / 2, b.height - 2));
        return {
          id: id,
          h: Math.round(b.height),
          w: Math.round(b.width),
          on: b.top >= -1 && b.left >= -1 && b.bottom <= innerHeight + 1 && b.right <= innerWidth + 1,
          owns: !!(hit && (hit === el || el.contains(hit))),
        };
      });
    });
    const short = fit.filter((b) => b.h < 44 || b.w < 44 || !b.on || !b.owns);
    ok(short.length === 0, 'phone targets are 44px and own their centres'
      + (short.length ? ' — ' + short.map((b) => b.id + ' ' + b.w + 'x' + b.h).join(', ') : ''));
    await pp.locator('#hvx-east').tap();
    const moved = await pp.evaluate(() => document.getElementById('hvx-root').dataset.x);
    const fen = Exp.generate('fen-9', 1);
    ok(Number(moved) === fen.path[1].x, 'a phone tap steps onto the trail');
    await phone.close();

    const plain = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const quiet = await plain.newPage();
    quiet.on('pageerror', (e) => errs.push('plain ' + String(e).slice(0, 200)));
    await quiet.goto(BASE + '/hearthvale.html?daily=1&asof=2026-04-01', { waitUntil: 'load', timeout: 30000 });
    await quiet.waitForSelector('#flag-daily-layer', { timeout: 10000 });
    const layered = await quiet.evaluate(() => ({
      daily: !!document.getElementById('flag-daily-layer'),
      wilds: !!(document.getElementById('hvx-root') && !document.getElementById('hvx-root').hidden),
    }));
    ok(layered.daily && !layered.wilds, 'the flagship daily still owns ?daily=1');
    await plain.close();
  } catch (e) {
    ok(false, 'browser expedition: ' + String(e && e.message || e).split('\n')[0]);
  } finally {
    await browser.close();
  }
  ok(errs.length === 0, 'no page errors' + (errs.length ? ' — ' + errs[0] : ''));
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
