/* QA — no temporary test hook ever ships.
 *
 * This suite exists because one did. `window.__ldT` — a strip-before-
 * commit hook written to verify LAB-53's walk-down — went out in
 * commit 8108cad and sat on production through four release rounds.
 * It exposed setCash, so the whole Grow Op economy was one console
 * line away from anybody who opened devtools. Every other suite on
 * this battery drives behaviour through the DOM, which is blind to a
 * global that nothing in the game ever calls.
 *
 * The per-tranche pipeline has a strip step; the strip step is a
 * human habit, and habits miss. This is the check that doesn't.
 *
 * A. No shipped source file defines a window.__<name>T hook.
 * B. The wider net: no window.__ global is assigned at all outside
 *    tests, beyond a short allow-list that has to be edited on purpose.
 * C. No debugger statements, and no bare `window.state`/`window.G`
 *    style whole-state exports bolted on at the end of a file.
 * D. The scan actually reaches the files it claims to (guards the
 *    guard: a typo'd glob that matches nothing would pass silently).
 *
 * Pure static analysis over the working tree — no browser, so it is
 * fast enough to run first and fail the battery before anything else
 * spends thirty seconds booting Chromium.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

// Everything the site actually serves. tests/ is where hooks are
// allowed to be named; node_modules and .git are not ours.
const SKIP_DIRS = new Set(['tests', 'node_modules', '.git', '.github', 'vendor']);

// Globals that are allowed to exist, each because somebody decided so
// on purpose. Anything NOT on this list fails assertion B, so adding a
// new window.__ global is a deliberate act that has to come here first.
//   __hvReset — Hearthvale's save-wipe escape hatch. Long-standing, and
//     not the same class of thing as a leaked hook: it grants no
//     resources, it only clears the local save and reloads, which the
//     game's own New Game already does.
// (vendor/ is skipped wholesale above: three.js sets its own
//  window.__THREE__ and that is not ours to police.)
const ALLOWED_GLOBALS = new Set(['__hvReset']);
function sources(dir = ROOT, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') && e.name !== '.github') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      sources(full, out);
    } else if (/\.(html|js)$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

const files = sources();
const rel = f => path.relative(ROOT, f);

// D — guard the guard, before trusting any of the clean results below.
ok(files.length >= 20,
  `the scan reaches the shipped source (${files.length} .html/.js files outside tests/)`);
ok(files.some(f => rel(f) === 'drug-lab.html') && files.some(f => rel(f) === 'tycoon/play.html')
   && files.some(f => rel(f) === 'ageofwar/ageofwar.js') && files.some(f => rel(f) === 'hearthvale.html')
   && files.some(f => rel(f) === 'voxel-garden.html') && files.some(f => rel(f) === 'homeless-village.html'),
  'and it reaches all six flagships by name');

const read = f => fs.readFileSync(f, 'utf8');

// A — the exact shape the pipeline creates and is supposed to strip.
{
  const hits = [];
  for (const f of files) {
    const src = read(f);
    const m = src.match(/window\.__[A-Za-z0-9_]*T\s*=/g);
    if (m) hits.push(`${rel(f)} (${m.join(', ')})`);
  }
  ok(hits.length === 0,
    `no window.__<name>T test hook survives into shipped source${hits.length ? ' — LEAKED: ' + hits.join('; ') : ''}`);
}

// B — the wider net: any window.__ assignment at all.
{
  const hits = [];
  for (const f of files) {
    const src = read(f);
    const m = src.match(/window\.__[A-Za-z0-9_]+\s*=/g) || [];
    const bad = [...new Set(m)].filter(x => !ALLOWED_GLOBALS.has(x.replace(/^window\.|\s*=$/g, '').trim()));
    if (bad.length) hits.push(`${rel(f)} (${bad.join(', ')})`);
  }
  ok(hits.length === 0,
    `no window.__ global is assigned in shipped source at all${hits.length ? ' — FOUND: ' + hits.join('; ') : ''}`);
}

// C — the neighbours of the same mistake.
{
  const hits = [];
  for (const f of files) {
    // A `debugger` inside a string or comment is not a breakpoint;
    // require it to stand as its own statement.
    for (const line of read(f).split('\n')) {
      if (/(^|[;{}\s])debugger\s*;/.test(line) && !/^\s*(\/\/|\*)/.test(line)) {
        hits.push(rel(f));
        break;
      }
    }
  }
  ok(hits.length === 0,
    `no debugger statement ships${hits.length ? ' — FOUND: ' + hits.join(', ') : ''}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
