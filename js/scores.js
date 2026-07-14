/* ============================================
   SCORES — Shared localStorage score-reading helpers
   used by the Hall of Fame board and the arcade-card
   "best" badges (index.html). Both used to define their
   own copies of the same three tiny functions.
   ============================================ */

const Scores = {
  readJSON(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } },
  num(k) { const v = parseInt(localStorage.getItem(k) || '0', 10); return isNaN(v) ? 0 : v; },
  fmtMoney(n) { n = +n || 0; return n >= 1000 ? '$' + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : '$' + n; },
};
