/* ============================================
   DROP FOUR — Connect Four vs a minimax AI
   Alpha-beta pruning, centre-ordered search,
   three difficulties, drop animation + win line.
   ============================================ */

const ConnectFourGame = (() => {
  const COLS = 7, ROWS = 6, CELL = 62;
  const W = COLS * CELL, H = ROWS * CELL;
  const PLAYER = 1, AI = 2;
  const DEPTHS = { easy: 2, medium: 4, hard: 6 };

  let canvas, ctx;
  let board;              // ROWS×COLS: 0 empty, 1 player, 2 ai
  let turn, state;        // state: 'playing' | 'won' | 'lost' | 'draw'
  let difficulty = 'medium';
  let streak = 0, bestStreak = 0;
  let winLine = null;     // [[r,c],...] for the highlight
  let hoverCol = -1;
  let anim = null;        // falling-disc animation
  let confetti = [];
  let flash = 0;
  let rafId = null;
  let aiThinking = false;

  const sfx = Utils.sfx;
  const viewActive = () => {
    const v = document.getElementById('view-connect4');
    return v && v.classList.contains('active');
  };

  function init() {
    canvas = document.getElementById('c4-canvas');
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    difficulty = localStorage.getItem('c4-diff') || 'medium';
    if (!DEPTHS[difficulty]) difficulty = 'medium';
    bestStreak = Utils.highScore.load('connect4-streak');

    canvas.addEventListener('mousemove', e => { hoverCol = colAt(e.clientX); });
    canvas.addEventListener('mouseleave', () => { hoverCol = -1; });
    canvas.addEventListener('click', e => drop(colAt(e.clientX)));
    canvas.addEventListener('touchstart', e => { drop(colAt(e.touches[0].clientX)); e.preventDefault(); }, { passive: false });

    newGame();
    startLoop();
    syncControls();
  }

  function newGame() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    turn = PLAYER; state = 'playing';
    winLine = null; anim = null; confetti = []; flash = 0; aiThinking = false;
    updateHud();
  }

  function setDifficulty(d) {
    if (!DEPTHS[d]) return;
    difficulty = d;
    localStorage.setItem('c4-diff', d);
    newGame();
    syncControls();
  }

  function colAt(clientX) {
    const rect = canvas.getBoundingClientRect();
    const c = Math.floor((clientX - rect.left) * (W / rect.width) / CELL);
    return c >= 0 && c < COLS ? c : -1;
  }

  // ---- board helpers (operate on a passed board so the AI can search) ----
  function dropRow(b, col) {
    for (let r = ROWS - 1; r >= 0; r--) if (b[r][col] === 0) return r;
    return -1;
  }
  function cloneBoard(b) { return b.map(row => row.slice()); }

  function winnerFrom(b, r, c) {
    const who = b[r][c];
    if (!who) return null;
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of dirs) {
      const line = [[r, c]];
      for (let s = 1; s < 4; s++) { const nr = r + dr * s, nc = c + dc * s; if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || b[nr][nc] !== who) break; line.push([nr, nc]); }
      for (let s = 1; s < 4; s++) { const nr = r - dr * s, nc = c - dc * s; if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || b[nr][nc] !== who) break; line.unshift([nr, nc]); }
      if (line.length >= 4) return line.slice(0, 4);
    }
    return null;
  }

  // Full-board winner scan (for minimax terminal checks).
  function anyWinner(b) {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (b[r][c]) { const w = winnerFrom(b, r, c); if (w) return b[r][c]; }
    return null;
  }
  function isFull(b) { return b[0].every(v => v !== 0); }

  // ---- player / turn flow ----
  function drop(col) {
    if (state !== 'playing' || turn !== PLAYER || anim || aiThinking || col < 0) return;
    const r = dropRow(board, col);
    if (r < 0) return;
    startDrop(col, r, PLAYER, () => afterMove(r, col, PLAYER));
  }

  function startDrop(col, targetRow, who, done) {
    sfx('move');
    anim = { col, targetRow, who, y: -CELL * 0.5, vy: 0, done };
  }

  function afterMove(r, c, who) {
    board[r][c] = who;
    const line = winnerFrom(board, r, c);
    if (line) { endGame(who === PLAYER ? 'won' : 'lost', line); return; }
    if (isFull(board)) { endGame('draw', null); return; }
    turn = who === PLAYER ? AI : PLAYER;
    updateHud();
    if (turn === AI) {
      aiThinking = true;
      // brief think delay so it doesn't feel instant
      setTimeout(aiMove, 260);
    }
  }

  function aiMove() {
    if (state !== 'playing') { aiThinking = false; return; }
    const col = bestMove(board, DEPTHS[difficulty]);
    aiThinking = false;
    const r = dropRow(board, col);
    if (r < 0) { // board somehow full
      if (isFull(board)) endGame('draw', null);
      return;
    }
    startDrop(col, r, AI, () => afterMove(r, col, AI));
  }

  function endGame(result, line) {
    state = result; winLine = line;
    if (result === 'won') {
      streak++; bestStreak = Utils.highScore.save('connect4-streak', streak, bestStreak);
      sfx('bonus'); burstConfetti();
    } else if (result === 'lost') {
      streak = 0; sfx('die'); flash = 30;
      if (window.Effects) Effects.shakeCanvas(canvas, 7, 320);
    } else {
      sfx('rotate');
    }
    updateHud();
  }

  // ---- minimax with alpha-beta, centre-ordered ----
  const COL_ORDER = [3, 2, 4, 1, 5, 0, 6];

  function bestMove(b, depth) {
    let best = -Infinity, bestCol = COL_ORDER.find(c => dropRow(b, c) >= 0);
    let alpha = -Infinity;
    for (const c of COL_ORDER) {
      const r = dropRow(b, c);
      if (r < 0) continue;
      b[r][c] = AI;
      const score = minimax(b, depth - 1, false, alpha, Infinity);
      b[r][c] = 0;
      if (score > best) { best = score; bestCol = c; }
      alpha = Math.max(alpha, best);
    }
    return bestCol;
  }

  function minimax(b, depth, maximizing, alpha, beta) {
    const win = anyWinner(b);
    if (win === AI) return 100000 + depth;
    if (win === PLAYER) return -100000 - depth;
    if (isFull(b) || depth === 0) return heuristic(b);

    if (maximizing) {
      let val = -Infinity;
      for (const c of COL_ORDER) {
        const r = dropRow(b, c); if (r < 0) continue;
        b[r][c] = AI;
        val = Math.max(val, minimax(b, depth - 1, false, alpha, beta));
        b[r][c] = 0;
        alpha = Math.max(alpha, val);
        if (alpha >= beta) break;
      }
      return val;
    } else {
      let val = Infinity;
      for (const c of COL_ORDER) {
        const r = dropRow(b, c); if (r < 0) continue;
        b[r][c] = PLAYER;
        val = Math.min(val, minimax(b, depth - 1, true, alpha, beta));
        b[r][c] = 0;
        beta = Math.min(beta, val);
        if (alpha >= beta) break;
      }
      return val;
    }
  }

  // Window-based heuristic: score every 4-length window on the board.
  function heuristic(b) {
    let score = 0;
    // centre column preference
    for (let r = 0; r < ROWS; r++) if (b[r][3] === AI) score += 3;
    const windows = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        if (c + 3 < COLS) windows.push([b[r][c], b[r][c + 1], b[r][c + 2], b[r][c + 3]]);
        if (r + 3 < ROWS) windows.push([b[r][c], b[r + 1][c], b[r + 2][c], b[r + 3][c]]);
        if (r + 3 < ROWS && c + 3 < COLS) windows.push([b[r][c], b[r + 1][c + 1], b[r + 2][c + 2], b[r + 3][c + 3]]);
        if (r + 3 < ROWS && c - 3 >= 0) windows.push([b[r][c], b[r + 1][c - 1], b[r + 2][c - 2], b[r + 3][c - 3]]);
      }
    for (const w of windows) {
      const ai = w.filter(v => v === AI).length;
      const pl = w.filter(v => v === PLAYER).length;
      const empty = w.filter(v => v === 0).length;
      if (ai > 0 && pl > 0) continue;         // blocked window, no value
      if (ai === 3 && empty === 1) score += 50;
      else if (ai === 2 && empty === 2) score += 8;
      if (pl === 3 && empty === 1) score -= 55; // value blocking slightly higher
      else if (pl === 2 && empty === 2) score -= 6;
    }
    return score;
  }

  function burstConfetti() {
    const colors = ['#3FB950', '#58A6FF', '#F7C948', '#F778BA', '#e63946'];
    for (let i = 0; i < 100; i++) confetti.push({
      x: Math.random() * W, y: -10 - Math.random() * 40,
      vx: (Math.random() - 0.5) * 2.4, vy: 1 + Math.random() * 3,
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
      color: colors[Math.floor(Math.random() * colors.length)], life: 100 + Math.random() * 60,
    });
  }

  // ---- loop + draw ----
  function startLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    const frame = () => {
      rafId = requestAnimationFrame(frame);
      if (!viewActive()) return;
      // disc fall physics
      if (anim) {
        anim.vy += 2.4; anim.y += anim.vy;
        const targetY = anim.targetRow * CELL;
        if (anim.y >= targetY) {
          anim.y = targetY;
          const done = anim.done; anim = null;
          sfx('lock');
          done();
        }
      }
      if (flash > 0) flash -= 1;
      for (let i = confetti.length - 1; i >= 0; i--) {
        const p = confetti[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.rot += p.vr; p.life -= 1;
        if (p.life <= 0 || p.y > H + 20) confetti.splice(i, 1);
      }
      draw();
    };
    rafId = requestAnimationFrame(frame);
  }

  function discColor(who) { return who === PLAYER ? '#e63946' : '#f7c948'; }

  function draw() {
    // background board (blue) with circular holes punched via composite
    ctx.clearRect(0, 0, W, H);

    // hover ghost + column highlight (only on player's turn)
    if (state === 'playing' && turn === PLAYER && !anim && !aiThinking && hoverCol >= 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(hoverCol * CELL, 0, CELL, H);
    }

    // falling disc (drawn behind the board mask so it appears to slot in)
    if (anim) {
      ctx.fillStyle = discColor(anim.who);
      ctx.beginPath();
      ctx.arc(anim.col * CELL + CELL / 2, anim.y + CELL / 2, CELL * 0.38, 0, Math.PI * 2);
      ctx.fill();
    }

    // the blue board with holes: draw board rects, punch holes showing discs/empty
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * CELL, y = r * CELL;
        ctx.fillStyle = '#1c3a6e';
        ctx.fillRect(x, y, CELL, CELL);
        const v = board[r][c];
        ctx.beginPath();
        ctx.arc(x + CELL / 2, y + CELL / 2, CELL * 0.40, 0, Math.PI * 2);
        if (v === 0) { ctx.fillStyle = '#0d1117'; }
        else { ctx.fillStyle = discColor(v); }
        ctx.fill();
        if (v !== 0) { // subtle highlight
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.beginPath(); ctx.arc(x + CELL / 2 - CELL * 0.1, y + CELL / 2 - CELL * 0.1, CELL * 0.12, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // win line highlight
    if (winLine) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.shadowColor = '#fff'; ctx.shadowBlur = 12;
      ctx.beginPath();
      const a = winLine[0], b = winLine[winLine.length - 1];
      ctx.moveTo(a[1] * CELL + CELL / 2, a[0] * CELL + CELL / 2);
      ctx.lineTo(b[1] * CELL + CELL / 2, b[0] * CELL + CELL / 2);
      ctx.stroke(); ctx.shadowBlur = 0;
    }

    // confetti
    for (const p of confetti) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 40));
      ctx.fillRect(-3, -2, 6, 4); ctx.restore();
    }
    ctx.globalAlpha = 1;

    if (flash > 0) { ctx.fillStyle = 'rgba(230,57,70,' + (flash / 30 * 0.2) + ')'; ctx.fillRect(0, 0, W, H); }

    if (state !== 'playing') {
      ctx.fillStyle = 'rgba(13,17,23,0.55)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#E6EDF3'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 30px JetBrains Mono, monospace';
      const msg = state === 'won' ? '🎉 YOU WIN!' : state === 'lost' ? '🤖 AI WINS' : '🤝 DRAW';
      ctx.fillText(msg, W / 2, H / 2 - 10);
      ctx.font = '13px Inter, sans-serif'; ctx.fillStyle = '#7D8590';
      ctx.fillText('New Game to play again', W / 2, H / 2 + 18);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
  }

  function updateHud() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('c4-streak', streak);
    set('c4-best', bestStreak);
    const turnEl = document.getElementById('c4-turn');
    if (turnEl) {
      turnEl.textContent = state === 'playing'
        ? (turn === PLAYER ? 'Your move (red)' : 'AI thinking…')
        : (state === 'won' ? 'You won!' : state === 'lost' ? 'AI won' : 'Draw');
    }
  }

  function syncControls() {
    document.querySelectorAll('.c4-diff-btn').forEach(btn => btn.classList.toggle('primary', btn.dataset.diff === difficulty));
    updateHud();
  }

  function destroy() {
    // Loop persists (init once) and no-ops while hidden; nothing to tear down.
    confetti = []; flash = 0;
  }

  return { init, newGame, setDifficulty, destroy };
})();
