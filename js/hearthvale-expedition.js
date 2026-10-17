/* ============================================
   HEARTHVALE — Wilds Expedition.

   A solo trail beyond the palisade. One seed
   grows one map: a carved path from the gate
   to a camp, wolves and caches along it,
   harder and richer as the depth and the
   stretch climb. The same seed walks the
   same wilds again. Today's flagship daily
   seed is one of those trails.

   Solvable by construction. The path is cut
   before anything else is placed, and a
   repair pass walks it with the same strike
   the player uses, planting a shrine or
   easing a beast until that walk arrives
   with health left.
   ============================================ */

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HearthvaleExpedition = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SAVE_KEY = 'hearthvale-expedition-v1';
  const DEPTH_STRIDE = 24;
  const MAX_HP = 12;
  const BASE_ATK = 3;
  const BASE_FOOD = 4;

  const TRAIL_NAMES = [
    'Willow Reach', 'North Pasture', 'Millwater', 'Cinder Fold', 'The Low Orchard',
    'Fen Road', 'Briar Cut', 'Grey Maw Wood', 'Ash Ford', 'Lantern Path',
  ];
  const BEASTS = [
    ['wolf', 'Grey Maw'],
    ['boar', 'Old Tusk'],
    ['wolf', 'Fen Howl'],
    ['wisp', 'Lantern Thief'],
    ['wolf', 'Briar Pack'],
    ['boar', 'Cinder Boar'],
    ['wisp', 'Ash Wisp'],
    ['wolf', 'Night Collar'],
  ];
  const FRESH_WORDS = ['willow', 'fen', 'briar', 'cinder', 'mill', 'lantern', 'ash', 'orchard', 'hollow', 'ford'];

  function cleanSeed(seed) {
    const s = String(seed == null ? '' : seed).trim().slice(0, 40);
    const cleaned = s.replace(/[^a-zA-Z0-9 _.:-]/g, '');
    return cleaned || 'hearth';
  }

  function hashSeed(seed) {
    const s = cleanSeed(seed);
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function seedLabel(seed) {
    return hashSeed(seed).toString(16).toUpperCase().padStart(8, '0');
  }

  function mix(seed, salt) {
    return hashSeed(cleanSeed(seed) + '-' + salt);
  }

  function mulberry32(a) {
    let t = a >>> 0;
    return function () {
      t = t + 0x6D2B79F5 | 0;
      let r = Math.imul(t ^ t >>> 15, 1 | t);
      r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r;
      return ((r ^ r >>> 14) >>> 0) / 4294967296;
    };
  }

  function normFloor(floor) {
    const n = Math.floor(Number(floor));
    if (!Number.isFinite(n) || n < 1) return 1;
    if (n > 30) return 30;
    return n;
  }

  function dailySeed(date, flagLabel) {
    const d = String(date || '').trim();
    const day = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '1970-01-01';
    const flag = String(flagLabel || '').replace(/[^a-fA-F0-9]/g, '').toUpperCase().slice(0, 8);
    return cleanSeed('daily-' + day + (flag ? '-' + flag : ''));
  }

  function freshSeed() {
    const word = FRESH_WORDS[Math.floor(Math.random() * FRESH_WORDS.length)];
    const n = 1000 + Math.floor(Math.random() * 9000);
    return word + '-' + n;
  }

  function sneakChance(depth, floor) {
    const d = Math.max(0, depth || 0);
    const f = normFloor(floor);
    const c = 0.78 - d * 0.035 - (f - 1) * 0.07;
    return Math.max(0.12, Math.min(0.78, Math.round(c * 100) / 100));
  }

  function emptyTile() {
    return { kind: 'wood', depth: 0, feature: null, enemy: null };
  }

  function carvePath(rng, cols, rows) {
    const path = [];
    const seen = new Set();
    let x = 1;
    let y = 1 + Math.floor(rng() * (rows - 2));
    const x1 = cols - 2;
    function add(nx, ny) {
      x = nx;
      y = ny;
      seen.add(x + ',' + y);
      path.push({ x: x, y: y });
    }
    add(x, y);
    let column = 0;
    while (x < x1) {
      column += 1;
      if (column % 2 === 0 && rng() < 0.72) {
        const dirs = [];
        if (y > 1 && !seen.has(x + ',' + (y - 1))) dirs.push(-1);
        if (y < rows - 2 && !seen.has(x + ',' + (y + 1))) dirs.push(1);
        if (dirs.length) add(x, y + dirs[Math.floor(rng() * dirs.length)]);
      }
      add(x + 1, y);
    }
    return path;
  }

  function placeFeatures(tiles, path, rng, floor) {
    for (let i = 1; i < path.length - 1; i++) {
      const p = path[i];
      const tile = tiles[p.y][p.x];
      tile.depth = i;
      if (i % 4 === 3) {
        const beast = BEASTS[Math.floor(rng() * BEASTS.length)];
        const lastFight = i + 4 >= path.length - 1;
        let name = beast[1];
        if (floor >= 2 && lastFight) name = 'Warlord ' + name;
        const hp = 2 + Math.floor(i / 3) + (floor - 1) * 2;
        const atk = 1 + Math.floor(i / 5) + Math.floor((floor - 1) / 2);
        tile.enemy = {
          name: name,
          kind: beast[0],
          hp: hp,
          maxHp: hp,
          atk: atk,
          gold: (2 + i) * floor,
          pelts: i >= 3 ? 1 + (floor >= 3 && i >= 6 ? 1 : 0) : 0,
          depth: i,
        };
      } else if (i % 4 === 1) {
        tile.feature = {
          type: 'cache',
          gold: (1 + i) * floor,
          food: 1 + (i >= 6 ? 1 : 0) + (floor >= 3 ? 1 : 0),
        };
      } else if (i >= 4 && rng() < 0.7) {
        tile.feature = { type: 'shrine', heal: 4 + floor };
      }
    }
  }

  function placeGlades(tiles, path, rng, cols, rows, floor) {
    for (let i = 2; i < path.length - 1; i += 3) {
      const p = path[i];
      const prev = path[i - 1];
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      const perps = dx !== 0 ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]];
      const order = rng() < 0.5 ? perps : [perps[1], perps[0]];
      for (let n = 0; n < order.length; n++) {
        const nx = p.x + order[n][0];
        const ny = p.y + order[n][1];
        if (nx < 1 || ny < 1 || nx >= cols - 1 || ny >= rows - 1) continue;
        const tile = tiles[ny][nx];
        if (tile.kind !== 'wood') continue;
        tile.kind = 'glade';
        tile.depth = i;
        if (rng() < 0.45) tile.feature = { type: 'traveler' };
        else tile.feature = { type: 'cache', gold: (1 + i) * floor, food: 1 };
        break;
      }
    }
  }

  function dressWilds(tiles, rng, cols, rows) {
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        const tile = tiles[y][x];
        if (tile.kind !== 'wood') continue;
        const roll = rng();
        if (roll < 0.1) tile.kind = 'water';
        else if (roll < 0.18) tile.kind = 'rock';
      }
    }
  }

  function generate(seed, floor) {
    const cleaned = cleanSeed(seed);
    const f = normFloor(floor);
    const cols = 13 + Math.min(2, Math.floor((f - 1) / 3));
    const rows = 9 + Math.min(2, Math.floor((f - 1) / 4));
    const rng = mulberry32(mix(cleaned, 'map-f' + f));
    const tiles = [];
    for (let y = 0; y < rows; y++) {
      const row = [];
      for (let x = 0; x < cols; x++) row.push(emptyTile());
      tiles.push(row);
    }
    const path = carvePath(rng, cols, rows);
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      const tile = tiles[p.y][p.x];
      tile.kind = i === 0 ? 'gate' : (i === path.length - 1 ? 'camp' : 'trail');
      tile.depth = i;
    }
    placeFeatures(tiles, path, rng, f);
    placeGlades(tiles, path, rng, cols, rows, f);
    dressWilds(tiles, rng, cols, rows);
    const exp = {
      v: 1,
      seed: cleaned,
      label: seedLabel(cleaned),
      floor: f,
      title: TRAIL_NAMES[mix(cleaned, 'title') % TRAIL_NAMES.length],
      cols: cols,
      rows: rows,
      tiles: tiles,
      path: path,
      gate: { x: path[0].x, y: path[0].y },
      camp: { x: path[path.length - 1].x, y: path[path.length - 1].y },
    };
    ensureSolvable(exp);
    return exp;
  }

  function tileAt(exp, p) {
    return exp.tiles[p.y][p.x];
  }

  function keyOf(x, y) { return x + ',' + y; }

  function note(run, text) {
    run.log.push(text);
    if (run.log.length > 6) run.log.shift();
  }

  function popText(run, text, color) {
    if (!run.pops) return;
    run.pops.push({ x: run.x, y: run.y, text: text, color: color || '#f2c14e', life: 1.05 });
  }

  function scoreOf(run) {
    if (!run) return 0;
    return run.gold + run.pelts * 8 + run.bestDepth * 3 + run.food * 2 + (run.floor - 1) * 20;
  }

  function emitDepth(depth) {
    const n = Math.max(0, Math.floor(Number(depth) || 0));
    if (!n) return;
    try {
      if (typeof window !== 'undefined' && window.EurekaProgress) {
        window.EurekaProgress.emit('hearthvale', 'expedition', n);
      }
    } catch (e) { /* a trophy toast cannot end the trail */ }
  }

  function touchDepth(run) {
    const tile = run.exp.tiles[run.y][run.x];
    const here = (run.floor - 1) * DEPTH_STRIDE + (tile.depth || 0);
    if (here > run.bestDepth) {
      run.bestDepth = here;
      // Map repair walks a silent copy. Only a scout the player is
      // actually leading should mint career depth.
      if (run.live) emitDepth(run.bestDepth);
    }
  }

  function createRun(exp) {
    const run = {
      exp: exp,
      seed: exp.seed,
      label: exp.label,
      floor: exp.floor,
      x: exp.gate.x,
      y: exp.gate.y,
      hp: MAX_HP,
      maxHp: MAX_HP,
      food: BASE_FOOD,
      atk: BASE_ATK,
      gold: 0,
      pelts: 0,
      bestDepth: 0,
      phase: 'explore',
      encounter: null,
      cleared: {},
      seen: {},
      cameFrom: null,
      log: [],
      pops: [],
      flash: 0,
      reported: false,
      remembered: false,
      rng: mulberry32(mix(exp.seed, 'play')),
    };
    run.seen[keyOf(run.x, run.y)] = true;
    note(run, exp.title + ' opens past the palisade. Seed ' + exp.label + '.');
    touchDepth(run);
    return run;
  }

  function blocked(tile) {
    return !tile || tile.kind === 'wood' || tile.kind === 'rock' || tile.kind === 'water';
  }

  function move(run, dx, dy) {
    if (!run || run.phase !== 'explore') return { ok: false, reason: 'busy' };
    if ((dx !== 0 && dy !== 0) || (dx === 0 && dy === 0)) return { ok: false, reason: 'bad' };
    const nx = run.x + dx;
    const ny = run.y + dy;
    const exp = run.exp;
    if (nx < 0 || ny < 0 || nx >= exp.cols || ny >= exp.rows) return { ok: false, reason: 'edge' };
    const tile = exp.tiles[ny][nx];
    if (blocked(tile)) return { ok: false, reason: 'blocked' };
    run.cameFrom = { x: run.x, y: run.y };
    run.x = nx;
    run.y = ny;
    run.seen[keyOf(nx, ny)] = true;
    touchDepth(run);
    const id = keyOf(nx, ny);
    if (tile.enemy && !run.cleared[id]) {
      const e = tile.enemy;
      run.encounter = {
        x: nx, y: ny, name: e.name, kind: e.kind,
        hp: e.hp, maxHp: e.maxHp, atk: e.atk, gold: e.gold, pelts: e.pelts, depth: e.depth,
      };
      run.phase = 'encounter';
      note(run, e.name + ' blocks the trail. Depth ' + e.depth + '.');
      return { ok: true, phase: 'encounter' };
    }
    if (tile.feature && !run.cleared[id]) {
      if (tile.feature.type === 'cache') {
        run.gold += tile.feature.gold;
        run.food += tile.feature.food;
        run.cleared[id] = 'cache';
        note(run, 'A cache in the roots: +' + tile.feature.gold + ' coin, +' + tile.feature.food + ' food.');
        popText(run, '+' + tile.feature.gold, '#f2c14e');
      } else if (tile.feature.type === 'shrine') {
        const before = run.hp;
        run.hp = Math.min(run.maxHp, run.hp + tile.feature.heal);
        run.cleared[id] = 'shrine';
        const gained = run.hp - before;
        note(run, gained > 0
          ? 'The shrine steadies you. +' + gained + ' health.'
          : 'The shrine is quiet. You are already steady.');
        if (gained > 0) popText(run, '+' + gained, '#9ad07a');
      } else if (tile.feature.type === 'traveler') {
        run.phase = 'traveler';
        note(run, 'A traveler waits by a cold fire. A meal buys a sharper spear.');
        return { ok: true, phase: 'traveler' };
      }
    }
    if (tile.kind === 'camp') {
      run.phase = 'camp';
      note(run, 'A camp fire at depth ' + tile.depth + '. The trail goes on, or the valley is behind you.');
      return { ok: true, phase: 'camp' };
    }
    return { ok: true, phase: 'explore' };
  }

  function strike(run) {
    if (!run || run.phase !== 'encounter' || !run.encounter) return { ok: false };
    const e = run.encounter;
    const dealt = run.atk;
    e.hp -= dealt;
    let taken = 0;
    if (e.hp > 0) {
      taken = e.atk;
      run.hp -= taken;
      note(run, 'You cut ' + e.name + ' for ' + dealt + '. It answers for ' + taken + '.');
      popText(run, '-' + taken, '#e07070');
      run.flash = 1;
    } else {
      run.gold += e.gold;
      run.pelts += e.pelts;
      run.cleared[keyOf(e.x, e.y)] = 'enemy';
      const peltBit = e.pelts ? ', +' + e.pelts + ' pelt' : '';
      note(run, e.name + ' falls. +' + e.gold + ' coin' + peltBit + '.');
      popText(run, '+' + e.gold, '#f2c14e');
      run.phase = 'explore';
      run.encounter = null;
    }
    if (run.hp <= 0) {
      run.hp = 0;
      run.phase = 'dead';
      run.encounter = null;
      note(run, 'The wilds take the scout at depth ' + run.bestDepth + '.');
    }
    return { ok: true, dealt: dealt, taken: taken, phase: run.phase };
  }

  function sneak(run) {
    if (!run || run.phase !== 'encounter' || !run.encounter) return { ok: false };
    if (run.food < 1) {
      note(run, 'Sneaking costs a meal, and the bag is empty.');
      return { ok: false, reason: 'food' };
    }
    const e = run.encounter;
    run.food -= 1;
    const chance = sneakChance(e.depth, run.floor);
    const roll = run.rng();
    if (roll < chance) {
      run.cleared[keyOf(e.x, e.y)] = 'sneak';
      run.phase = 'explore';
      run.encounter = null;
      note(run, 'You slip past ' + e.name + '.');
      return { ok: true, passed: true, phase: 'explore' };
    }
    run.hp -= e.atk;
    run.flash = 1;
    note(run, e.name + ' hears you and bites for ' + e.atk + '.');
    popText(run, '-' + e.atk, '#e07070');
    if (run.hp <= 0) {
      run.hp = 0;
      run.phase = 'dead';
      run.encounter = null;
      note(run, 'The wilds take the scout at depth ' + run.bestDepth + '.');
    }
    return { ok: true, passed: false, phase: run.phase };
  }

  function fallBack(run) {
    if (!run || run.phase !== 'encounter' || !run.cameFrom) return { ok: false };
    run.x = run.cameFrom.x;
    run.y = run.cameFrom.y;
    run.cameFrom = null;
    run.phase = 'explore';
    run.encounter = null;
    note(run, 'You give ground. The beast holds the trail.');
    return { ok: true };
  }

  function shareMeal(run) {
    if (!run || run.phase !== 'traveler') return { ok: false };
    if (run.food < 1) {
      note(run, 'Nothing to share.');
      return { ok: false, reason: 'food' };
    }
    run.food -= 1;
    run.atk += 1;
    run.cleared[keyOf(run.x, run.y)] = 'traveler';
    run.phase = 'explore';
    note(run, 'The traveler takes the meal. Your spear bites for ' + run.atk + '.');
    return { ok: true, atk: run.atk };
  }

  function passTraveler(run) {
    if (!run || run.phase !== 'traveler') return { ok: false };
    run.cleared[keyOf(run.x, run.y)] = 'traveler';
    run.phase = 'explore';
    note(run, 'You leave the traveler to the fire.');
    return { ok: true };
  }

  function pressOn(run) {
    if (!run || run.phase !== 'camp') return { ok: false };
    const nextFloor = Math.min(99, (run.floor || 1) + 1);
    const kept = {
      hp: Math.min(run.maxHp, run.hp + 4),
      food: run.food,
      atk: run.atk,
      gold: run.gold,
      pelts: run.pelts,
      bestDepth: run.bestDepth,
      log: run.log,
      pops: run.pops,
      rng: run.rng,
      remembered: run.remembered,
      reported: run.reported,
      live: run.live,
    };
    const exp = generate(run.seed, nextFloor);
    run.exp = exp;
    run.floor = nextFloor;
    run.x = exp.gate.x;
    run.y = exp.gate.y;
    run.hp = kept.hp;
    run.food = kept.food;
    run.atk = kept.atk;
    run.gold = kept.gold;
    run.pelts = kept.pelts;
    run.bestDepth = kept.bestDepth;
    run.log = kept.log;
    run.pops = kept.pops;
    run.rng = kept.rng;
    run.remembered = kept.remembered;
    run.reported = kept.reported;
    run.live = kept.live;
    run.phase = 'explore';
    run.encounter = null;
    run.cleared = {};
    run.seen = {};
    run.cameFrom = null;
    run.seen[keyOf(run.x, run.y)] = true;
    run.flash = 0;
    touchDepth(run);
    note(run, 'Stretch ' + nextFloor + '. The wilds bite harder, and they pay better.');
    return { ok: true, floor: nextFloor };
  }

  function cautiousClear(exp) {
    const run = createRun(exp);
    for (let i = 1; i < exp.path.length; i++) {
      const step = exp.path[i];
      const prev = exp.path[i - 1];
      const moved = move(run, step.x - prev.x, step.y - prev.y);
      if (!moved.ok) return { ok: false, reason: moved.reason || 'blocked', index: i, hp: run.hp };
      let guard = 0;
      while (run.phase === 'encounter' && run.hp > 0 && guard++ < 12) strike(run);
      if (run.hp <= 0 || run.phase === 'dead') return { ok: false, reason: 'dead', index: i, hp: 0 };
    }
    const camp = exp.camp;
    return {
      ok: run.x === camp.x && run.y === camp.y && run.hp > 0,
      hp: run.hp,
      phase: run.phase,
      gold: run.gold,
    };
  }

  function ensureSolvable(exp) {
    for (let n = 0; n < 48; n++) {
      const sim = cautiousClear(exp);
      if (sim.ok) return exp;
      const i = sim.index || 1;
      const prev = exp.path[Math.max(0, i - 1)];
      const prevTile = tileAt(exp, prev);
      if (!prevTile.enemy && prevTile.feature == null) {
        prevTile.feature = { type: 'shrine', heal: 6 + exp.floor };
        continue;
      }
      if (!prevTile.enemy && prevTile.feature && prevTile.feature.type !== 'shrine') {
        prevTile.feature = { type: 'shrine', heal: 6 + exp.floor };
        continue;
      }
      const tile = tileAt(exp, exp.path[i]);
      if (tile.enemy && tile.enemy.hp > 1) {
        tile.enemy.hp -= 1;
        tile.enemy.maxHp = tile.enemy.hp;
        continue;
      }
      if (tile.enemy && tile.enemy.atk > 1) {
        tile.enemy.atk -= 1;
        continue;
      }
      if (tile.enemy) tile.enemy = null;
    }
    return exp;
  }

  function storage() {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) return null;
      return localStorage;
    } catch (e) { return null; }
  }

  function loadBest() {
    const box = storage();
    if (!box) return null;
    try {
      const raw = box.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
      return {
        v: 1,
        bestDepth: Math.max(0, Math.floor(Number(data.bestDepth) || 0)),
        bestScore: Math.max(0, Math.floor(Number(data.bestScore) || 0)),
        bestSeed: typeof data.bestSeed === 'string' ? data.bestSeed.slice(0, 40) : '',
        runs: Math.max(0, Math.floor(Number(data.runs) || 0)),
      };
    } catch (e) { return null; }
  }

  function saveRecord(detail) {
    const box = storage();
    if (!box) return null;
    const prev = loadBest() || { v: 1, bestDepth: 0, bestScore: 0, bestSeed: '', runs: 0 };
    const score = Math.max(0, Math.floor(Number(detail.score) || 0));
    const depth = Math.max(0, Math.floor(Number(detail.depth) || 0));
    const next = {
      v: 1,
      bestDepth: Math.max(prev.bestDepth, depth),
      bestScore: Math.max(prev.bestScore, score),
      bestSeed: score >= prev.bestScore ? (detail.seed || prev.bestSeed || '') : (prev.bestSeed || ''),
      runs: prev.runs + 1,
    };
    try { box.setItem(SAVE_KEY, JSON.stringify(next)); } catch (e) { /* private mode */ }
    return next;
  }

  function reducedMotion() {
    try {
      if (typeof window !== 'undefined' && window.EurekaFeel && window.EurekaFeel.reduced && window.EurekaFeel.reduced()) return true;
    } catch (e) { /* motion is cosmetic */ }
    try {
      return !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e2) { return false; }
  }

  function juice(kind, text, color, x, y) {
    try {
      if (typeof window === 'undefined' || !window.EurekaFeel || !view.canvas) return;
      const rect = view.canvas.getBoundingClientRect();
      const pt = tilePixel(x, y);
      window.EurekaFeel.punch(kind, {
        x: rect.left + pt.x,
        y: rect.top + pt.y,
        text: text,
        color: color,
        target: view.canvas,
        n: kind === 'trap' ? 10 : 8,
      });
    } catch (e) { /* juice never takes the trail down */ }
  }

  const CSS = [
    '#hvx-root{position:fixed;inset:0;z-index:900;display:flex;flex-direction:column;background:#10160f;color:#eef3ea;',
    'font-family:Segoe UI,system-ui,sans-serif;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}',
    '#hvx-root[hidden]{display:none}',
    '#hvx-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;padding:10px 12px 4px}',
    '#hvx-kicker{font-size:10px;letter-spacing:1.6px;color:#f2c14e;font-weight:800}',
    '#hvx-title{font-size:20px;line-height:1.1;margin:2px 0 0}',
    '#hvx-seed{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:22px;font-weight:800;letter-spacing:1px;color:#f2c14e}',
    '#hvx-seedraw{font-size:12px;color:#a9b6a6;text-align:right}',
    '#hvx-stats{display:flex;flex-wrap:wrap;gap:6px;padding:4px 12px 6px}',
    '#hvx-stats span,#hvx-best{background:#2a2218;border:1px solid #6b4e30;border-radius:999px;padding:4px 8px;font-size:12px;font-weight:700}',
    '#hvx-best{margin:0 12px 6px;display:inline-block;color:#a9b6a6}',
    '#hvx-meter{height:6px;margin:0 12px 6px;background:#1b241c;border-radius:4px;overflow:hidden}',
    '#hvx-meter-fill{display:block;height:100%;width:0;background:linear-gradient(90deg,#3f7a3c,#f2c14e);}',
    '#hvx-canvas-wrap{flex:1 1 auto;min-height:160px;position:relative}',
    '#hvx-canvas{width:100%;height:100%;display:block;touch-action:none;cursor:pointer}',
    '#hvx-foot{flex:0 0 auto;max-height:48vh;overflow-y:auto;padding:8px 12px 12px;display:flex;flex-direction:column;gap:8px;background:linear-gradient(180deg,rgba(16,22,15,0),#10160f 18px)}',
    '#hvx-log{min-height:2.4em;font-size:13.5px;line-height:1.35;color:#d5e0d2}',
    '#hvx-explore{display:flex;gap:12px;align-items:center;flex-wrap:wrap}',
    '#hvx-hint{font-size:12px;color:#a9b6a6;max-width:280px}',
    '.hvx-pad{display:grid;grid-template-columns:48px 48px 48px;grid-template-rows:44px 44px 44px;gap:4px}',
    '#hvx-north{grid-column:2;grid-row:1}#hvx-west{grid-column:1;grid-row:2}#hvx-east{grid-column:3;grid-row:2}#hvx-south{grid-column:2;grid-row:3}',
    '.hvx-btn{min-height:44px;min-width:44px;padding:8px 12px;border-radius:10px;border:1px solid #6b4e30;border-top-color:#85643f;',
    'background:linear-gradient(180deg,#5a4531,#3a2b1c);color:#eef3ea;font-weight:800;font-size:15px;font-family:inherit;cursor:pointer;touch-action:manipulation}',
    '.hvx-btn:disabled{opacity:.4;cursor:default}',
    '.hvx-btn.primary{background:linear-gradient(180deg,#f2c14e,#c8962e);color:#2b2410;border-color:#f2c14e}',
    '#hvx-encounter,#hvx-camp,#hvx-dead,#hvx-traveler{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
    '#hvx-encounter[hidden],#hvx-camp[hidden],#hvx-dead[hidden],#hvx-traveler[hidden],#hvx-explore[hidden]{display:none}',
    '#hvx-enemy,#hvx-camp-copy,#hvx-dead-copy,#hvx-traveler-copy{flex:1 1 180px;font-size:14px;font-weight:700}',
    '#hvx-seedform{display:flex;flex-wrap:wrap;gap:6px}',
    '#hvx-input{flex:1 1 140px;min-height:44px;font-size:16px;border-radius:10px;border:1px solid #6b4e30;background:#1b241c;color:#eef3ea;padding:8px 10px;font-family:inherit}',
    '@media (max-width:720px){#hvx-title{font-size:17px}#hvx-seed{font-size:18px}}',
  ].join('');

  const view = {
    root: null,
    canvas: null,
    ctx: null,
    raf: 0,
    anim: 0,
    last: 0,
    ox: 0,
    oy: 0,
    tile: 24,
    px: 0,
    py: 0,
    hook: null,
    onKey: null,
    onUnload: null,
  };
  let run = null;

  function tilePixel(x, y) {
    return { x: view.ox + (x + 0.5) * view.tile, y: view.oy + (y + 0.5) * view.tile };
  }

  function ensureCss() {
    if (document.getElementById('hvx-css')) return;
    const st = document.createElement('style');
    st.id = 'hvx-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function el(tag, id, text) {
    const node = document.createElement(tag);
    if (id) node.id = id;
    if (text != null) node.textContent = text;
    return node;
  }

  function button(id, text, className) {
    const node = el('button', id, text);
    node.type = 'button';
    node.className = 'hvx-btn' + (className ? ' ' + className : '');
    return node;
  }

  function mount() {
    const rootEl = el('div', 'hvx-root');
    rootEl.setAttribute('role', 'dialog');
    rootEl.setAttribute('aria-modal', 'true');
    rootEl.setAttribute('aria-label', 'Wilds Expedition');
    const head = el('div', 'hvx-head');
    const titles = el('div', '');
    titles.appendChild(el('div', 'hvx-kicker', 'WILDS EXPEDITION'));
    titles.appendChild(el('h1', 'hvx-title', 'The wilds'));
    const seedbox = el('div', '');
    seedbox.appendChild(el('div', 'hvx-kicker', 'SEED'));
    seedbox.appendChild(el('div', 'hvx-seed', '--------'));
    seedbox.appendChild(el('div', 'hvx-seedraw', ''));
    head.appendChild(titles);
    head.appendChild(seedbox);
    const stats = el('div', 'hvx-stats');
    ['hvx-floor', 'hvx-depth', 'hvx-hp', 'hvx-food', 'hvx-gold', 'hvx-pelts', 'hvx-score'].forEach(function (id) {
      stats.appendChild(el('span', id, ''));
    });
    const meter = el('div', 'hvx-meter');
    meter.appendChild(el('span', 'hvx-meter-fill'));
    const wrap = el('div', 'hvx-canvas-wrap');
    const canvas = el('canvas', 'hvx-canvas');
    canvas.setAttribute('aria-label', 'Expedition map');
    wrap.appendChild(canvas);
    const foot = el('div', 'hvx-foot');
    const log = el('div', 'hvx-log');
    log.setAttribute('aria-live', 'polite');
    const explore = el('div', 'hvx-explore');
    const pad = el('div', 'hvx-pad');
    pad.appendChild(button('hvx-north', '↑'));
    pad.appendChild(button('hvx-west', '←'));
    pad.appendChild(button('hvx-east', '→'));
    pad.appendChild(button('hvx-south', '↓'));
    pad.querySelector('#hvx-north').setAttribute('aria-label', 'North');
    pad.querySelector('#hvx-south').setAttribute('aria-label', 'South');
    pad.querySelector('#hvx-west').setAttribute('aria-label', 'West');
    pad.querySelector('#hvx-east').setAttribute('aria-label', 'East');
    explore.appendChild(pad);
    explore.appendChild(el('div', 'hvx-hint', 'Arrows, WASD, or tap the next step. Strike what blocks you. Depth pays.'));
    const encounter = el('div', 'hvx-encounter');
    encounter.hidden = true;
    encounter.appendChild(el('div', 'hvx-enemy', ''));
    encounter.appendChild(button('hvx-strike', 'Strike', 'primary'));
    encounter.appendChild(button('hvx-sneak', 'Sneak'));
    encounter.appendChild(button('hvx-fall', 'Fall back'));
    const camp = el('div', 'hvx-camp');
    camp.hidden = true;
    camp.appendChild(el('p', 'hvx-camp-copy', ''));
    camp.appendChild(button('hvx-deeper', 'Press deeper', 'primary'));
    camp.appendChild(button('hvx-bank', 'Carry it home'));
    const dead = el('div', 'hvx-dead');
    dead.hidden = true;
    dead.appendChild(el('p', 'hvx-dead-copy', ''));
    dead.appendChild(button('hvx-retry', 'Walk this seed again', 'primary'));
    dead.appendChild(button('hvx-dead-new', 'A new trail'));
    dead.appendChild(button('hvx-dead-home', 'Return with what remains'));
    const traveler = el('div', 'hvx-traveler');
    traveler.hidden = true;
    traveler.appendChild(el('p', 'hvx-traveler-copy', ''));
    traveler.appendChild(button('hvx-share', 'Share a meal', 'primary'));
    traveler.appendChild(button('hvx-pass', 'Walk on'));
    const form = el('form', 'hvx-seedform');
    const input = el('input', 'hvx-input');
    input.maxLength = 40;
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'Expedition seed');
    input.placeholder = 'seed';
    form.appendChild(input);
    const walk = button('hvx-walk', 'Walk', 'primary');
    walk.type = 'submit';
    form.appendChild(walk);
    form.appendChild(button('hvx-daily', "Today's trail"));
    form.appendChild(button('hvx-new', 'New trail'));
    form.appendChild(button('hvx-leave', 'Return'));
    foot.appendChild(log);
    foot.appendChild(explore);
    foot.appendChild(encounter);
    foot.appendChild(camp);
    foot.appendChild(dead);
    foot.appendChild(traveler);
    foot.appendChild(form);
    rootEl.appendChild(head);
    rootEl.appendChild(stats);
    rootEl.appendChild(el('div', 'hvx-best', ''));
    rootEl.appendChild(meter);
    rootEl.appendChild(wrap);
    rootEl.appendChild(foot);
    document.body.appendChild(rootEl);
    view.root = rootEl;
    view.canvas = canvas;
    bind(rootEl, canvas, form);
  }

  function bind(rootEl, canvas, form) {
    rootEl.querySelector('#hvx-north').addEventListener('click', function () { act(function () { return move(run, 0, -1); }); });
    rootEl.querySelector('#hvx-south').addEventListener('click', function () { act(function () { return move(run, 0, 1); }); });
    rootEl.querySelector('#hvx-west').addEventListener('click', function () { act(function () { return move(run, -1, 0); }); });
    rootEl.querySelector('#hvx-east').addEventListener('click', function () { act(function () { return move(run, 1, 0); }); });
    rootEl.querySelector('#hvx-strike').addEventListener('click', function () { act(function () { return strike(run); }); });
    rootEl.querySelector('#hvx-sneak').addEventListener('click', function () { act(function () { return sneak(run); }); });
    rootEl.querySelector('#hvx-fall').addEventListener('click', function () { act(function () { return fallBack(run); }); });
    rootEl.querySelector('#hvx-deeper').addEventListener('click', function () { act(function () { return pressOn(run); }); });
    rootEl.querySelector('#hvx-bank').addEventListener('click', function () { finish(true); });
    rootEl.querySelector('#hvx-leave').addEventListener('click', function () { finish(run && run.phase !== 'dead'); });
    rootEl.querySelector('#hvx-retry').addEventListener('click', function () { if (run) begin(run.seed); });
    rootEl.querySelector('#hvx-dead-new').addEventListener('click', function () { begin(freshSeed()); });
    rootEl.querySelector('#hvx-dead-home').addEventListener('click', function () { finish(false); });
    rootEl.querySelector('#hvx-share').addEventListener('click', function () { act(function () { return shareMeal(run); }); });
    rootEl.querySelector('#hvx-pass').addEventListener('click', function () { act(function () { return passTraveler(run); }); });
    rootEl.querySelector('#hvx-new').addEventListener('click', function () { begin(freshSeed()); });
    rootEl.querySelector('#hvx-daily').addEventListener('click', function () {
      const picked = todaysSeed();
      begin(picked.seed);
      if (run) note(run, picked.note);
      paint();
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      begin(rootEl.querySelector('#hvx-input').value);
    });
    canvas.addEventListener('pointerdown', function (e) {
      if (!run || run.phase !== 'explore') return;
      const rect = canvas.getBoundingClientRect();
      const col = Math.floor((e.clientX - rect.left - view.ox) / view.tile);
      const row = Math.floor((e.clientY - rect.top - view.oy) / view.tile);
      if (col === run.x && row === run.y) return;
      const dx = Math.sign(col - run.x);
      const dy = Math.sign(row - run.y);
      if (Math.abs(col - run.x) >= Math.abs(row - run.y)) act(function () { return move(run, dx, 0); });
      else act(function () { return move(run, 0, dy); });
    });
    view.onKey = function (e) {
      if (!view.root || view.root.hidden) return;
      if (e.target && e.target.id === 'hvx-input') {
        e.stopPropagation();
        if (e.key === 'Escape') { e.preventDefault(); e.target.blur(); }
        return;
      }
      e.stopPropagation();
      const k = e.key;
      const map = {
        ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        w: [0, -1], a: [-1, 0], s: [0, 1], d: [1, 0],
        W: [0, -1], A: [-1, 0], S: [0, 1], D: [1, 0],
      };
      if (map[k] && run && run.phase === 'explore') {
        e.preventDefault();
        act(function () { return move(run, map[k][0], map[k][1]); });
        return;
      }
      if ((k === 'j' || k === 'J') && run && run.phase === 'encounter') { e.preventDefault(); act(function () { return strike(run); }); }
      if ((k === 'k' || k === 'K') && run && run.phase === 'encounter') { e.preventDefault(); act(function () { return sneak(run); }); }
      if ((k === 'l' || k === 'L') && run && run.phase === 'encounter') { e.preventDefault(); act(function () { return fallBack(run); }); }
      if (k === ' ' || k === 'Escape') e.preventDefault();
      if (k === 'Escape') {
        if (run && run.phase === 'encounter') fallBack(run);
        else if (run && run.phase === 'traveler') passTraveler(run);
        else finish(run && run.phase !== 'dead');
        paint();
      }
    };
    window.addEventListener('keydown', view.onKey, true);
    view.onUnload = function () { if (run && view.root && !view.root.hidden) remember(run); };
    window.addEventListener('beforeunload', view.onUnload);
  }

  function act(fn) {
    if (!run) return;
    const before = run.phase;
    const result = fn();
    if (result && result.phase === 'dead') remember(run);
    if (before === 'encounter' && run.phase === 'explore' && result && result.dealt) {
      juice('hit', '+' + result.dealt, '#f2c14e', run.x, run.y);
    }
    if (result && result.taken) juice('trap', '-' + result.taken, '#e07070', run.x, run.y);
    paint();
  }

  function todaysSeed() {
    let date = '';
    let label = '';
    try {
      if (typeof window !== 'undefined' && window.FlagDaily) {
        date = window.FlagDaily.activeDate ? window.FlagDaily.activeDate() : window.FlagDaily.todayKey(new Date());
        const spec = window.FlagDaily.challengeFor(date);
        label = window.FlagDaily.seedLabel(spec.seed);
      }
    } catch (e) { /* the calendar is a convenience */ }
    if (!date) {
      const d = new Date();
      const pad = function (n) { return String(n).padStart(2, '0'); };
      date = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }
    return {
      seed: dailySeed(date, label),
      note: label ? "Today's trail uses flagship daily seed " + label + '.' : "Today's trail is locked to " + date + '.',
    };
  }

  function begin(seed) {
    if (run && run.live && !run.remembered) remember(run);
    const cleaned = seed ? cleanSeed(seed) : freshSeed();
    const exp = generate(cleaned, 1);
    run = createRun(exp);
    run.live = true;
    const input = document.getElementById('hvx-input');
    if (input) input.value = exp.seed;
    view.px = exp.gate.x;
    view.py = exp.gate.y;
    paint();
  }

  function remember(runState) {
    if (!runState || runState.remembered) return;
    runState.remembered = true;
    saveRecord({ score: scoreOf(runState), depth: runState.bestDepth, seed: runState.seed });
  }

  function finish(survived) {
    if (!run) { close(true); return; }
    remember(run);
    if (!run.reported) {
      run.reported = true;
      emitDepth(run.bestDepth);
      const payload = {
        gold: survived ? run.gold : Math.floor(run.gold / 2),
        food: survived ? run.food : 0,
        pelts: run.pelts,
        depth: run.bestDepth,
        floor: run.floor,
        seed: run.seed,
        label: run.label,
        survived: !!survived,
        score: scoreOf(run),
      };
      try {
        window.dispatchEvent(new CustomEvent('hv-expedition-return', { detail: payload }));
      } catch (e) { /* the valley can miss a purse; the trail still ends */ }
    }
    close(true);
  }

  function layout() {
    const canvas = view.canvas;
    if (!canvas || !run) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    view.ctx = ctx;
    const tile = Math.max(16, Math.floor(Math.min(w / run.exp.cols, h / run.exp.rows)));
    view.tile = tile;
    view.ox = Math.floor((w - tile * run.exp.cols) / 2);
    view.oy = Math.floor((h - tile * run.exp.rows) / 2);
  }

  function reveal() {
    if (!run) return;
    const r = 4;
    for (let y = run.y - r; y <= run.y + r; y++) {
      for (let x = run.x - r; x <= run.x + r; x++) {
        if (x < 0 || y < 0 || x >= run.exp.cols || y >= run.exp.rows) continue;
        if (Math.max(Math.abs(x - run.x), Math.abs(y - run.y)) <= r) run.seen[keyOf(x, y)] = true;
      }
    }
  }

  function draw() {
    layout();
    const ctx = view.ctx;
    if (!ctx || !run) return;
    const exp = run.exp;
    const w = view.canvas.clientWidth;
    const h = view.canvas.clientHeight;
    ctx.fillStyle = '#0e140f';
    ctx.fillRect(0, 0, w, h);
    reveal();
    const speed = reducedMotion() ? 1 : 0.22;
    view.px += (run.x - view.px) * (reducedMotion() ? 1 : speed);
    view.py += (run.y - view.py) * (reducedMotion() ? 1 : speed);
    if (Math.abs(view.px - run.x) < 0.02) view.px = run.x;
    if (Math.abs(view.py - run.y) < 0.02) view.py = run.y;
    for (let y = 0; y < exp.rows; y++) {
      for (let x = 0; x < exp.cols; x++) {
        drawCell(ctx, exp.tiles[y][x], x, y, !!run.seen[keyOf(x, y)]);
      }
    }
    drawActor(ctx);
    if (run.pops) {
      for (let i = 0; i < run.pops.length; i++) {
        const p = run.pops[i];
        const pt = tilePixel(p.x, p.y);
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.font = 'bold 14px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p.text, pt.x, pt.y - (1 - p.life) * 26 - 8);
        ctx.globalAlpha = 1;
      }
    }
    if (run.flash > 0) {
      ctx.fillStyle = 'rgba(180, 40, 30, ' + (run.flash * 0.28) + ')';
      ctx.fillRect(0, 0, w, h);
      run.flash = Math.max(0, run.flash - 0.08);
    }
  }

  function drawCell(ctx, tile, x, y, seen) {
    const s = view.tile;
    const px = view.ox + x * s;
    const py = view.oy + y * s;
    if (!seen) {
      ctx.fillStyle = '#121910';
      ctx.fillRect(px, py, s, s);
      ctx.fillStyle = '#1a281c';
      ctx.beginPath();
      ctx.moveTo(px + s * 0.5, py + s * 0.22);
      ctx.lineTo(px + s * 0.78, py + s * 0.78);
      ctx.lineTo(px + s * 0.22, py + s * 0.78);
      ctx.fill();
      return;
    }
    const near = Math.max(Math.abs(x - run.x), Math.abs(y - run.y)) <= 4;
    ctx.globalAlpha = near ? 1 : 0.72;
    if (tile.kind === 'water') {
      ctx.fillStyle = '#1a6280';
      ctx.fillRect(px, py, s, s);
      ctx.fillStyle = 'rgba(143, 212, 232, 0.45)';
      const wobble = reducedMotion() ? 0 : Math.sin(view.anim * 2 + x) * 2;
      ctx.fillRect(px + 3, py + s * 0.45 + wobble, s - 6, 2);
    } else if (tile.kind === 'rock') {
      ctx.fillStyle = '#2a3328';
      ctx.fillRect(px, py, s, s);
      ctx.fillStyle = '#6e6a64';
      ctx.beginPath();
      ctx.ellipse(px + s * 0.5, py + s * 0.55, s * 0.28, s * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8d887f';
      ctx.fillRect(px + s * 0.38, py + s * 0.32, s * 0.22, s * 0.16);
    } else if (tile.kind === 'wood') {
      ctx.fillStyle = '#16301f';
      ctx.fillRect(px, py, s, s);
      ctx.fillStyle = '#4a3422';
      ctx.fillRect(px + s * 0.46, py + s * 0.48, s * 0.08, s * 0.28);
      ctx.fillStyle = '#1d4a28';
      ctx.beginPath();
      ctx.arc(px + s * 0.5, py + s * 0.42, s * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2f6a3a';
      ctx.beginPath();
      ctx.arc(px + s * 0.38, py + s * 0.36, s * 0.16, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = tile.kind === 'glade' ? '#3f7a3c' : '#2f6a34';
      ctx.fillRect(px, py, s, s);
      if (tile.kind === 'trail' || tile.kind === 'gate' || tile.kind === 'camp') {
        ctx.fillStyle = '#c6a56e';
        ctx.fillRect(px + s * 0.18, py + s * 0.18, s * 0.64, s * 0.64);
        ctx.fillStyle = '#8a6840';
        ctx.fillRect(px + s * 0.22, py + s * 0.7, s * 0.1, s * 0.08);
      }
      if (tile.kind === 'gate') {
        ctx.fillStyle = '#6b4428';
        ctx.fillRect(px + s * 0.12, py + s * 0.2, s * 0.12, s * 0.62);
        ctx.fillRect(px + s * 0.76, py + s * 0.2, s * 0.12, s * 0.62);
        ctx.fillStyle = '#f2c14e';
        ctx.beginPath();
        ctx.arc(px + s * 0.5, py + s * 0.28, s * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
      if (tile.kind === 'camp') {
        ctx.fillStyle = '#8d4f3a';
        ctx.beginPath();
        ctx.moveTo(px + s * 0.5, py + s * 0.22);
        ctx.lineTo(px + s * 0.78, py + s * 0.7);
        ctx.lineTo(px + s * 0.22, py + s * 0.7);
        ctx.fill();
        ctx.fillStyle = '#e36a2c';
        ctx.beginPath();
        ctx.arc(px + s * 0.5, py + s * 0.62, s * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
      if (tile.feature && tile.feature.type === 'cache' && !(run.cleared && run.cleared[keyOf(x, y)])) {
        ctx.fillStyle = '#8d5a32';
        ctx.fillRect(px + s * 0.32, py + s * 0.4, s * 0.36, s * 0.28);
        ctx.fillStyle = '#f2c14e';
        ctx.fillRect(px + s * 0.32, py + s * 0.36, s * 0.36, s * 0.08);
      }
      if (tile.feature && tile.feature.type === 'shrine' && !(run.cleared && run.cleared[keyOf(x, y)])) {
        ctx.fillStyle = '#d9d3c5';
        ctx.fillRect(px + s * 0.38, py + s * 0.34, s * 0.24, s * 0.32);
        ctx.fillStyle = '#f2c14e';
        ctx.fillRect(px + s * 0.46, py + s * 0.26, s * 0.08, s * 0.12);
      }
      if (tile.feature && tile.feature.type === 'traveler' && !(run.cleared && run.cleared[keyOf(x, y)])) {
        ctx.fillStyle = '#c47b4a';
        ctx.fillRect(px + s * 0.42, py + s * 0.34, s * 0.16, s * 0.28);
        ctx.beginPath();
        ctx.arc(px + s * 0.5, py + s * 0.28, s * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
      if (tile.enemy && !(run.cleared && run.cleared[keyOf(x, y)])) drawBeast(ctx, tile.enemy.kind, px, py, s);
    }
    ctx.globalAlpha = 1;
  }

  function drawBeast(ctx, kind, px, py, s) {
    if (kind === 'boar') {
      ctx.fillStyle = '#6a4634';
      ctx.beginPath();
      ctx.ellipse(px + s * 0.5, py + s * 0.58, s * 0.24, s * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(px + s * 0.62, py + s * 0.5, s * 0.16, s * 0.08);
    } else if (kind === 'wisp') {
      ctx.fillStyle = 'rgba(143, 208, 200, 0.9)';
      ctx.beginPath();
      ctx.arc(px + s * 0.5, py + s * 0.48, s * 0.16, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#6d7680';
      ctx.beginPath();
      ctx.ellipse(px + s * 0.48, py + s * 0.58, s * 0.22, s * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px + s * 0.66, py + s * 0.48, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(px + s * 0.62, py + s * 0.44, 2, 2);
    ctx.fillRect(px + s * 0.7, py + s * 0.44, 2, 2);
  }

  function drawActor(ctx) {
    const s = view.tile;
    const pt = tilePixel(view.px, view.py);
    if (run.phase !== 'dead') {
      const glow = ctx.createRadialGradient(pt.x, pt.y, 2, pt.x, pt.y, s * 2.2);
      glow.addColorStop(0, 'rgba(242, 193, 78, 0.35)');
      glow.addColorStop(1, 'rgba(242, 193, 78, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, s * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = run.phase === 'dead' ? '#5c5348' : '#243e66';
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y - s * 0.28);
    ctx.lineTo(pt.x + s * 0.2, pt.y + s * 0.24);
    ctx.lineTo(pt.x - s * 0.2, pt.y + s * 0.24);
    ctx.fill();
    ctx.fillStyle = '#f0c9a0';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y - s * 0.22, s * 0.1, 0, Math.PI * 2);
    ctx.fill();
    if (run.phase !== 'dead') {
      ctx.fillStyle = '#f2c14e';
      ctx.fillRect(pt.x + s * 0.12, pt.y - s * 0.02, s * 0.08, s * 0.12);
    }
  }

  function paint() {
    if (!view.root || !run) return;
    const exp = run.exp;
    const campDepth = exp.path.length - 1;
    view.root.dataset.open = '1';
    view.root.dataset.x = String(run.x);
    view.root.dataset.y = String(run.y);
    view.root.dataset.phase = run.phase;
    view.root.dataset.floor = String(run.floor);
    view.root.dataset.depth = String(run.bestDepth);
    view.root.dataset.seed = run.seed;
    view.root.dataset.label = run.label;
    view.root.dataset.hp = String(run.hp);
    view.root.dataset.gold = String(run.gold);
    text('hvx-title', exp.title + (run.floor > 1 ? ' · stretch ' + run.floor : ''));
    text('hvx-seed', run.label);
    text('hvx-seedraw', run.seed);
    text('hvx-floor', 'Stretch ' + run.floor);
    text('hvx-depth', 'Depth ' + run.bestDepth);
    text('hvx-hp', 'HP ' + run.hp + '/' + run.maxHp);
    text('hvx-food', 'Food ' + run.food);
    text('hvx-gold', run.gold + ' coin');
    text('hvx-pelts', run.pelts + (run.pelts === 1 ? ' pelt' : ' pelts'));
    text('hvx-score', 'Score ' + scoreOf(run));
    const best = loadBest();
    text('hvx-best', best && best.runs
      ? 'Best depth ' + best.bestDepth + ' · score ' + best.bestScore + ' · ' + (best.bestSeed || 'a remembered trail')
      : 'No trail banked yet');
    const fill = document.getElementById('hvx-meter-fill');
    if (fill) {
      const here = exp.tiles[run.y][run.x].depth || 0;
      fill.style.width = Math.max(4, Math.min(100, (here / Math.max(1, campDepth)) * 100)) + '%';
    }
    const log = document.getElementById('hvx-log');
    if (log) log.textContent = run.log.length ? run.log[run.log.length - 1] : '';
    show('hvx-explore', run.phase === 'explore');
    show('hvx-encounter', run.phase === 'encounter');
    show('hvx-camp', run.phase === 'camp');
    show('hvx-dead', run.phase === 'dead');
    show('hvx-traveler', run.phase === 'traveler');
    if (run.phase === 'encounter' && run.encounter) {
      const e = run.encounter;
      text('hvx-enemy', e.name + ' · HP ' + Math.max(0, e.hp) + '/' + e.maxHp + ' · bite ' + e.atk + ' · +' + e.gold + ' coin');
      text('hvx-strike', 'Strike · ' + run.atk);
      const sneakBtn = document.getElementById('hvx-sneak');
      if (sneakBtn) {
        sneakBtn.textContent = 'Sneak · ' + Math.round(sneakChance(e.depth, run.floor) * 100) + '%';
        sneakBtn.disabled = run.food < 1;
      }
    }
    if (run.phase === 'camp') {
      text('hvx-camp-copy', 'The fire holds at depth ' + run.bestDepth + '. Press on, or carry ' + run.gold + ' coin home.');
    }
    if (run.phase === 'dead') {
      text('hvx-dead-copy', 'Depth ' + run.bestDepth + ' is remembered. Half the coin can still walk home.');
    }
    if (run.phase === 'traveler') {
      text('hvx-traveler-copy', 'Share one meal for a sharper spear, or walk on.');
      const share = document.getElementById('hvx-share');
      if (share) share.disabled = run.food < 1;
    }
    draw();
  }

  function text(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function show(id, on) {
    const node = document.getElementById(id);
    if (node) node.hidden = !on;
  }

  function frame(now) {
    view.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, ((now - view.last) || 16) / 1000);
    view.last = now;
    view.anim += dt;
    if (run && run.pops) {
      for (let i = 0; i < run.pops.length; i++) run.pops[i].life -= dt;
      run.pops = run.pops.filter(function (p) { return p.life > 0; });
    }
    if (run) draw();
  }

  function startLoop() {
    if (view.raf) return;
    view.last = 0;
    view.raf = requestAnimationFrame(frame);
  }

  function close(notify) {
    if (view.raf) cancelAnimationFrame(view.raf);
    view.raf = 0;
    if (view.root) view.root.hidden = true;
    const hook = view.hook;
    view.hook = null;
    run = null;
    if (notify && hook) {
      try { hook(); } catch (e) { /* the valley resumes on its own terms */ }
    }
  }

  function open(opts) {
    if (typeof document === 'undefined') return;
    const o = opts || {};
    ensureCss();
    if (!view.root) mount();
    view.root.hidden = false;
    view.hook = typeof o.onClose === 'function' ? o.onClose : null;
    begin(o.seed || '');
    startLoop();
  }

  return {
    SAVE_KEY: SAVE_KEY,
    DEPTH_STRIDE: DEPTH_STRIDE,
    cleanSeed: cleanSeed,
    hashSeed: hashSeed,
    seedLabel: seedLabel,
    dailySeed: dailySeed,
    freshSeed: freshSeed,
    sneakChance: sneakChance,
    generate: generate,
    createRun: createRun,
    move: move,
    strike: strike,
    sneak: sneak,
    fallBack: fallBack,
    shareMeal: shareMeal,
    passTraveler: passTraveler,
    pressOn: pressOn,
    scoreOf: scoreOf,
    cautiousClear: cautiousClear,
    loadBest: loadBest,
    open: open,
    close: close,
  };
});
