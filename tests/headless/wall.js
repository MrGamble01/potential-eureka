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
// Each flagship declares its own chain; the checks below are the same
// for all of them, so the suite is written once and walked per game.
const GAMES = [
  { name: 'Startup Tycoon', file: 'tycoon/play.html', table: 'TYC_WALL',
    url: '/tycoon/play.html', btn: '#open-wall-btn', modal: '#wall-modal',
    list: '#wall-list', prog: '#wall-progress', row: '.wall-row',
    nameCls: '.wall-name', noteCls: '.wall-note', pfx: 'wall',
    twoWay: 'reunion', midChain: 'docent', midPrev: 'mural', wrongPrev: 'song',
    nextAfter: /Guest Book/,
    seedKeys: { record: ['tyc-record','beats'], plaque: ['tyc-plaque','cheers'],
      visitor: ['tyc-visitor','visits'], reunion: ['tyc-reunion','held'],
      photo: ['tyc-portrait','looks'], toast: ['tyc-anniversary','toasts'] },
    extraClear: ['tyc-nextyears'],
    pre: () => ({ 'tycoon:welcomeSeen-v1': '1' }) },
  { name: 'Grow Op', file: 'drug-lab.html', table: 'LAB_CHAIN',
    url: '/drug-lab.html', btn: '#chain-toggle', modal: '#chain-modal',
    list: '#chain-list', prog: '#chain-progress', row: '.chain-row',
    nameCls: '.chain-name', noteCls: '.chain-note', pfx: 'chain',
    twoWay: 'breunion', midChain: 'docent', midPrev: 'mural', wrongPrev: 'track',
    nextAfter: /Wall of Names/,
    seedKeys: { hwm: ['growop-record','beats'], gplaque: ['growop-plaque','cheers'],
      og: ['growop-visitor','visits'], breunion: ['growop-reunion','held'],
      polaroid: ['growop-portrait','looks'], canniv: ['growop-anniversary','toasts'] },
    extraClear: ['growop-frame'],
    // A fresh corner opens on the difficulty picker, which sits over
    // the whole page; pick one so the test measures the wall.
    dismiss: '#diff-careful',
    pre: () => ({}) },
  { name: 'Age of War', file: 'ageofwar/ageofwar.js', table: 'AOW_CHAIN',
    url: '/ageofwar/index.html', btn: '#aow-chain-btn', modal: '#aow-chain-modal',
    list: '#aow-chain-list', prog: '#aow-chain-progress', row: '.aow-chain-row',
    nameCls: '.aow-chain-name', noteCls: '.aow-chain-note', pfx: 'aow-chain',
    twoWay: 'vreunion', midChain: 'mark', midPrev: 'guide', wrongPrev: 'cache',
    nextAfter: /Muster Roll/,
    seedKeys: { chron: ['aow-chronicle','beats'], laurel: ['aow-plaque','cheers'],
      gen: ['aow-visitor','visits'], vreunion: ['aow-reunion','held'],
      painting: ['aow-portrait','looks'], salute: ['aow-anniversary','toasts'] },
    extraClear: ['aow-blankpanels'],
    pre: () => ({ 'aow-welcome-seen': '1' }) },
  { name: 'Homeless Village', file: 'homeless-village/js/config.js', table: 'HV_CHAIN',
    url: '/homeless-village.html', btn: '#chain-btn', modal: '#chain-modal',
    list: '#chain-list', prog: '#chain-progress', row: '.chain-row',
    nameCls: '.chain-name', noteCls: '.chain-note', pfx: 'chain',
    twoWay: 'reunion', midChain: 'mark', midPrev: 'walk', wrongPrev: 'can',
    nextAfter: /Spiral Notebook/,
    seedKeys: { rec: ['hv-record','beats'], star: ['hv-plaque','cheers'],
      marisol: ['hv-visitor','visits'], reunion: ['hv-reunion','held'],
      snap: ['hv-portrait','looks'], anniv: ['hv-anniversary','toasts'] },
    extraClear: ['hv-emptyhook'],
    pre: () => ({}) },
  { name: 'Hearthvale', file: 'hearthvale.html', table: 'HVALE_CHAIN',
    url: '/hearthvale.html', btn: '#chain-btn', modal: '#chain-modal',
    list: '#chain-list', prog: '#chain-progress', row: '.chain-row',
    nameCls: '.chain-name', noteCls: '.chain-note', pfx: 'chain',
    twoWay: 'freunion', midChain: 'mark', midPrev: 'warden', wrongPrev: 'casket',
    nextAfter: /Hall Register/,
    seedKeys: { ledger: ['hvale-record','beats'], gilt: ['hvale-plaque','cheers'],
      reeve: ['hvale-visitor','visits'], freunion: ['hvale-reunion','held'],
      portrait: ['hvale-portrait','looks'], fday: ['hvale-anniversary','toasts'] },
    extraClear: ['hvale-plaster'],
    // A fresh valley opens on a full-screen welcome, and the Hall
    // itself lives on the pause menu — so two clicks before the button.
    dismiss: ['#welcome-close', '#menu-btn'],
    pre: () => ({}) },
  { name: 'Voxel Isle', file: 'voxel-garden.html', table: 'VOX_CHAIN',
    url: '/voxel-garden.html', btn: '#chain-btn', modal: '#chain-modal',
    list: '#chain-list', prog: '#chain-progress', row: '.chain-row',
    nameCls: '.chain-name', noteCls: '.chain-note', pfx: 'chain',
    twoWay: 'sreunion', midChain: 'mark', midPrev: 'pilot', wrongPrev: 'chest',
    nextAfter: /Harbor Log/,
    seedKeys: { vrec: ['vox-record','beats'], wreath: ['vox-plaque','cheers'],
      keeper: ['vox-visitor','visits'], sreunion: ['vox-reunion','held'],
      dframe: ['vox-portrait','looks'], mooring: ['vox-anniversary','toasts'] },
    extraClear: ['vox-bareline'],
    pre: () => ({}) },
];
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };


