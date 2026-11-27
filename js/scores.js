/* ============================================
   SCORES — Shared localStorage score-reading helpers
   used by the Hall of Fame board and the arcade-card
   "best" badges (index.html). Both used to define their
   own copies of the same three tiny functions.
   ============================================ */

const Scores = {
  readJSON(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } },
  // A stored "12px" or "1e3" used to parse as a real score. Only a
  // whole number of digits is a score; anything else reads as none.
  num(k) {
    let raw = null;
    try { raw = localStorage.getItem(k); } catch { return 0; }
    if (raw == null) return 0;
    const s = String(raw).trim();
    if (!/^\d+$/.test(s)) return 0;
    const v = Number(s);
    return Number.isSafeInteger(v) ? v : 0;
  },
  fmtMoney(n) { n = +n || 0; return n >= 1000 ? '$' + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : '$' + n; },
  // Hall of Fame line for one flagship. null means "not played".
  // A corrupt, partial, or double-encoded save reads as not played
  // instead of throwing the rest of the board away.
  flagship(id) {
    try { return flagshipBest(this, id); }
    catch { return null; }
  },
};

function plainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function finiteAmount(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return 0;
  return x;
}

function wholeCount(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return 0;
  const v = Math.floor(x);
  return Number.isSafeInteger(v) ? v : 0;
}

// A save written twice (JSON.stringify of an already-stringified blob)
// parses as a string. One extra parse recovers it; anything else is empty.
function asObject(scores, key) {
  let v = scores.readJSON(key);
  if (typeof v === 'string') {
    try { v = JSON.parse(v); } catch { return null; }
  }
  return plainObject(v) ? v : null;
}

function flagshipBest(scores, id) {
  if (id === 'ageofwar') {
    const run = asObject(scores, 'aow-best-run');
    const waves = run ? wholeCount(run.waves) : 0;
    if (waves > 0) return waves + (waves === 1 ? ' wave' : ' waves');
    const ach = asObject(scores, 'aow-achievements');
    const n = ach ? Object.values(ach).filter(Boolean).length : 0;
    return n > 0 ? n + (n === 1 ? ' achievement' : ' achievements') : null;
  }
  if (id === 'tycoon') {
    const s = asObject(scores, 'startup-tycoon-v7');
    if (!s) return null;
    // allTimeCash zeroes at each IPO. lifetimeCash is the career total
    // the catalogue badge already shows.
    const v = finiteAmount(s.lifetimeCash) || finiteAmount(s.allTimeCash) || finiteAmount(s.cash);
    return v > 0 ? scores.fmtMoney(v) + ' raised' : null;
  }
  if (id === 'hearthvale') {
    const s = asObject(scores, 'hearthvale-v1');
    if (!s) return null;
    const nested = plainObject(s.state) ? s.state.peakPop : 0;
    const v = wholeCount(s.peakPop != null ? s.peakPop : nested);
    return v > 0 ? v + ' villagers at peak' : null;
  }
  if (id === 'voxel') {
    const s = asObject(scores, 'voxel-garden-v1');
    if (!s) return null;
    let st = s.state;
    if (typeof st === 'string') {
      try { st = JSON.parse(st); } catch { st = null; }
    }
    if (!plainObject(st)) st = s;
    const earned = finiteAmount(st.totalEarned);
    if (!(earned > 0)) return null;
    const level = wholeCount(st.level) || 1;
    return scores.fmtMoney(earned) + ' harvested · LV ' + level;
  }
  if (id === 'ashmarch') {
    const s = asObject(scores, 'ashmarch-chronicle-v1');
    const n = s && Array.isArray(s.campaigns) ? s.campaigns.length : 0;
    return n > 0 ? n + (n === 1 ? ' road' : ' roads') : null;
  }
  if (id === 'gutterlight') {
    const v = scores.num('gutter-best');
    return v > 0 ? v + ' strokes' : null;
  }
  if (id === 'crateescape') {
    const v = scores.num('crate-best');
    return v > 0 ? v + ' puzzles' : null;
  }
  if (id === 'tetris') {
    const v = scores.num('tetris-high');
    return v > 0 ? v.toLocaleString() + ' pts' : null;
  }
  return null;
}
