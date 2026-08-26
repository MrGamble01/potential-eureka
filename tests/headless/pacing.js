/* How deep is a flagship's memory chain, in sessions?
 *
 * Every link in every chain is once-a-session and opens only after N
 * uses of the one before it. Nobody had ever computed what that costs
 * a player end to end. It is 45 sessions — the same in all six games,
 * because the six chains were built to the same shape.
 *
 * That number is a design choice, not a defect: these are deliberately
 * deep-endgame rewards. What matters here is that it stays a CHOICE
 * rather than drifting. So this suite:
 *
 * A. Proves each chain is completable at all — every row reachable,
 *    no row waiting on something that comes after it, no cycle.
 * B. Computes the session cost per game and prints it, so the number
 *    is in front of anyone reading a battery run rather than buried
 *    in six source files.
 * C. Asserts the six stay in step with each other. The parallel shape
 *    is deliberate; one game quietly becoming twice as deep as its
 *    siblings would be a real regression and is invisible from inside
 *    that one game's source.
 * D. Guards the guard: the depth calculation must actually be doing
 *    the arithmetic, proved against a hand-computed fixture.
 *
 * Pure static analysis over the shipped tables — no browser.
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const GAMES = [
  ['Startup Tycoon',   'tycoon/play.html',             'TYC_WALL'],
  ['Grow Op',          'drug-lab.html',                'LAB_CHAIN'],
  ['Age of War',       'ageofwar/ageofwar.js',         'AOW_CHAIN'],
  ['Homeless Village', 'homeless-village/js/config.js','HV_CHAIN'],
  ['Hearthvale',       'hearthvale.html',              'HVALE_CHAIN'],
  ['Voxel Isle',       'voxel-garden.html',            'VOX_CHAIN'],
];

function parseChain(src, name) {
  const m = src.match(new RegExp('(?:const|let|var)\\s+' + name + '\\s*=\\s*\\[([\\s\\S]*?)\\n\\s*\\];'));
  if (!m) return null;
  const rows = [];
  for (const line of m[1].split('\n')) {
    const id = line.match(/id:\s*'([^']+)'/);
    if (!id) continue;
    const one = line.match(/prev:\s*'([^']+)'/);
    const many = line.match(/prev:\s*\[([^\]]*)\]/);
    const need = line.match(/need:\s*([A-Z0-9_]+)\s*\}/);
    if (!need) continue;
    rows.push({
      id: id[1],
      need: need[1],
      prev: many ? many[1].split(',').map(x => x.trim().replace(/'/g, '')).filter(Boolean)
           : one ? [one[1]] : [],
    });
  }
  return rows;
}
const resolveConst = (src, n) =>
  /^\d+$/.test(n) ? Number(n)
  : Number((src.match(new RegExp('\\b' + n + '\\s*=\\s*(\\d+)')) || [])[1]);

// Earliest session each link can first be used, then the earliest the
// whole chain can be finished. A link is once-a-session, so its Nth use
// lands N-1 sessions after it opened; the next link opens the session
// after that. Links run in parallel once open — each has its own
// once-a-session latch — so a player does every open link every sitting.
function depth(src, rows) {
  const open = {};
  for (const r of rows) {
    if (!r.prev.length) { open[r.id] = 1; continue; }
    const need = resolveConst(src, r.need);
    if (!Number.isFinite(need)) return null;
    const gates = r.prev.map(p => open[p]);
    if (gates.some(g => g === undefined)) return null;   // not yet computed => out of order
    open[r.id] = Math.max(...gates.map(g => g + need - 1)) + 1;
  }
  const last = rows[rows.length - 1];
  return { open, lastOpens: open[last.id], complete: open[last.id] + resolveConst(src, last.need) - 1 };
}

// D — the arithmetic itself, against a fixture worked out by hand.
{
  const fixture = [
    { id: 'a', prev: [], need: '0' },
    { id: 'b', prev: ['a'], need: '3' },   // a opens s1, 3rd use s3, b opens s4
    { id: 'c', prev: ['b'], need: '3' },   // b opens s4, 3rd use s6, c opens s7
  ];
  const d = depth('', fixture);
  ok(d && d.lastOpens === 7 && d.complete === 9,
    `the depth calculation does the arithmetic (a=1, b=4, c opens 7 and completes 9; got ${d && d.lastOpens}/${d && d.complete})`);
}

const depths = [];
for (const [name, file, table] of GAMES) {
  const src = fs.readFileSync(path.join(REPO, file), 'utf8');
  const rows = parseChain(src, table);
  ok(!!rows && rows.length >= 15, `${name}: chain parses (${rows ? rows.length : 0} links)`);
  if (!rows) continue;

  // A — completable: every predecessor exists and comes earlier, which
  // together rule out both a dangling gate and a cycle.
  const idx = {}; rows.forEach((r, i) => { idx[r.id] = i; });
  const dangling = rows.filter(r => r.prev.some(p => idx[p] === undefined));
  const backward = rows.filter((r, i) => r.prev.some(p => idx[p] >= i));
  ok(dangling.length === 0,
    `${name}: no link waits on something that is not in the chain${dangling.length ? ' — ' + dangling.map(r => r.id).join(', ') : ''}`);
  ok(backward.length === 0,
    `${name}: no link waits on something that comes after it — the chain cannot deadlock${backward.length ? ' — ' + backward.map(r => r.id).join(', ') : ''}`);

  const d = depth(src, rows);
  ok(!!d && Number.isFinite(d.complete),
    `${name}: every gate resolves to a real number, so the depth is computable`);
  if (!d) continue;
  depths.push({ name, links: rows.length, lastOpens: d.lastOpens, complete: d.complete });
}

// B — print it, every run.
console.log('\n--- sessions to walk the whole chain (once-a-session by design) ---');
for (const d of depths) {
  console.log(`      ${d.name.padEnd(18)} ${String(d.links).padStart(2)} links · last opens session ${String(d.lastOpens).padStart(3)} · complete ${String(d.complete).padStart(3)}`);
}

// C — the six stay in step.
{
  const lens = [...new Set(depths.map(d => d.links))];
  const fin = [...new Set(depths.map(d => d.complete))];
  ok(depths.length === GAMES.length, `all ${GAMES.length} flagships measured`);
  ok(lens.length === 1,
    `every flagship carries the same number of links (${lens.join(', ')})`);
  ok(fin.length === 1,
    `and every flagship completes in the same number of sessions (${fin.join(', ')}) — the parallel shape is deliberate, and one game drifting deeper than its siblings is invisible from inside that game's own source`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
