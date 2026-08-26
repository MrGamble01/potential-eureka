/* TYC-59 — The Wall, and the guard that keeps it honest.
 *
 * The wall is documentation that ships. Its risk is DRIFT: a threshold
 * moves in the game, the table keeps quoting the old one, and a player
 * is told they are 2/3 of the way to something that now needs 5. A
 * wall that lies is worse than no wall.
 *
 * So the centrepiece is not "the modal opens". It is a source-level
 * cross-check: for every gated row, find the game's OWN predicate,
 * read the loader and the threshold out of it, and assert both agree
 * with what the row declares. No browser, no test hook in shipped
 * source — the same shape as storagekeys.js, and it runs early.
 *
 * A. The table parses, and its rows are well formed and ordered.
 * B. DRIFT: every row's declared predecessor(s) and `need` match the
 *    loader(s) and threshold in the game's own gate function.
 * C. The guard can fail — a deliberately corrupted row is caught.
 * D. Rendering, driven through localStorage and the real DOM (no hook):
 *    a fresh company, a company part-way, and the modal itself.
 * Z. Zero page errors.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'tycoon', 'play.html'), 'utf8');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

// ---- parse the table out of the source ----------------------------
function parseWall(src) {
  const m = src.match(/const TYC_WALL = \[([\s\S]*?)\n\];/);
  if (!m) return null;
  const rows = [];
  for (const line of m[1].split('\n')) {
    const id = line.match(/id:\s*'([^']+)'/);
    if (!id) continue;
    const tally = line.match(/tally:\s*\(\)\s*=>\s*(?:\()?\s*(load[A-Za-z]+)\(\)\.([a-zA-Z]+)/);
    const gate = line.match(/gate:\s*\(\)\s*=>\s*([a-zA-Z]+)\(\)/);
    const prevOne = line.match(/prev:\s*'([^']+)'/);
    const prevMany = line.match(/prev:\s*\[([^\]]*)\]/);
    const need = line.match(/need:\s*([A-Z0-9_]+)\s*\}/);
    rows.push({
      id: id[1],
      loader: tally ? tally[1] : null,
      field: tally ? tally[2] : null,
      gate: gate ? gate[1] : null,
      prev: prevMany ? prevMany[1].split(',').map(x => x.trim().replace(/'/g, '')).filter(Boolean)
           : prevOne ? [prevOne[1]] : [],
      need: need ? need[1] : null,
    });
  }
  return rows;
}

// Resolve a `const NAME = 123` used as a threshold.
function resolveConst(src, name) {
  if (/^\d+$/.test(name)) return Number(name);
  const m = src.match(new RegExp('\\b' + name + '\\s*=\\s*(\\d+)'));
  return m ? Number(m[1]) : null;
}

// Pull every `loadX().field >= N` clause out of a named predicate.
function gateClauses(src, fnName) {
  const m = src.match(new RegExp('function ' + fnName + '\\(\\) \\{ return ([^;]*); \\}'));
  if (!m) return null;
  const out = [];
  const re = /(load[A-Za-z]+)\(\)\.([a-zA-Z]+)[^>]*>=\s*([A-Z0-9_]+)/g;
  let c;
  while ((c = re.exec(m[1])) !== null) out.push({ loader: c[1], field: c[2], need: c[3] });
  return out;
}

const rows = parseWall(SRC);
ok(!!rows && rows.length >= 15,
  `the wall table parses out of the source (${rows ? rows.length : 0} rows)`);
ok(rows.every(r => r.loader && r.field),
  'every row reads its tally through one of the game’s own loaders');
ok(new Set(rows.map(r => r.id)).size === rows.length,
  'every row has its own id — no duplicate rows');
{
  const idx = {}; rows.forEach((r, i) => { idx[r.id] = i; });
  ok(rows.every(r => r.prev.every(p => idx[p] !== undefined)),
    'every row that names a predecessor names one that exists');
  ok(rows.every((r, i) => r.prev.every(p => idx[p] < i)),
    'and every predecessor comes earlier in the table than the row it opens');
}

// ---- B: the drift check ------------------------------------------
const byId = {}; rows.forEach(r => { byId[r.id] = r; });
const gated = rows.filter(r => r.gate && r.prev.length);
ok(gated.length >= 12, `${gated.length} rows declare a gate to cross-check`);

function checkRow(r) {
  const clauses = gateClauses(SRC, r.gate);
  if (!clauses) return `${r.id}: gate ${r.gate}() not found in source`;
  if (clauses.length !== r.prev.length) {
    return `${r.id}: gate has ${clauses.length} condition(s) but the row names ${r.prev.length} predecessor(s)`;
  }
  const want = Number(resolveConst(SRC, r.need));
  for (const c of clauses) {
    const got = Number(resolveConst(SRC, c.need));
    if (got !== want) return `${r.id}: row says ${r.need}=${want}, gate says ${c.need}=${got}`;
    const match = r.prev.some(p => byId[p] && byId[p].loader === c.loader && byId[p].field === c.field);
    if (!match) return `${r.id}: gate reads ${c.loader}().${c.field}, which none of [${r.prev.join(', ')}] provides`;
  }
  return null;
}
const drift = gated.map(checkRow).filter(Boolean);
ok(drift.length === 0,
  `every gate in the table opens on exactly the tallies and numbers it claims${drift.length ? ' — DRIFT: ' + drift.join('; ') : ''}`);

// ---- C: the guard can fail ---------------------------------------
{
  const corruptNumber = checkRow({ ...byId.docent, need: '9' });
  const corruptPrev = checkRow({ ...byId.docent, prev: ['song'] });
  const corruptCount = checkRow({ ...byId.reunion, prev: ['visitor'] });
  ok(!!corruptNumber && /says 9/.test(corruptNumber),
    `a wrong threshold is caught (${corruptNumber})`);
  ok(!!corruptPrev,
    `a wrong predecessor is caught (${corruptPrev})`);
  ok(!!corruptCount && /condition/.test(corruptCount),
    `and a row that names only one of a two-condition gate is caught (${corruptCount})`);
}

// ---- D: what a player actually sees ------------------------------
const KEYS = { record: ['tyc-record', 'beats'], plaque: ['tyc-plaque', 'cheers'],
  visitor: ['tyc-visitor', 'visits'], reunion: ['tyc-reunion', 'held'],
  photo: ['tyc-portrait', 'looks'], toast: ['tyc-anniversary', 'toasts'] };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errs = [];

  async function openWallWith(seed) {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await page.addInitScript(([keys, s]) => {
      // The first-run welcome modal sits over the whole page and would
      // swallow the click; mark it seen rather than dismissing it, so
      // the test measures the wall and not the onboarding.
      try { localStorage.setItem('tycoon:welcomeSeen-v1', '1'); } catch (e) { }
      for (const [, [k]] of Object.entries(keys)) localStorage.removeItem(k);
      localStorage.removeItem('tyc-nextyears');
      for (const [id, n] of Object.entries(s)) {
        const e = keys[id]; if (!e) continue;
        localStorage.setItem(e[0], JSON.stringify({ [e[1]]: n }));
      }
    }, [KEYS, seed]);
    await page.goto(BASE + '/tycoon/play.html', { waitUntil: 'load' });
    await page.waitForSelector('#open-wall-btn', { timeout: 25000 });
    await page.click('#open-wall-btn');
    await page.waitForSelector('#wall-modal.open .wall-row', { timeout: 10000 });
    const out = await page.evaluate(() => {
      const rs = [...document.querySelectorAll('#wall-list .wall-row')];
      return {
        n: rs.length,
        prog: document.getElementById('wall-progress').textContent,
        cls: rs.map(r => r.className.replace('wall-row ', '')),
        names: rs.map(r => r.querySelector('.wall-name').textContent),
        notes: rs.map(r => r.querySelector('.wall-note').textContent),
        dialog: document.getElementById('wall-modal').getAttribute('role') === 'dialog',
      };
    });
    await ctx.close();
    return out;
  }

  const fresh = await openWallWith({});
  ok(fresh.n === rows.length,
    `a fresh company renders every row of the table (${fresh.n})`);
  ok(/^0 of /.test(fresh.prog),
    `and reports none of it begun (${fresh.prog})`);
  ok(fresh.cls[0] === 'wall-next',
    'the first thing with nothing blocking it is marked as the one to do next');
  ok(fresh.names[fresh.names.length - 1] === '—',
    'and the far end stays unnamed — the wall says there is more, not what it is');
  ok(fresh.dialog,
    'it is a real dialog to a screen reader, like every other modal on the page');

  const partway = await openWallWith({ record: 3, plaque: 3, visitor: 3, reunion: 3, photo: 3, toast: 3 });
  ok(/^6 of /.test(partway.prog) && partway.cls.filter(c => c === 'wall-done').length === 6,
    `six links in, the wall says six (${partway.prog})`);
  ok(/Guest Book/.test(partway.names[partway.cls.indexOf('wall-next')] || ''),
    `and points at the Guest Book as the next thing to do (${partway.names[partway.cls.indexOf('wall-next')]})`);
  ok(partway.notes.some(n => / \/ /.test(n)),
    `a locked row shows real progress toward its gate rather than just "locked" (${partway.notes.find(n => / \/ /.test(n))})`);
  ok(partway.notes.filter(n => /done \d+ time/.test(n)).length === 6,
    'and every begun row reports its own tally back');

  ok(errs.length === 0, `no page errors (${errs.length ? errs[0] : 'clean'})`);

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