// ---- parsing the table out of a game's source ---------------------
function parseChain(src, tableName) {
  // The table may sit at top level or indented inside an IIFE, so
  // allow leading whitespace on both the opening and closing lines.
  // Declaration form varies by house (const in three, var in the
  // classic-script one), as does indentation — the table may sit at
  // top level or inside an IIFE. Accept all of it; a table this
  // check cannot find reports 0 rows and fails loudly, which is the
  // right way for a static analyser to be wrong.
  const m = src.match(new RegExp('(?:const|let|var)\\s+' + tableName + '\\s*=\\s*\\[([\\s\\S]*?)\\n\\s*\\];'));
  if (!m) return null;
  const rows = [];
  for (const line of m[1].split('\n')) {
    const id = line.match(/id:\s*'([^']+)'/);
    if (!id) continue;
    // Arrow bodies (`() => loadX().f`) and classic ones
    // (`function(){return loadX().f;}`) both appear across the houses.
    const tally = line.match(/tally:\s*(?:\(\)\s*=>|function\s*\(\)\s*\{\s*return)\s*\(?\s*(load[A-Za-z]+)\(\)\.([a-zA-Z]+)/);
    const gate = line.match(/gate:\s*(?:\(\)\s*=>|function\s*\(\)\s*\{\s*return)\s*([a-zA-Z]+)\(\)/);
    const prevOne = line.match(/prev:\s*'([^']+)'/);
    const prevMany = line.match(/prev:\s*\[([^\]]*)\]/);
    const need = line.match(/need:\s*([A-Z0-9_]+)\s*\}/);
    if (!need) continue;
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
function resolveConst(src, name) {
  if (/^\d+$/.test(name)) return Number(name);
  const m = src.match(new RegExp('\\b' + name + '\\s*=\\s*(\\d+)'));
  return m ? Number(m[1]) : null;
}
// Every `loadX().field >= N` clause inside a named predicate. The two
// brace shapes cover both houses' formatting.
function gateClauses(src, fnName) {
  // Both houses' formatting: `return x;` and `return(x);`, braces
  // tight or spaced.
  const m = src.match(new RegExp('function ' + fnName + '\\(\\)\\s*\\{\\s*return\\s*([^;]*);\\s*\\}'));
  if (!m) return null;
  const out = [];
  const re = /(load[A-Za-z]+)\(\)\.([a-zA-Z]+)[^>]*>=\s*([A-Z0-9_]+)/g;
  let c;
  while ((c = re.exec(m[1])) !== null) out.push({ loader: c[1], field: c[2], need: c[3] });
  return out;
}

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errs = [];

  for (const G of GAMES) {
    const SRC = fs.readFileSync(path.join(ROOT, G.file), 'utf8');
    const rows = parseChain(SRC, G.table);
    const tag = G.name;

    ok(!!rows && rows.length >= 15,
      `${tag}: the chain table parses out of the source (${rows ? rows.length : 0} rows)`);
    if (!rows) continue;
    ok(rows.every(r => r.loader && r.field),
      `${tag}: every row reads its tally through one of the game's own loaders`);
    ok(new Set(rows.map(r => r.id)).size === rows.length,
      `${tag}: every row has its own id — no duplicate rows`);
    const idx = {}; rows.forEach((r, i) => { idx[r.id] = i; });
    ok(rows.every(r => r.prev.every(p => idx[p] !== undefined)),
      `${tag}: every row that names a predecessor names one that exists`);
    ok(rows.every((r, i) => r.prev.every(p => idx[p] < i)),
      `${tag}: and every predecessor comes earlier in the table than the row it opens`);

    // ---- the drift check ------------------------------------------
    const byId = {}; rows.forEach(r => { byId[r.id] = r; });
    const gated = rows.filter(r => r.gate && r.prev.length);
    ok(gated.length >= 12, `${tag}: ${gated.length} rows declare a gate to cross-check`);

    const checkRow = r => {
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
    };
    const drift = gated.map(checkRow).filter(Boolean);
    ok(drift.length === 0,
      `${tag}: every gate opens on exactly the tallies and numbers the table claims${drift.length ? ' — DRIFT: ' + drift.join('; ') : ''}`);

    // ---- the guard can fail ---------------------------------------
    {
      const wrongNumber = checkRow({ ...byId[G.midChain], need: '9' });
      const wrongPrev = checkRow({ ...byId[G.midChain], prev: [G.wrongPrev] });
      const wrongCount = checkRow({ ...byId[G.twoWay], prev: [byId[G.twoWay].prev[0]] });
      ok(!!wrongNumber && /says 9/.test(wrongNumber),
        `${tag}: a wrong threshold is caught (${wrongNumber})`);
      ok(!!wrongPrev,
        `${tag}: a wrong predecessor is caught (${wrongPrev})`);
      ok(!!wrongCount && /condition/.test(wrongCount),
        `${tag}: and a row naming only one of a two-condition gate is caught (${wrongCount})`);
    }

    // ---- what a player actually sees ------------------------------
    async function openChainWith(seed) {
      const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
      const page = await ctx.newPage();
      page.on('pageerror', e => errs.push(`${tag}: ${String(e).slice(0, 160)}`));
      await page.addInitScript(([keys, s, pre, extra]) => {
        // Anything that would sit over the page and swallow the click.
        for (const [k, v] of Object.entries(pre)) { try { localStorage.setItem(k, v); } catch (e) { } }
        for (const [, [k]] of Object.entries(keys)) localStorage.removeItem(k);
        for (const k of extra) localStorage.removeItem(k);
        for (const [id, n] of Object.entries(s)) {
          const e = keys[id]; if (!e) continue;
          localStorage.setItem(e[0], JSON.stringify({ [e[1]]: n }));
        }
      }, [G.seedKeys, seed, G.pre(), G.extraClear]);
      await page.goto(BASE + G.url, { waitUntil: 'load' });
      for (const sel of [].concat(G.dismiss || [])) {
        await page.waitForSelector(sel, { state: 'visible', timeout: 25000 });
        await page.click(sel);
      }
      await page.waitForSelector(G.btn, { timeout: 25000 });
      await page.click(G.btn);
      // Tycoon and Grow Op mark an open modal with a class; Age of War
      // sets style.display. Waiting on a VISIBLE row inside the modal
      // is true for all three without caring which.
      await page.waitForSelector(`${G.modal} ${G.row}`, { state: 'visible', timeout: 10000 });
      const out = await page.evaluate(([list, row, nameCls, noteCls, prog, modal, pfx]) => {
        const rs = [...document.querySelectorAll(list + ' ' + row)];
        return {
          n: rs.length,
          prog: document.querySelector(prog).textContent,
          cls: rs.map(r => r.className.replace(row.slice(1) + ' ', '')),
          names: rs.map(r => r.querySelector(nameCls).textContent),
          notes: rs.map(r => r.querySelector(noteCls).textContent),
          dialog: document.querySelector(modal).getAttribute('role') === 'dialog',
          pfx,
        };
      }, [G.list, G.row, G.nameCls, G.noteCls, G.prog, G.modal, G.pfx]);
      await ctx.close();
      return out;
    }

    const fresh = await openChainWith({});
    ok(fresh.n === rows.length,
      `${tag}: a fresh save renders every row of the table (${fresh.n})`);
    ok(/^0 of /.test(fresh.prog),
      `${tag}: and reports none of it begun (${fresh.prog})`);
    ok(fresh.cls[0] === G.pfx + '-next',
      `${tag}: the first thing with nothing blocking it is marked as the one to do next`);
    ok(fresh.names[fresh.names.length - 1] === '—',
      `${tag}: and the far end stays unnamed — it says there is more, not what it is`);
    ok(fresh.dialog,
      `${tag}: it is a real dialog to a screen reader`);

    const seed = {}; Object.keys(G.seedKeys).forEach(k => { seed[k] = 3; });
    const partway = await openChainWith(seed);
    ok(/^6 of /.test(partway.prog) && partway.cls.filter(c => c === G.pfx + '-done').length === 6,
      `${tag}: six links in, the wall says six (${partway.prog})`);
    {
      const at = partway.cls.indexOf(G.pfx + '-next');
      ok(at >= 0 && G.nextAfter.test(partway.names[at] || ''),
        `${tag}: and points at the right next thing (${partway.names[at]})`);
    }
    ok(partway.notes.some(n => / \/ /.test(n)),
      `${tag}: a locked row shows real progress toward its gate (${partway.notes.find(n => / \/ /.test(n))})`);
    ok(partway.notes.filter(n => /done \d+ time/.test(n)).length === 6,
      `${tag}: and every begun row reports its own tally back`);
  }

  ok(errs.length === 0, `no page errors (${errs.length ? errs[0] : 'clean'})`);

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
