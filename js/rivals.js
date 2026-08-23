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
  };

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

  function myScores() {
    const s = {};
    for (const key of Object.keys(GAMES)) {
      const v = parseInt(localStorage.getItem(key) || '0', 10);
      if (v > 0) s[key] = v;
    }
    return s;
  }

  function myName() { return (localStorage.getItem(NAME_KEY) || '').slice(0, MAX_NAME); }
  function setMyName(n) { localStorage.setItem(NAME_KEY, String(n).slice(0, MAX_NAME)); }

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

  function list() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch { return {}; }
  }
  function saveList(l) { localStorage.setItem(STORE_KEY, JSON.stringify(l)); }

  // Same name = same person: the newer code replaces the older one.
  function add(rival) {
    const l = list();
    if (!(rival.name in l) && Object.keys(l).length >= MAX_RIVALS) return false;
    l[rival.name] = { t: rival.t, s: rival.s };
    saveList(l);
    return true;
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
    const mine = parseInt(localStorage.getItem(key) || '0', 10) || 0;
    if (mine <= 0) return true;
    return GAMES[key].dir === 'min' ? b.value < mine : b.value > mine;
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
    return added ? { ok: true, name: rival.name } : { ok: false, full: true };
  }

  function shareUrl() {
    return location.origin + location.pathname.replace(/index\.html$/, '') + '#hof=' + encode();
  }

  return { GAMES, encode, decode, add, remove, list, bestFor, rivalLeads, fmt,
           myName, setMyName, tryImportFromHash, shareUrl };
})();
