/* STORAGE — every game's localStorage keys stay sane.
 *
 * All six flagships and the hub are served from one origin, so they share a
 * single localStorage namespace. Two features that pick the same key silently
 * corrupt each other, and a key written under one spelling and read under
 * another is memory that never persists. Neither shows up as a test failure
 * anywhere else: both round-trip fine inside a single page session.
 *
 * The memory arc added roughly twenty keys over the last several rounds and
 * will keep adding them, which is exactly the situation where a typo hides.
 *
 * A. Every literal key a game writes, it also reads (and vice versa).
 * B. No key is claimed by more than one game.
 *
 * Pure static analysis over the shipped sources — no browser needed.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const jsIn = dir => {
  const d = path.join(ROOT, dir);
  return fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith('.js')).sort()
    .map(f => path.join(dir, f)) : [];
};

const GAMES = {
  'Startup Tycoon':    ['tycoon/play.html'],
  'Age of War':        ['ageofwar/index.html', 'ageofwar/ageofwar.js'],
  'Homeless Village':  ['homeless-village.html', ...jsIn('homeless-village/js')],
  'Hearthvale':        ['hearthvale.html'],
  'Grow Op':           ['drug-lab.html'],
  'Voxel Isle':        ['voxel-garden.html'],
  'Hub':               ['index.html'],
};

// Keys reached either as string literals or through a *_KEY constant.
function keysOf(files) {
  const blob = files.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  const reads = new Set(), writes = new Set();
  for (const m of blob.matchAll(/getItem\(\s*['"]([^'"]+)['"]/g)) reads.add(m[1]);
  for (const m of blob.matchAll(/setItem\(\s*['"]([^'"]+)['"]/g)) writes.add(m[1]);
  for (const m of blob.matchAll(/(?:const|let|var)\s+(\w*KEY\w*)\s*=\s*['"]([^'"]+)['"]/g)) {
    const [, name, key] = m;
    if (new RegExp(`getItem\\(\\s*${name}\\s*\\)`).test(blob)) reads.add(key);
    if (new RegExp(`setItem\\(\\s*${name}\\s*,`).test(blob)) writes.add(key);
  }
  return { reads, writes };
}

const owners = new Map();
for (const [game, files] of Object.entries(GAMES)) {
  const { reads, writes } = keysOf(files);
  const writeOnly = [...writes].filter(k => !reads.has(k)).sort();
  const readOnly  = [...reads].filter(k => !writes.has(k)).sort();
  ok(writeOnly.length === 0,
    `${game}: every key it writes, it also reads back`
    + (writeOnly.length ? ` — written but never read: ${writeOnly.join(', ')}` : ''));
  ok(readOnly.length === 0,
    `${game}: every key it reads, it also writes`
    + (readOnly.length ? ` — read but never written: ${readOnly.join(', ')}` : ''));
  for (const k of new Set([...reads, ...writes])) {
    if (!owners.has(k)) owners.set(k, new Set());
    owners.get(k).add(game);
  }
}

const shared = [...owners.entries()].filter(([, g]) => g.size > 1)
  .map(([k, g]) => `${k} (${[...g].sort().join(' + ')})`);
ok(shared.length === 0,
  `no localStorage key is claimed by two games (${owners.size} keys on one shared origin)`
  + (shared.length ? ` — ${shared.join('; ')}` : ''));

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
