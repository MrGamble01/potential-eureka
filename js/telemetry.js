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
    'stacker', 'crateescape', 'vectordefense', 'wordcascade', 'memorymatrix']);
  const NAMES = {
    snake: 'Snake', tetris: 'Tetris', breakout: 'Neon Breaker',
    asteroids: 'Vector Storm', 2048: '2048', minesweeper: 'Minefield',
    connect4: 'Drop Four', word5: 'Word Five', maze: 'Maze Runner',
    life: 'Game of Life', lightcycles: 'Light Cycles', pong: 'Pong++',
    stacker: 'Stacker', crateescape: 'Crate Escape', vectordefense: 'Vector Defense', wordcascade: 'Word Cascade', memorymatrix: 'Memory Matrix',
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

  // ── Flagship Saga (Depth 30) ────────────────────────────────
  // One card per flagship save found in this browser: lifetime stats
  // read straight from each game's own localStorage key. Read-only —
  // a flagship never played contributes nothing, and with no saves at
  // all the whole block renders ''.
  function readSave(key) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || 'null');
      return v && typeof v === 'object' ? v : null;
    } catch { return null; }
  }
  const nz = v => (typeof v === 'number' && isFinite(v) && v > 0) ? v : 0;
  const fmtBig = n => n >= 1e6 ? +(n / 1e6).toFixed(1) + 'M'
    : n >= 1000 ? +(n / 1000).toFixed(1) + 'k' : String(Math.round(n));

  function sagaCards() {
    const cards = [];
    const chip = (val, label) => ({ val, label });

    const aow = readSave('aow-best-run');
    if (aow) {
      let relics = 0;
      try { relics = Math.max(0, parseInt(localStorage.getItem('aow-relics') || '0', 10) || 0); } catch {}
      const c = [chip(nz(aow.waves) + ' waves', 'best run'), chip(fmtBig(nz(aow.kills)), 'kills')];
      if (relics) c.push(chip(String(relics), 'relics banked'));
      cards.push({ emoji: '⚔️', name: 'Age of War', chips: c });
    }

    const tyc = readSave('startup-tycoon-v7');
    if (tyc) {
      const c = [chip('$' + fmtBig(nz(tyc.lifetimeCash)), 'earned')];
      const launches = tyc.launches ? nz(tyc.launches.n) : 0;
      if (launches) c.push(chip(String(launches), 'launches shipped'));
      const fought = tyc.poach ? nz(tyc.poach.fought) : 0;
      if (fought) c.push(chip(String(fought), 'poaches fought off'));
      const retreats = tyc.retreats ? nz(tyc.retreats.held) : 0;
      if (retreats) c.push(chip(String(retreats), retreats === 1 ? 'retreat held' : 'retreats held'));
      if (nz(tyc.prestigeLevel)) c.push(chip('S' + (tyc.prestigeLevel + 1), 'season'));
      cards.push({ emoji: '🚀', name: 'Startup Tycoon', chips: c });
    }

    const lab = readSave('drug-lab-v1');
    if (lab) {
      const c = [chip('$' + fmtBig(nz(lab.totalEarned)), 'earned')];
      if (nz(lab.contractsDone)) c.push(chip(String(lab.contractsDone), 'contracts filled'));
      if (nz(lab.rivalRunIns)) c.push(chip(String(lab.rivalRunIns), 'rival run-ins'));
      if (Array.isArray(lab.ownedRooms) && lab.ownedRooms.length > 1)
        c.push(chip(String(lab.ownedRooms.length), 'rooms owned'));
      cards.push({ emoji: '🌿', name: 'Grow Op', chips: c });
    }

    const hv = readSave('homeless_village_v1');
    if (hv) {
      const c = [chip(String(nz(hv.days)), 'days survived')];
      if (nz(hv.soupNights)) c.push(chip(String(hv.soupNights), 'soup nights'));
      if (nz(hv.rep)) c.push(chip(hv.rep + '/100', 'street rep'));
      if (nz(hv.mural) >= 4) c.push(chip('🎨', 'mural finished'));
      cards.push({ emoji: '⛺', name: 'Homeless Village', chips: c });
    }

    const hva = readSave('hearthvale-v1');
    if (hva) {
      const c = [chip(String(nz(hva.day)), 'days old')];
      if (nz(hva.peakPop)) c.push(chip(String(hva.peakPop), 'peak villagers'));
      if (Array.isArray(hva.chronicle) && hva.chronicle.length)
        c.push(chip(String(hva.chronicle.length), 'chronicle pages'));
      if (nz(hva.raidsRepelled)) c.push(chip(String(hva.raidsRepelled), 'raids repelled'));
      if (nz(hva.caravansReturned)) c.push(chip(String(hva.caravansReturned), 'caravans home'));
      if (nz(hva.bellSaves)) c.push(chip(String(hva.bellSaves), 'bell saves'));
      cards.push({ emoji: '🏡', name: 'Hearthvale', chips: c });
    }

    const vox = readSave('voxel-garden-v1');
    if (vox && vox.state && typeof vox.state === 'object') {
      const vs = vox.state;
      const c = [chip(fmtBig(nz(vs.totalEarned)), 'coins earned')];
      if (nz(vs.level)) c.push(chip('Lv ' + vs.level, 'gardener'));
      if (nz(vs.flotsamOpened)) c.push(chip(String(vs.flotsamOpened), 'flotsam cracked'));
      if (nz(vs.wishes)) c.push(chip(String(vs.wishes), vs.wishes === 1 ? 'wish granted' : 'wishes granted'));
      if (nz(vs.catGifts)) c.push(chip(String(vs.catGifts), 'cat gifts'));
      cards.push({ emoji: '🏝️', name: 'Voxel Isle', chips: c });
    }
    return cards;
  }

  function sagaHtml() {
    const cards = sagaCards();
    if (!cards.length) return '';
    return `<div class="saga">` +
      `<div class="ins-head saga-head">🏰 FLAGSHIP SAGA</div>` +
      `<div class="saga-cards">` +
      cards.map(c =>
        `<div class="saga-card">` +
          `<span class="saga-game">${c.emoji} ${c.name}</span>` +
          c.chips.map(ch => `<span class="saga-chip"><strong>${ch.val}</strong> ${ch.label}</span>`).join('') +
        `</div>`).join('') +
      `</div>` +
      `<div class="ins-note">Read from each flagship's own save in this browser. Play one to add its card.</div>` +
    `</div>`;
  }

  function renderInto(id) {
    const el = document.getElementById(id);
    if (!el) return;
    flush();
    const s = load();
    const games = Object.keys(s.seconds).sort((a, b) => s.seconds[b] - s.seconds[a]);
    const totalSecs = games.reduce((t, g) => t + s.seconds[g], 0);
    const totalLaunches = Object.values(s.launches).reduce((t, n) => t + n, 0);
    let arcade = '';
    if (totalLaunches) {
      const fav = games[0];
      const maxSecs = fav ? s.seconds[fav] : 1;
      const dayKeys = Object.keys(s.days);
      const busiest = dayKeys.sort((a, b) => s.days[b] - s.days[a])[0];
      const st = streak(s.days);
      arcade =
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
    el.innerHTML = arcade + sagaHtml();
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
