/* ============================================
   RIVALS — zero-backend shared leaderboards
   (IDEA-SITE-2). A share code is base64url JSON
   {v, n(ame), t(imestamp), s{game: best…}} plus
   a checksum, carried in a link as /#hof=<code>.
   Importing one stores the rival locally and the
   Hall of Fame shows their marks next to yours.
   No server, no accounts — codes ARE the network.
   ============================================ */

const Rivals = (() => {
  const STORE_KEY = 'arcade-rivals';
  const NAME_KEY = 'rival-name';
  const MAX_RIVALS = 8;
  const MAX_NAME = 18;

  // The shareable games: numeric personal bests with stable keys.
  // dir:'max' = higher is better; Minefield times are 'min'.
  const GAMES = {
    'snake-high':          { label: 'Snake',         fmt: v => v.toLocaleString() + ' pts',  dir: 'max' },
    'tetris-high':         { label: 'Tetris',        fmt: v => v.toLocaleString() + ' pts',  dir: 'max' },
    'breakout-high':       { label: 'Neon Breaker',  fmt: v => v.toLocaleString() + ' pts',  dir: 'max' },
    'asteroids-high':      { label: 'Vector Storm',  fmt: v => v.toLocaleString() + ' pts',  dir: 'max' },
    'g2048-best':          { label: '2048',          fmt: v => v.toLocaleString() + ' pts',  dir: 'max' },
    'mines-best-beginner': { label: 'Minefield',     fmt: v => v + 's',                      dir: 'min' },
    'connect4-streak':     { label: 'Drop Four',     fmt: v => v + ' streak',                dir: 'max' },
    'word5-streak':        { label: 'Word Five',     fmt: v => v + ' streak',                dir: 'max' },
    'cycles-streak':       { label: 'Light Cycles',  fmt: v => v + ' streak',                dir: 'max' },
    'pong-streak':         { label: 'Pong++',        fmt: v => v + ' streak',                dir: 'max' },
    'matrix-best':         { label: 'Memory Matrix', fmt: v => 'round ' + v,                 dir: 'max' },
    'stacker-best':        { label: 'Stacker',       fmt: v => v + ' floors',                dir: 'max' },
    'vector-best':         { label: 'Vector Defense', fmt: v => v + ' waves',                dir: 'max' },
    'cascade-best':        { label: 'Word Cascade',  fmt: v => v.toLocaleString() + ' pts',  dir: 'max' },
    'maze-best':           { label: 'Gem Labyrinth', fmt: v => v.toLocaleString() + ' pts',  dir: 'max' },
    'inkflip-best':        { label: 'Inkflip',       fmt: v => v + ' discs',                 dir: 'max' },
    'gutter-best':         { label: 'Gutterlight',   fmt: v => v + ' strokes',               dir: 'min' },
    'crate-best':          { label: 'Crate Escape',  fmt: v => v + ' puzzles',               dir: 'max' },
    // The flagships' saves are JSON blobs, so each carries its own reader
    // instead of the default parseInt (AOW-12 pattern). A corrupt blob
    // reads as 0 and simply drops out of the payload.
    'aow-best-run':        { label: 'Age of War ∞',  fmt: v => v + ' waves',                 dir: 'max',
      read: () => jsonField('aow-best-run', o => o.waves) },
    'startup-tycoon-v7':   { label: 'Startup Tycoon', fmt: v => '$' + v.toLocaleString() + ' lifetime', dir: 'max',
      read: () => jsonField('startup-tycoon-v7', o => o.lifetimeCash || o.allTimeCash || o.cash) },
    'hearthvale-v1':       { label: 'Hearthvale',    fmt: v => v + ' villagers at peak',     dir: 'max',
      read: () => jsonField('hearthvale-v1', o => o.peakPop != null ? o.peakPop : (o.state && o.state.peakPop)) },
    'homeless_village_v1': { label: 'Homeless Village', fmt: v => v + ' days survived',      dir: 'max',
      read: () => jsonField('homeless_village_v1', o => o.days) },
    'drug-lab-v1':         { label: 'Grow Op',       fmt: v => '$' + v.toLocaleString() + ' earned', dir: 'max',
      read: () => jsonField('drug-lab-v1', o => o.totalEarned) },
    'voxel-garden-v1':     { label: 'Voxel Isle',    fmt: v => v.toLocaleString() + ' coins earned', dir: 'max',
      read: () => jsonField('voxel-garden-v1', o => {
        const st = o.state && typeof o.state === 'object' && !Array.isArray(o.state) ? o.state : o;
        return st.totalEarned;
      }) },
    'ashmarch-chronicle-v1': { label: 'Ashmarch',    fmt: v => v + (v === 1 ? ' road' : ' roads'), dir: 'max',
      read: () => jsonField('ashmarch-chronicle-v1', o => Array.isArray(o.campaigns) ? o.campaigns.length : 0) },
  };
  function jsonField(key, pick) {
    try {
      let parsed = JSON.parse(localStorage.getItem(key) || 'null');
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch { parsed = null; }
      }
      const obj = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      const n = Number(pick(obj));
      if (!Number.isFinite(n) || n <= 0) return 0;
      const v = Math.floor(n);
      return Number.isSafeInteger(v) ? v : 0;
    } catch { return 0; }
  }

  // djb2 over the payload keeps casual link-mangling from producing
  // silently-wrong scores. Not tamper-proof — nothing client-side is —
  // just integrity for copy/paste accidents.
  function checksum(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }
  const b64e = s => btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const b64d = s => decodeURIComponent(escape(atob(
    s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4))));

  // A stored "12px" used to count as 12. Only a whole number of digits
  // is a score; anything else is no score.
  function wholeScore(raw) {
    const s = String(raw == null ? '' : raw).trim();
    if (!/^\d+$/.test(s)) return 0;
    const v = Number(s);
    return Number.isSafeInteger(v) ? v : 0;
  }

  function myScores() {
    const s = {};
    for (const key of Object.keys(GAMES)) {
      const g = GAMES[key];
      const v = g.read ? g.read() : wholeScore(localStorage.getItem(key));
      if (v > 0) s[key] = v;
    }
    return s;
  }

  function myName() { return (localStorage.getItem(NAME_KEY) || '').slice(0, MAX_NAME); }
  function setMyName(n) {
    try { localStorage.setItem(NAME_KEY, String(n).slice(0, MAX_NAME)); } catch { /* name stays as it was */ }
  }

  function encode() {
    const payload = JSON.stringify({ v: 1, n: myName() || 'RIVAL', t: Date.now(), s: myScores() });
    const b = b64e(payload);
    return b + '.' + checksum(b);
  }

  function decode(code) {
    const m = /^([A-Za-z0-9_-]+)\.([a-z0-9]+)$/.exec(String(code).trim());
    if (!m) return null;
    if (checksum(m[1]) !== m[2]) return null;
    let obj;
    try { obj = JSON.parse(b64d(m[1])); } catch { return null; }
    if (!obj || obj.v !== 1 || typeof obj.s !== 'object' || obj.s === null) return null;
    const name = String(obj.n || 'RIVAL').slice(0, MAX_NAME).replace(/[<>&"]/g, '');
    const s = {};
    for (const [k, v] of Object.entries(obj.s)) {
      if (GAMES[k] && typeof v === 'number' && isFinite(v) && v > 0) s[k] = Math.floor(v);
    }
    return { name: name || 'RIVAL', t: +obj.t || Date.now(), s };
  }

  // The stored list is untrusted: it is localStorage, so a crashed write, a
  // quota eviction or a stray hand-edit can leave anything there — and this
  // is the ONLY read path, so every consumer inherits whatever it returns.
  // A try/catch around JSON.parse is not enough: `null` parses fine and then
  // Object.entries(null) throws; `[1,2,3]` and `"hi"` parse fine and hand
  // back entries whose `.s` is undefined, which Object.keys() then throws on.
  // Both took the whole Hall of Fame down with an empty page.
  // So filter to well-shaped entries here rather than guarding at each caller.
  const plain = o => !!o && typeof o === 'object' && !Array.isArray(o);
  function list() {
    let raw;
    try { raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch { return {}; }
    if (!plain(raw)) return {};
    const out = {};
    for (const [name, r] of Object.entries(raw)) {
      if (!plain(r) || !plain(r.s)) continue;
      const s = {};
      for (const [k, v] of Object.entries(r.s)) {
        if (GAMES[k] && typeof v === 'number' && isFinite(v) && v > 0) s[k] = Math.floor(v);
      }
      out[String(name).slice(0, MAX_NAME)] = { t: +r.t || 0, s };
    }
    return out;
  }
  function saveList(l) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(l)); return true; }
    catch { return false; }
  }

  // Same name = same person: the newer code replaces the older one.
  // true = stored, false = the hall is full, null = the write did not land.
  function add(rival) {
    const l = list();
    if (!(rival.name in l) && Object.keys(l).length >= MAX_RIVALS) return false;
    l[rival.name] = { t: rival.t, s: rival.s };
    return saveList(l) ? true : null;
  }
  function remove(name) { const l = list(); delete l[name]; saveList(l); }

  // Best rival entry for one game key → {name, value} or null.
  function bestFor(key) {
    const g = GAMES[key];
    if (!g) return null;
    let best = null;
    for (const [name, r] of Object.entries(list())) {
      const v = r.s && r.s[key];
      if (typeof v !== 'number') continue;
      if (!best || (g.dir === 'min' ? v < best.value : v > best.value)) best = { name, value: v };
    }
    return best;
  }

  // Does the rival hold the lead for this game, against my current best?
  function rivalLeads(key) {
    const b = bestFor(key);
    if (!b) return false;
    const g = GAMES[key];
    // JSON flagship saves are not digit strings. wholeScore() of the blob
    // is 0, which made every imported rival look like they held the lead.
    let mine = 0;
    try {
      mine = g && g.read ? g.read() : wholeScore(localStorage.getItem(key));
    } catch { mine = 0; }
    if (!(mine > 0)) return true;
    return g && g.dir === 'min' ? b.value < mine : b.value > mine;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function chipHtml(name, count) {
    const label = String(name == null ? '' : name);
    const games = Math.max(0, Number(count) || 0);
    return '<span class="hof-rival-chip">⚔ ' + esc(label) +
      ' <span class="hof-rival-n">(' + games + ' games)</span>' +
      '<button type="button" class="hof-rival-x" data-rname="' + esc(encodeURIComponent(label)) +
      '" aria-label="' + esc('Remove ' + label) + '" title="' + esc('Remove ' + label) + '">✕</button></span>';
  }

  function fmt(key, v) { return GAMES[key] ? GAMES[key].fmt(v) : String(v); }

  // '#hof=<code>' in the URL — import, clean the hash, report what happened.
  function tryImportFromHash() {
    const m = /^#hof=(.+)$/.exec(location.hash || '');
    if (!m) return null;
    const rival = decode(decodeURIComponent(m[1]));
    history.replaceState(null, '', '#halloffame');
    if (!rival) return { ok: false };
    if (!Object.keys(rival.s).length) return { ok: false };
    const added = add(rival);
    if (added === true) return { ok: true, name: rival.name };
    if (added === false) return { ok: false, full: true };
    return { ok: false };
  }

  function shareUrl() {
    return location.origin + location.pathname.replace(/index\.html$/, '') + '#hof=' + encode();
  }

  return { GAMES, encode, decode, add, remove, list, bestFor, rivalLeads, fmt, chipHtml,
           myName, setMyName, tryImportFromHash, shareUrl };
})();
