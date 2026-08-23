/* ============================================
   TELEMETRY (IDEA-SITE-8) — local-only launch
   and playtime counters for the in-page arcade
   views. Everything lives under one localStorage
   key and never touches the network; the Hall of
   Fame reads it back the same way Achievements
   reads its own key.
   ============================================ */

const Telemetry = (() => {
  const KEY = 'eureka-stats';

  // The 14 in-page arcade/toy views tracked by the shell's teardown map —
  // the standalone games (Age of War, Tycoon, Grow Op, …) live on their own
  // pages and aren't covered by this module.
  const NAMES = {
    snake: 'Snake', tetris: 'Tetris', maze: 'Maze Runner', life: 'Game of Life',
    breakout: 'Neon Breaker', 2048: '2048', asteroids: 'Vector Storm',
    minesweeper: 'Minefield', connect4: 'Drop Four', word5: 'Word Five',
    lightcycles: 'Light Cycles', pong: 'Pong++', stacker: 'Stacker',
    memorymatrix: 'Memory Matrix',
  };

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
  }
  function write(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }

  // At most one view's timer runs at a time; `enter()` (called from the
  // shell's switchView) closes out whichever one was running before
  // starting the next, so time is never double-counted across a switch.
  let activeView = null, enteredAt = 0;

  function flush() {
    if (!activeView) return;
    const view = activeView, ms = Date.now() - enteredAt;
    activeView = null;
    if (ms <= 0) return;
    const s = read();
    s.minutes = s.minutes || {};
    s.minutes[view] = (s.minutes[view] || 0) + ms / 60000;
    write(s);
  }

  // Called once per navigation with the view being entered. No-op for
  // views outside NAMES beyond flushing whatever was previously running.
  function enter(view) {
    flush();
    if (!NAMES[view]) return;
    const s = read();
    s.launches = s.launches || {};
    s.launches[view] = (s.launches[view] || 0) + 1;
    if (!s.since) s.since = Date.now();
    write(s);
    activeView = view;
    enteredAt = Date.now();
  }

  // Backgrounding the tab pauses the clock rather than losing it — resume
  // picks the same view back up without counting a second launch.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      const resume = activeView;
      flush();
      document._telemetryResume = resume;
    } else if (document._telemetryResume) {
      activeView = document._telemetryResume;
      enteredAt = Date.now();
      document._telemetryResume = null;
    }
  });
  window.addEventListener('pagehide', flush);

  function fmtMinutes(m) {
    const total = Math.round(m);
    if (total < 60) return total + 'm';
    return Math.floor(total / 60) + 'h ' + (total % 60) + 'm';
  }

  function summary() {
    const s = read();
    const minutes = s.minutes || {}, launches = s.launches || {};
    const totalMinutes = Object.values(minutes).reduce((a, b) => a + b, 0);
    const totalLaunches = Object.values(launches).reduce((a, b) => a + b, 0);
    const gamesPlayed = Object.keys(launches).filter(k => launches[k] > 0).length;
    let favorite = null, favMinutes = 0;
    for (const [k, v] of Object.entries(minutes)) {
      if (v > favMinutes) { favMinutes = v; favorite = k; }
    }
    return {
      totalMinutes, totalLaunches, gamesPlayed,
      favorite: favorite ? (NAMES[favorite] || favorite) : null,
      since: s.since || null,
    };
  }

  function renderInto(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const sum = summary();
    if (sum.totalLaunches === 0) {
      el.innerHTML = `<div class="ins-head">&#128202; YOUR ARCADE YEAR</div>` +
        `<div class="ins-empty">Play a game to start tracking.</div>`;
      return;
    }
    const sinceStr = sum.since ? new Date(sum.since).toLocaleDateString() : '—';
    const tiles = [
      { v: fmtMinutes(sum.totalMinutes), l: 'time played' },
      { v: sum.totalLaunches.toLocaleString(), l: 'sessions' },
      { v: sum.gamesPlayed, l: 'games tried' },
      { v: sum.favorite || '—', l: 'favorite' },
    ];
    el.innerHTML = `<div class="ins-head">&#128202; YOUR ARCADE YEAR <span class="ins-since">since ${sinceStr}</span></div>` +
      `<div class="ins-grid">` +
      tiles.map(t => `<div class="ins-tile"><div class="ins-tile-value">${t.v}</div><div class="ins-tile-label">${t.l}</div></div>`).join('') +
      `</div>`;
  }

  return { enter, flush, summary, renderInto };
})();
