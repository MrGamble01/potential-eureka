/* ============================================
   UTILS — Shared helpers across all modules
   ============================================ */

const Utils = {
  escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  },

  delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  },

  // localStorage with JSON
  store: {
    get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
    set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },
    getRaw(key) { return localStorage.getItem(key) || ''; },
    setRaw(key, val) { localStorage.setItem(key, val); },
    remove(key) { localStorage.removeItem(key); },
  },

  // Date helpers
  dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },
  todayKey() { return Utils.dateKey(new Date()); },
  formatTime(d) {
    const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
    return `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
  },
  lastNDays(n) {
    const days = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      days.push(d);
    }
    return days;
  },

  // Modal helpers
  openModal(id) { const m = document.getElementById(id); if (m) m.style.display = 'flex'; },
  closeModal(id) { const m = document.getElementById(id); if (m) m.style.display = 'none'; },

  // ---- Arcade game plumbing ----
  // Shared by the canvas games (snake/tetris/breakout/asteroids/2048), which
  // each used to hand-roll their own copy of these four idioms.

  // Wraps a document-level key handler (keydown/keyup) so it only runs while
  // the given view element has the 'active' class — every game binds its
  // handler once at init() and never tears it down, so without this guard a
  // hidden game would still react to key presses on other views.
  whenViewActive(viewId, handler) {
    return function (e) {
      const view = document.getElementById(viewId);
      if (!view || !view.classList.contains('active')) return;
      return handler(e);
    };
  },

  // requestAnimationFrame loop with the frame-delta clamp used by every rAF
  // game (dt = ms-since-last-frame / 16.667, clamped to 2.2 so a tabbed-out
  // browser resuming doesn't apply a huge catch-up step). `tick(dt)` is
  // called every frame — callers keep their own running/gameOver gating and
  // draw() call inside it, exactly like the loop() each game used to define.
  gameLoop(tick) {
    let raf = null, lastT = 0;
    function frame() {
      raf = requestAnimationFrame(frame);
      const now = performance.now();
      const dt = Math.min((now - lastT) / 16.667, 2.2);
      lastT = now;
      tick(dt);
    }
    return {
      start() {
        cancelAnimationFrame(raf);
        lastT = performance.now();
        frame();
      },
      stop() {
        cancelAnimationFrame(raf);
        raf = null;
      },
    };
  },

  // localStorage high-score persistence idiom, unified across the 3 flavors
  // (raw localStorage, Utils.store, and `|| 0` NaN-guards) games used before.
  highScore: {
    // Load the stored best for `key`; 0 on missing/garbage data.
    load(key) {
      const v = parseInt(localStorage.getItem(key) || '0', 10);
      return isNaN(v) ? 0 : v;
    },
    // If `score` beats `current`, persist and return the new best;
    // otherwise return `current` unchanged. Mirrors the repeated
    // `if (score > high) { high = score; localStorage.setItem(...) }`.
    save(key, score, current) {
      if (score > current) {
        localStorage.setItem(key, String(score));
        return score;
      }
      return current;
    },
  },

  // Show a game's "GAME OVER" overlay — every game used the same
  // `<h2>GAME OVER</h2>` + stat <p> lines + dim hint <p> markup.
  showGameOver(overlayId, { lines = [], hint = '' } = {}) {
    const overlay = document.getElementById(overlayId);
    if (!overlay) return;
    overlay.style.display = 'flex';
    const linesHtml = lines.map(l => `<p>${l}</p>`).join('');
    const hintHtml = hint ? `<p style="font-size:12px;color:var(--text-dim)">${hint}</p>` : '';
    overlay.innerHTML = `<h2>GAME OVER</h2>${linesHtml}${hintHtml}`;
  },

  // typeof-guarded SFX.play — every game repeated
  // `if (typeof SFX !== 'undefined') SFX.play(name)` at each call site.
  sfx(name) {
    if (typeof SFX !== 'undefined') SFX.play(name);
  },
};
