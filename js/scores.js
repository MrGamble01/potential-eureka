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
    const raw = localStorage.getItem(k);
    if (raw == null) return 0;
    const s = String(raw).trim();
    if (!/^\d+$/.test(s)) return 0;
    const v = Number(s);
    return Number.isSafeInteger(v) ? v : 0;
  },
  fmtMoney(n) { n = +n || 0; return n >= 1000 ? '$' + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : '$' + n; },
};
