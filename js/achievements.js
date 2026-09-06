/* ============================================
   ACHIEVEMENTS (IDEA-SITE-4) — a declarative
   table checked against the same localStorage
   keys the Hall of Fame already reads. No
   per-game hooks: the hub re-checks on boot and
   on every view switch (you can only finish a
   run by leaving a game or dying into its
   overlay, and either way you navigate soon
   after). Unlocks persist with a timestamp and
   announce themselves with a toast pill.
   ============================================ */

const Achievements = (() => {
  const STORE_KEY = 'arcade-achievements';
  const num = k => { const v = parseInt(localStorage.getItem(k) || '0', 10); return isNaN(v) ? 0 : v; };

  const SCORE_KEYS = ['snake-high', 'tetris-high', 'breakout-high', 'asteroids-high',
    'g2048-best', 'mines-best-beginner', 'connect4-streak', 'word5-streak',
    'cycles-streak', 'pong-streak', 'matrix-best',
    'maze-best', 'stacker-best', 'vector-best', 'cascade-best', 'crate-best'];
  const played = () => SCORE_KEYS.filter(k => num(k) > 0).length;

  const DEFS = [
    { id: 'first-light',  icon: '🕹️', name: 'First Light',
      desc: 'Set your first score in any arcade game', test: () => played() >= 1 },
    { id: 'regular',      icon: '🎟️', name: 'Regular',
      desc: 'Put a score on the board in 5 different games', test: () => played() >= 5 },
    { id: 'completionist', icon: '🏛️', name: 'Completionist',
      desc: 'Score in every arcade game on the Hall of Fame board', test: () => played() >= SCORE_KEYS.length },
    { id: 'snake-100',    icon: '🐍', name: 'Garden Menace',
      desc: 'Score 100+ in Snake', test: () => num('snake-high') >= 100 },
    { id: 'tetris-5k',    icon: '🧱', name: 'Line Cook',
      desc: 'Score 5,000+ in Tetris', test: () => num('tetris-high') >= 5000 },
    { id: 'breakout-3k',  icon: '🧨', name: 'Wall Street',
      desc: 'Score 3,000+ in Neon Breaker', test: () => num('breakout-high') >= 3000 },
    { id: 'asteroids-5k', icon: '☄️', name: 'Rock Bottom',
      desc: 'Score 5,000+ in Vector Storm', test: () => num('asteroids-high') >= 5000 },
    { id: 'g2048-2048',   icon: '🔢', name: 'Power of Two',
      desc: 'Score 2,048+ in 2048 (fitting)', test: () => num('g2048-best') >= 2048 },
    { id: 'mines-60',     icon: '⏱️', name: 'Minute to Win It',
      desc: 'Clear a beginner Minefield in under 60s', test: () => { const v = num('mines-best-beginner'); return v > 0 && v < 60; } },
    { id: 'c4-streak3',   icon: '🔴', name: 'Connect Fourever',
      desc: '3-win streak in Drop Four', test: () => num('connect4-streak') >= 3 },
    { id: 'word5-5',      icon: '📗', name: 'Wordsmith',
      desc: '5-win streak in Word Five', test: () => num('word5-streak') >= 5 },
    { id: 'cycles-5',     icon: '🏍️', name: 'Grid Runner',
      desc: '5-win streak in Light Cycles', test: () => num('cycles-streak') >= 5 },
    { id: 'pong-3',       icon: '🏓', name: 'Table Manners',
      desc: '3-match streak in Pong++', test: () => num('pong-streak') >= 3 },
    { id: 'matrix-8',     icon: '🧠', name: 'Photographic',
      desc: 'Reach round 8 in Memory Matrix', test: () => num('matrix-best') >= 8 },
    { id: 'stacker-12',   icon: '🏗️', name: 'High Rise',
      desc: 'Stack 12+ floors in Stacker', test: () => num('stacker-best') >= 12 },
    { id: 'vector-8',     icon: '🛰️', name: 'Perimeter Held',
      desc: 'Reach wave 8 in Vector Defense', test: () => num('vector-best') >= 8 },
    { id: 'cascade-300',  icon: '🔤', name: 'Rainmaker',
      desc: 'Score 300+ in Word Cascade', test: () => num('cascade-best') >= 300 },
    { id: 'crate-8',      icon: '📦', name: 'Warehouse Manager',
      desc: 'Solve 8 Crate Escape puzzles', test: () => num('crate-best') >= 8 },
    { id: 'maze-gold',    icon: '🥇', name: 'Pathfinder',
      desc: 'Beat par in the Gem Labyrinth for a gold medal', test: () => num('maze-golds') >= 1 },
    { id: 'daily-run',    icon: '📅', name: 'Creature of Habit',
      desc: "Set a score on today's Daily Challenge",
      test: () => {
        const today = Utils.todayKey();
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('arcade-daily-') && k.endsWith(today)) return true;
        }
        return false;
      } },
    { id: 'rivalry',      icon: '⚔️', name: 'It’s Personal',
      desc: 'Add a rival to your Hall of Fame',
      test: () => { try { return Object.keys(JSON.parse(localStorage.getItem('arcade-rivals') || '{}')).length > 0; } catch { return false; } } },
  ];

  // A stored `null` parses cleanly and then Object.keys(null) throws in
  // renderInto — the hub's front page, from one bad localStorage write.
  // The try/catch caught the parse; nothing caught the shape.
  function unlocked() {
    let raw;
    try { raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch { return {}; }
    return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  }

  // Re-evaluate the table; toast anything newly true. Never re-locks:
  // an unlock is a memory, not a live condition (streaks reset, rivals
  // get removed — the trophy stays).
  function check() {
    const have = unlocked();
    let changed = false;
    for (const d of DEFS) {
      if (have[d.id]) continue;
      let hit = false;
      try { hit = !!d.test(); } catch {}
      if (hit) {
        have[d.id] = Date.now();
        changed = true;
        toast(d);
      }
    }
    if (changed) localStorage.setItem(STORE_KEY, JSON.stringify(have));
    return changed;
  }

  let toastQueue = [], toastActive = false;
  function toast(def) {
    toastQueue.push(def);
    if (!toastActive) nextToast();
  }
  function nextToast() {
    const def = toastQueue.shift();
    if (!def) { toastActive = false; return; }
    toastActive = true;
    const el = document.createElement('div');
    el.className = 'ach-toast';
    el.setAttribute('role', 'status');
    el.innerHTML = `<span class="ach-toast-icon">${def.icon}</span>` +
      `<span><strong>Achievement unlocked</strong><br>${def.name}</span>`;
    document.body.appendChild(el);
    if (typeof SFX !== 'undefined' && SFX.play) SFX.play('bonus');
    setTimeout(() => { el.classList.add('ach-toast-out'); }, 2600);
    setTimeout(() => { el.remove(); nextToast(); }, 3300);
  }

  // Render the trophy case into a container (the Hall of Fame calls this).
  function renderInto(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const have = unlocked();
    const n = Object.keys(have).filter(k => DEFS.some(d => d.id === k)).length;
    el.innerHTML =
      `<div class="ach-head">🏅 ACHIEVEMENTS <span class="ach-count">${n} / ${DEFS.length}</span></div>` +
      `<div class="ach-grid">` +
      DEFS.map(d => {
        const at = have[d.id];
        return `<div class="ach-card${at ? ' ach-got' : ''}" title="${d.desc}${at ? ' — unlocked ' + new Date(at).toLocaleDateString() : ''}">` +
          `<span class="ach-icon">${at ? d.icon : '🔒'}</span>` +
          `<span class="ach-name">${d.name}</span>` +
          `<span class="ach-desc">${d.desc}</span>` +
        `</div>`;
      }).join('') +
      `</div>`;
  }

  return { check, renderInto, unlocked, DEFS };
})();
