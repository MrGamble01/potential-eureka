/* ============================================
   DAILY CHALLENGE (IDEA-SITE-3)
   One shared seed per day, per game: everyone
   who plays today's challenge gets the same
   Tetris bags, 2048 spawns, Snake food + walls,
   Maze layout and Asteroids rocks.

   Only layout-determining call sites route
   through Daily.rand(game) — cosmetic effects
   (particles, UFO timing) stay on Math.random,
   because their consumption count depends on
   fps/timing and would silently desync the
   layout stream between two "identical" runs.
   ============================================ */

const Daily = (() => {
  // Games that support a seeded run, in banner order.
  // `id` keys the seed/best-key streams; `hash` is the hub router's view
  // name (they differ for 2048, whose view is literally '#2048').
  const GAMES = [
    { id: 'snake',     hash: 'snake',     name: 'Snake' },
    { id: 'tetris',    hash: 'tetris',    name: 'Tetris' },
    { id: 'game2048',  hash: '2048',      name: '2048' },
    { id: 'maze',      hash: 'maze',      name: 'Maze' },
    { id: 'asteroids', hash: 'asteroids', name: 'Asteroids' },
  ];

  // mulberry32: tiny, solid-enough 32-bit PRNG. Seeded from a string
  // hash of "<game>:<YYYY-MM-DD>", so each game gets its own daily
  // stream and tomorrow is a fresh world.
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
      h = h << 13 | h >>> 19;
    }
    return h >>> 0;
  }

  let armed = null;   // game the player chose from the banner, sticky for the view
  let active = null;  // game currently mid-seeded-run
  let rng = null;

  const bestKey = game => `arcade-daily-${game}-${Utils.todayKey()}`;

  // Arm stays set across restarts inside the same view: every retry
  // re-seeds the SAME daily stream from the top, so a second attempt
  // faces exactly the same world — that's what makes it a fair score.
  function arm(game) { armed = game; }
  function disarm(game) {
    if (armed === game) armed = null;
    if (active === game) { active = null; rng = null; }
  }

  // Called from each game's start(). Returns true when this run is a
  // seeded daily run (so the game can badge itself).
  function begin(game) {
    if (armed !== game) {
      if (active === game) { active = null; rng = null; }
      return false;
    }
    active = game;
    rng = mulberry32(hashStr(game + ':' + Utils.todayKey()));
    return true;
  }

  function rand(game) {
    return (active === game && rng) ? rng() : Math.random();
  }

  const isActive = game => active === game;

  // Record a finished daily run; returns a line for the game-over overlay.
  function result(game, score) {
    const prev = Utils.highScore.load(bestKey(game));
    const best = Utils.highScore.save(bestKey(game), score, prev);
    refreshBanner();
    return score > prev
      ? `📅 Daily: ${score} — new best for today!`
      : `📅 Daily: ${score} · today's best ${best}`;
  }

  // ── Hub banner ──
  function refreshBanner() {
    const list = document.getElementById('daily-games');
    if (!list) return;
    list.innerHTML = GAMES.map(g => {
      const best = Utils.highScore.load(bestKey(g.id));
      return `<button class="daily-chip" data-game="${g.id}" data-hash="${g.hash}">${g.name}` +
        (best > 0 ? `<span class="daily-best">★ ${best}</span>` : '') +
        `</button>`;
    }).join('');
    const dateEl = document.getElementById('daily-date');
    if (dateEl) dateEl.textContent = Utils.todayKey();
  }

  function init() {
    // Yesterday's dated best keys are garbage now — sweep them so the
    // registry doesn't accrete one key per game per day forever.
    const today = Utils.todayKey();
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('arcade-daily-') && !k.endsWith(today)) {
        localStorage.removeItem(k);
      }
    }
    const list = document.getElementById('daily-games');
    if (list) {
      list.addEventListener('click', e => {
        const btn = e.target.closest('.daily-chip');
        if (!btn) return;
        arm(btn.dataset.game);
        location.hash = '#' + btn.dataset.hash;
      });
    }
    refreshBanner();
  }

  return { init, arm, disarm, begin, rand, isActive, result, refreshBanner };
})();
