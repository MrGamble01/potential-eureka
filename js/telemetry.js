/* ============================================
   INSIGHTS (IDEA-SITE-8) — local-only telemetry.
   Records which hub games get launched and for
   how long, entirely in this browser's
   localStorage ('eureka-stats'). Feeds the
   "Your Arcade" panel in the Hall of Fame.
   No network. Nothing leaves the machine.
   ============================================ */

const Telemetry = (() => {
  const KEY = 'eureka-stats';
  // Hub game views worth counting (utility views are not "plays").
  const GAME_VIEWS = new Set(['snake', 'tetris', 'breakout', 'asteroids', '2048',
    'minesweeper', 'connect4', 'word5', 'maze', 'life', 'lightcycles', 'pong',
    'stacker', 'vectordefense', 'wordcascade', 'memorymatrix']);
  const NAMES = {
    snake: 'Snake', tetris: 'Tetris', breakout: 'Neon Breaker',
    asteroids: 'Vector Storm', 2048: '2048', minesweeper: 'Minefield',
    connect4: 'Drop Four', word5: 'Word Five', maze: 'Maze Runner',
    life: 'Game of Life', lightcycles: 'Light Cycles', pong: 'Pong++',
    stacker: 'Stacker', vectordefense: 'Vector Defense', wordcascade: 'Word Cascade', memorymatrix: 'Memory Matrix',
  };

  let current = null;    // { view, startedAt }

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && typeof s === 'object') return s;
    } catch {}
    return { firstSeen: Date.now(), launches: {}, seconds: {}, days: {} };
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }

  function enter(view) {
    flush();
    if (!GAME_VIEWS.has(view)) { current = null; return; }
    const s = load();
    s.launches[view] = (s.launches[view] || 0) + 1;
    s.lastPlayed = view;
    save(s);
    current = { view, startedAt: Date.now() };
  }

  // Accrue the open session's time. Called on view switches, tab-hides
  // and unloads, so a long session in one game still lands in the book.
  function flush() {
    if (!current) return;
    const secs = Math.round((Date.now() - current.startedAt) / 1000);
    current.startedAt = Date.now();
    if (secs <= 0 || secs > 6 * 3600) return;   // clock jumped — drop it
    const s = load();
    s.seconds[current.view] = (s.seconds[current.view] || 0) + secs;
    const day = Utils.todayKey();
    s.days[day] = (s.days[day] || 0) + secs;
    save(s);
  }

  const fmtMins = secs => {
    if (secs < 60) return secs + 's';
    const m = Math.round(secs / 60);
    return m < 60 ? m + 'm' : (m / 60).toFixed(1) + 'h';
  };

  // Consecutive-days-played streak ending today or yesterday.
  function streak(days) {
    let n = 0;
    const d = new Date();
    if (!days[Utils.dateKey(d)]) d.setDate(d.getDate() - 1); // today not played yet
    while (days[Utils.dateKey(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  function renderInto(id) {
    const el = document.getElementById(id);
    if (!el) return;
    flush();
    const s = load();
    const games = Object.keys(s.seconds).sort((a, b) => s.seconds[b] - s.seconds[a]);
    const totalSecs = games.reduce((t, g) => t + s.seconds[g], 0);
    const totalLaunches = Object.values(s.launches).reduce((t, n) => t + n, 0);
    if (!totalLaunches) {
      el.innerHTML = '';
      return;
    }
    const fav = games[0];
    const maxSecs = fav ? s.seconds[fav] : 1;
    const dayKeys = Object.keys(s.days);
    const busiest = dayKeys.sort((a, b) => s.days[b] - s.days[a])[0];
    const st = streak(s.days);
    el.innerHTML =
      `<div class="ins-head">📊 YOUR ARCADE</div>` +
      `<div class="ins-stats">` +
        `<span><strong>${totalLaunches}</strong> plays</span>` +
        `<span><strong>${fmtMins(totalSecs)}</strong> played</span>` +
        (fav ? `<span>favourite <strong>${NAMES[fav] || fav}</strong></span>` : '') +
        (st > 1 ? `<span><strong>${st}</strong>-day streak</span>` : '') +
        (busiest ? `<span>busiest day <strong>${busiest}</strong> (${fmtMins(s.days[busiest])})</span>` : '') +
      `</div>` +
      `<div class="ins-bars">` +
      games.slice(0, 8).map(g =>
        `<div class="ins-row">` +
          `<span class="ins-name">${NAMES[g] || g}</span>` +
          `<span class="ins-track"><span class="ins-fill" style="width:${Math.max(3, Math.round(s.seconds[g] / maxSecs * 100))}%"></span></span>` +
          `<span class="ins-val">${fmtMins(s.seconds[g])} · ${s.launches[g] || 0}×</span>` +
        `</div>`).join('') +
      `</div>` +
      `<div class="ins-note">Stored only in this browser. Never sent anywhere.</div>`;
  }

  // "Jump back in" (P4): quick-resume chips on the hub — the last game
  // you played plus your top games by time. Hidden until there's history.
  function renderResume(id, go) {
    const el = document.getElementById(id);
    if (!el) return;
    const s = load();
    const games = Object.keys(s.seconds).sort((a, b) => s.seconds[b] - s.seconds[a]);
    if (!games.length) { el.innerHTML = ''; el.hidden = true; return; }
    const last = s.lastPlayed && games.includes(s.lastPlayed) ? s.lastPlayed : null;
    const picks = [];
    if (last) picks.push({ id: last, tag: 'last played' });
    for (const g of games) {
      if (picks.length >= 4) break;
      if (!picks.some(p => p.id === g)) picks.push({ id: g, tag: fmtMins(s.seconds[g]) });
    }
    el.hidden = false;
    el.innerHTML = `<span class="resume-label">⏵ JUMP BACK IN</span>` +
      picks.map(p =>
        `<button class="resume-chip" data-view="${p.id}">${NAMES[p.id] || p.id}` +
        `<span class="resume-tag">${p.tag}</span></button>`).join('');
    el.querySelectorAll('.resume-chip').forEach(btn => {
      btn.addEventListener('click', () => go(btn.dataset.view));
    });
  }

  function init() {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    window.addEventListener('pagehide', flush);
  }

  return { init, enter, flush, renderInto, renderResume };
})();
