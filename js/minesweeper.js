/* ============================================
   MINEFIELD — a modern Minesweeper
   First-click-safe, chording, 3 difficulties,
   per-difficulty best times, mobile long-press.
   ============================================ */

const MinesweeperGame = (() => {
  const DIFFS = {
    beginner:     { cols: 9,  rows: 9,  mines: 10, cell: 32, label: 'Beginner' },
    intermediate: { cols: 16, rows: 16, mines: 40, cell: 26, label: 'Intermediate' },
    expert:       { cols: 30, rows: 16, mines: 99, cell: 22, label: 'Expert' },
  };
  const NUM_COLORS = [null, '#58A6FF', '#3FB950', '#F85149', '#BC8CFF', '#F0883E', '#22d3ee', '#E6EDF3', '#8B949E'];

  let canvas, ctx;
  let diff = 'beginner';
  let cols, rows, mineCount, CELL;
  let cells;              // flat array of { mine, revealed, flagged, count, pop }
  let state;             // 'ready' | 'playing' | 'won' | 'lost'
  let placed;            // mines placed yet (first-click-safe)
  let flags, revealedCount, elapsed, flagMode = false;
  let shake = 0, flash = 0, confetti = [];
  let rafId = null;
  let lastFace = '🙂';

  const sfx = Utils.sfx;
  const viewActive = () => {
    const v = document.getElementById('view-minesweeper');
    return v && v.classList.contains('active');
  };
  const idx = (r, c) => r * cols + c;

  function init() {
    canvas = document.getElementById('mines-canvas');
    if (!canvas) return;
    diff = localStorage.getItem('mines-diff') || 'beginner';
    if (!DIFFS[diff]) diff = 'beginner';
    setupCanvas();
    newGame();

    canvas.addEventListener('mousedown', onMouse);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    bindTouch();

    startLoop();
    syncControls();
  }

  function setupCanvas() {
    const d = DIFFS[diff];
    cols = d.cols; rows = d.rows; mineCount = d.mines; CELL = d.cell;
    const w = cols * CELL, h = rows * CELL;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function newGame() {
    cells = Array.from({ length: cols * rows }, () => ({ mine: false, revealed: false, flagged: false, count: 0, pop: 0 }));
    state = 'ready';
    placed = false;
    flags = 0; revealedCount = 0; elapsed = 0;
    shake = 0; flash = 0; confetti = [];
    lastFace = '🙂';
    updateHud();
  }

  function setDifficulty(d) {
    if (!DIFFS[d]) return;
    diff = d;
    localStorage.setItem('mines-diff', d);
    setupCanvas();
    newGame();
    syncControls();
  }

  function toggleFlagMode() {
    flagMode = !flagMode;
    const btn = document.getElementById('mines-flag-btn');
    if (btn) {
      btn.textContent = flagMode ? '🚩 Flag mode: ON' : '🚩 Flag mode: OFF';
      btn.classList.toggle('primary', flagMode);
    }
  }

  // ---- mine placement (first-click-safe) ----
  function placeMines(safeR, safeC) {
    // Exclude the first-clicked cell AND its neighbours, so the first reveal
    // always opens a cascade rather than a lone number.
    const safe = new Set();
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const nr = safeR + dr, nc = safeC + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) safe.add(idx(nr, nc));
      }
    const pool = [];
    for (let i = 0; i < cols * rows; i++) if (!safe.has(i)) pool.push(i);
    // Fisher–Yates partial shuffle for the mine positions.
    for (let i = 0; i < mineCount && pool.length; i++) {
      const j = i + Math.floor(Math.random() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
      cells[pool[i]].mine = true;
    }
    // Precompute neighbour counts.
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        if (cells[idx(r, c)].mine) continue;
        let n = 0;
        forNeighbors(r, c, (nr, nc) => { if (cells[idx(nr, nc)].mine) n++; });
        cells[idx(r, c)].count = n;
      }
    placed = true;
  }

  function forNeighbors(r, c, fn) {
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) fn(nr, nc);
      }
  }

  // ---- input ----
  function cellAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const sx = (cols * CELL) / rect.width, sy = (rows * CELL) / rect.height;
    const c = Math.floor((clientX - rect.left) * sx / CELL);
    const r = Math.floor((clientY - rect.top) * sy / CELL);
    if (r < 0 || r >= rows || c < 0 || c >= cols) return null;
    return { r, c };
  }

  function onMouse(e) {
    if (state === 'won' || state === 'lost') return;
    const at = cellAt(e.clientX, e.clientY);
    if (!at) return;
    const right = e.button === 2 || (flagMode && e.button === 0);
    if (right) flag(at.r, at.c);
    else primary(at.r, at.c);
    e.preventDefault();
  }

  function bindTouch() {
    let pressTimer = null, longFired = false, startAt = null;
    canvas.addEventListener('touchstart', e => {
      if (state === 'won' || state === 'lost') return;
      const t = e.touches[0];
      startAt = cellAt(t.clientX, t.clientY);
      longFired = false;
      pressTimer = setTimeout(() => {
        longFired = true;
        if (startAt) { flag(startAt.r, startAt.c); if (navigator.vibrate) navigator.vibrate(15); }
      }, 380);
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', e => {
      clearTimeout(pressTimer);
      if (longFired || !startAt) return;
      if (flagMode) flag(startAt.r, startAt.c);
      else primary(startAt.r, startAt.c);
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', () => { clearTimeout(pressTimer); });
  }

  // Primary action: reveal, or chord on an already-revealed number.
  function primary(r, c) {
    const cell = cells[idx(r, c)];
    if (cell.flagged) return;
    if (cell.revealed) { chord(r, c); return; }
    if (!placed) { placeMines(r, c); state = 'playing'; }
    reveal(r, c);
    checkWin();
  }

  function reveal(r, c) {
    const cell = cells[idx(r, c)];
    if (cell.revealed || cell.flagged) return;
    cell.revealed = true;
    cell.pop = 1;
    revealedCount++;
    if (cell.mine) { lose(r, c); return; }
    sfx('move');
    if (cell.count === 0) {
      // Flood-fill the connected empty region.
      forNeighbors(r, c, (nr, nc) => {
        if (!cells[idx(nr, nc)].revealed) reveal(nr, nc);
      });
    }
  }

  // Chord: click a satisfied number to reveal its unflagged neighbours.
  function chord(r, c) {
    const cell = cells[idx(r, c)];
    if (!cell.revealed || cell.count === 0) return;
    let flagged = 0;
    forNeighbors(r, c, (nr, nc) => { if (cells[idx(nr, nc)].flagged) flagged++; });
    if (flagged !== cell.count) return;
    forNeighbors(r, c, (nr, nc) => {
      const n = cells[idx(nr, nc)];
      if (!n.revealed && !n.flagged) reveal(nr, nc);
    });
    checkWin();
  }

  function flag(r, c) {
    const cell = cells[idx(r, c)];
    if (cell.revealed) return;
    if (!placed) return;   // no flagging before the board exists
    cell.flagged = !cell.flagged;
    cell.pop = 1;
    flags += cell.flagged ? 1 : -1;
    sfx('rotate');
    updateHud();
  }

  function lose(mr, mc) {
    state = 'lost';
    lastFace = '💥';
    shake = 14; flash = 30;
    sfx('die');
    if (window.Effects) Effects.shakeCanvas(canvas, 8, 350);
    // Reveal all mines.
    for (const cell of cells) if (cell.mine) cell.revealed = true;
    cells[idx(mr, mc)].hitMine = true;
    updateHud();
  }

  function checkWin() {
    if (state !== 'playing') return;
    // Win when every non-mine cell is revealed.
    let hidden = 0;
    for (const cell of cells) if (!cell.mine && !cell.revealed) hidden++;
    if (hidden > 0) return;
    state = 'won';
    lastFace = '😎';
    sfx('bonus');
    // Auto-flag remaining mines for a clean finish.
    for (const cell of cells) if (cell.mine && !cell.flagged) { cell.flagged = true; flags++; }
    burstConfetti();
    saveBest();
    updateHud();
  }

  function saveBest() {
    const key = 'mines-best-' + diff;
    const secs = Math.floor(elapsed / 1000);
    let prev = Infinity;
    try { const v = localStorage.getItem(key); if (v != null) prev = +v; } catch (e) {}
    if (secs < prev) {
      try { localStorage.setItem(key, String(secs)); } catch (e) {}
    }
  }
  function bestTime() {
    try { const v = localStorage.getItem('mines-best-' + diff); return v == null ? null : +v; } catch (e) { return null; }
  }

  function burstConfetti() {
    const w = cols * CELL;
    const colors = ['#3FB950', '#58A6FF', '#F7C948', '#F778BA', '#BC8CFF'];
    for (let i = 0; i < 90; i++) {
      confetti.push({
        x: Math.random() * w, y: -10 - Math.random() * 40,
        vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 3,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 90 + Math.random() * 60,
      });
    }
  }

  // ---- loop + draw ----
  function startLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    let last = performance.now();
    const frame = (now) => {
      const dt = now - last; last = now;
      rafId = requestAnimationFrame(frame);
      if (!viewActive()) return;
      if (state === 'playing') elapsed += dt;
      if (shake > 0) shake *= 0.86;
      if (flash > 0) flash -= 1;
      for (let i = confetti.length - 1; i >= 0; i--) {
        const p = confetti[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.rot += p.vr; p.life -= 1;
        if (p.life <= 0 || p.y > rows * CELL + 20) confetti.splice(i, 1);
      }
      for (const cell of cells) if (cell.pop > 0) cell.pop = Math.max(0, cell.pop - 0.08);
      draw();
      // live timer text
      const t = document.getElementById('mines-time');
      if (t) t.textContent = Math.floor(elapsed / 1000);
    };
    rafId = requestAnimationFrame(frame);
  }

  function draw() {
    const w = cols * CELL, h = rows * CELL;
    ctx.save();
    if (shake > 0.5) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(-20, -20, w + 40, h + 40);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = cells[idx(r, c)];
        const x = c * CELL, y = r * CELL;
        const pop = cell.pop || 0;
        const inset = pop * 2;

        if (cell.revealed) {
          if (cell.mine) {
            ctx.fillStyle = cell.hitMine ? '#7d1e1e' : '#30363d';
            ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
            ctx.fillStyle = cell.hitMine ? '#ff5c5c' : '#c9d1d9';
            ctx.beginPath();
            ctx.arc(x + CELL / 2, y + CELL / 2, CELL * 0.22, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = '#161b22';
            ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
            if (cell.count > 0) {
              ctx.fillStyle = NUM_COLORS[cell.count];
              ctx.font = 'bold ' + Math.floor(CELL * 0.6) + 'px JetBrains Mono, monospace';
              ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              ctx.fillText(cell.count, x + CELL / 2, y + CELL / 2 + 1);
            }
          }
        } else {
          // Raised unrevealed tile with a subtle bevel.
          ctx.fillStyle = '#2b333d';
          ctx.fillRect(x + 1 + inset, y + 1 + inset, CELL - 2 - inset * 2, CELL - 2 - inset * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.07)';
          ctx.fillRect(x + 1 + inset, y + 1 + inset, CELL - 2 - inset * 2, 3);
          if (cell.flagged) {
            ctx.font = Math.floor(CELL * 0.55) + 'px sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('🚩', x + CELL / 2, y + CELL / 2 + 1);
          }
        }
      }
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

    // Confetti (win)
    for (const p of confetti) {
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 40));
      ctx.fillRect(-3, -2, 6, 4);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    if (flash > 0) { ctx.fillStyle = 'rgba(248,81,73,' + (flash / 30 * 0.22) + ')'; ctx.fillRect(0, 0, w, h); }
    ctx.restore();

    if (state === 'won' || state === 'lost') {
      ctx.fillStyle = state === 'won' ? 'rgba(63,185,80,0.12)' : 'rgba(248,81,73,0.10)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#E6EDF3';
      ctx.font = 'bold ' + Math.min(34, w * 0.07) + 'px JetBrains Mono, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(state === 'won' ? '😎 CLEARED!' : '💥 BOOM', w / 2, h / 2 - 10);
      ctx.font = '13px Inter, sans-serif'; ctx.fillStyle = '#7D8590';
      ctx.fillText('Press the face or New Game to play again', w / 2, h / 2 + 18);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
  }

  function updateHud() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('mines-count', Math.max(0, mineCount - flags));
    const face = document.getElementById('mines-face');
    if (face) face.textContent = lastFace;
    const b = bestTime();
    set('mines-best', b == null ? '—' : b + 's');
  }

  function syncControls() {
    document.querySelectorAll('.mines-diff-btn').forEach(btn => {
      btn.classList.toggle('primary', btn.dataset.diff === diff);
    });
    updateHud();
  }

  function destroy() {
    // Loop lives for the page's lifetime (init runs once) and no-ops while
    // hidden — nothing to tear down but the confetti/shake, which fade out.
    confetti = []; shake = 0; flash = 0;
  }

  return { init, newGame, setDifficulty, toggleFlagMode, destroy };
})();
