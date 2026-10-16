/* TYC-61 — timed offers must treat The Wall as busy.
 *
 * Startup Tycoon's event spawners refuse to fire while certain modals
 * are open, via a copied querySelector:
 *
 *   #win-modal.open, #tip-modal.open, #founder-modal.open,
 *   #ipo-modal.open, #theme-modal.open, #board-modal.open
 *
 * The Wall (TYC-59) is a browsing overlay with the same `.open` class,
 * already on the focus-trap roster, and was never added to those lists.
 * A player reading The Wall could get a poach / hackathon / acquisition
 * stacked on top of it. Help, Dashboard, Achievements and the Elevator
 * are the same miss. Same class of list-drift as TYC-60 (Escape),
 * different list — Escape is not this ticket.
 *
 * Pure static analysis. No browser, no shipped hook.
 *
 * A. The scan actually finds the busy-gates (guards the guard: a regex
 *    that matches nothing would pass silently).
 * B. Every known spawner is found by name.
 * C. Each gate treats #wall-modal.open as busy — named per updateXxx,
 *    so reverting the Wall from one list fails that spawner.
 * D. Help / Dashboard / Achievements / Elevator are on the same lists.
 * E. board-modal stays on the offer spawners; updateBoard still omits
 *    itself (it IS the board vote).
 * F. The Wall assertion is not vacuous: stripping #wall-modal.open from
 *    a copy of the source fails every named gate.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const FILE = path.join(ROOT, 'tycoon', 'play.html');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const BROWSING = ['wall-modal', 'help-modal', 'dash-modal', 'achievements-modal', 'elevator-modal'];
const KNOWN = [
  'updateAcq', 'updateOnsite', 'updateLaunch', 'updatePoach', 'updateRetreat',
  'updateBoard', 'updateRfp', 'updateHackathon', 'updateTroll', 'updateMentor',
  'updateWar', 'updateBridge', 'updateKeynote', 'updateSre', 'updateMigrate',
];

function busyGates(src) {
  // Enclosing function = last `function name(` whose start precedes the
  // querySelector. A char-budget lookbehind missed updateHackathon: its
  // in-flight toast is a long template string sitting between the
  // declaration and the gate.
  const fns = [...src.matchAll(/function\s+([A-Za-z0-9_]+)\s*\(/g)]
    .map(m => ({ name: m[1], index: m.index }));
  const gates = [];
  const re = /document\.querySelector\('((?:#[a-z0-9-]+\.open(?:, )?)+)'\)/g;
  let m;
  while ((m = re.exec(src))) {
    const sel = m[1];
    // The repeated busy-list: tip + founder. The SEV-1 outage gate is
    // only win+ipo and is a different, narrower list — not this ticket.
    if (!/#tip-modal\.open/.test(sel) || !/#founder-modal\.open/.test(sel)) continue;
    const ids = [...sel.matchAll(/#([a-z0-9-]+)\.open/g)].map(x => x[1]);
    let name = `gate@${m.index}`;
    for (const fn of fns) {
      if (fn.index < m.index) name = fn.name;
      else break;
    }
    gates.push({ name, sel, ids });
  }
  return gates;
}

const src = fs.readFileSync(FILE, 'utf8');
ok(src.includes('id="wall-modal"'), 'tycoon/play.html still ships #wall-modal');

const trap = src.match(/for \(const mid of \[([^\]]+)\]/);
ok(!!trap, 'the focus-trap roster is still a hand-written id list');
if (trap) {
  for (const id of BROWSING) {
    ok(trap[1].includes("'" + id + "'"),
      `focus-trap roster still names ${id} (the overlay exists)`);
  }
}

const gates = busyGates(src);
ok(gates.length >= 15,
  `the scan finds the busy-gates (${gates.length} win+tip+founder selectors)`);

const names = gates.map(g => g.name);
const missingKnown = KNOWN.filter(n => !names.includes(n));
ok(missingKnown.length === 0,
  `every known spawner is found by name${missingKnown.length ? ' — missing ' + missingKnown.join(', ') : ` (${KNOWN.length})`}`);

for (const g of gates) {
  ok(g.ids.includes('wall-modal'),
    `${g.name} treats #wall-modal.open as busy`);
  const omitted = BROWSING.filter(id => !g.ids.includes(id));
  ok(omitted.length === 0,
    `${g.name} treats Help/Dashboard/Achievements/Elevator as busy`
    + (omitted.length ? ` — missing ${omitted.join(', ')}` : ''));
  if (g.name === 'updateBoard') {
    ok(!g.ids.includes('board-modal'),
      'updateBoard omits #board-modal (it is the board vote)');
  } else {
    ok(g.ids.includes('board-modal'),
      `${g.name} still treats #board-modal.open as busy`);
  }
}

const stripped = src.replace(/, #wall-modal\.open/g, '');
const broken = busyGates(stripped);
const wallGone = broken.filter(g => !g.ids.includes('wall-modal'));
ok(broken.length === gates.length && wallGone.length === gates.length,
  `stripping #wall-modal.open fails every named gate (${wallGone.map(g => g.name).join(', ')})`);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
