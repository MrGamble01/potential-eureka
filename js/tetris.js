/* ============================================
   TETRIS — Classic block-stacking game
   ============================================ */

const TetrisGame = (() => {
  const CELL = 30;
  const COLS = 10;
  const ROWS = 20;
  const WIDTH  = COLS * CELL;
  const HEIGHT = ROWS * CELL;

  const PIECES = {
    I: { shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], color: '#58A6FF' },
    O: { shape: [[1,1],[1,1]],                              color: '#F0D000' },
    T: { shape: [[0,1,0],[1,1,1],[0,0,0]],                  color: '#6C63FF' },
    S: { shape: [[0,1,1],[1,1,0],[0,0,0]],                  color: '#3FB950' },
    Z: { shape: [[1,1,0],[0,1,1],[0,0,0]],                  color: '#F85149' },
    J: { shape: [[1,0,0],[1,1,1],[0,0,0]],                  color: '#F778BA' },
    L: { shape: [[0,0,1],[1,1,1],[0,0,0]],                  color: '#F0A500' },
  };
  const PIECE_KEYS = Object.keys(PIECES);

  let canvas, ctx, nextCanvas, nextCtx, holdCanvas, holdCtx;
  let board, current, next, held;
  let score, highScore, level, linesCleared;
  let gameLoop, running, gameOver, canHold;
  let bag = [];
  let clearingRows = null;   // rows flashing white before they collapse
  let clearTimer = null;
  let sparks = [], sparkRaf = null;
  const sfx = Utils.sfx;

  // 7-bag randomiser for fair piece distribution
  function drawFromBag() {
    if (bag.length === 0) {
      bag = [...PIECE_KEYS];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    const type = bag.pop();
    const p = PIECES[type];
    return {
      type,
      shape: p.shape.map(r => [...r]),
      color: p.color,
      x: Math.floor((COLS - p.shape[0].length) / 2),
      y: 0,
    };
  }

  function freshPiece(type) {
    const p = PIECES[type];
    return {
      type,
      shape: p.shape.map(r => [...r]),
      color: p.color,
      x: Math.floor((COLS - p.shape[0].length) / 2),
      y: 0,
    };
  }

  function init() {
    canvas     = document.getElementById('tetris-canvas');
    nextCanvas = document.getElementById('tetris-next-canvas');
    holdCanvas = document.getElementById('tetris-hold-canvas');
    if (!canvas) return;

    // Size the backing store to CSS px * devicePixelRatio for crisp HiDPI
    // rendering; game logic keeps using WIDTH/HEIGHT (CSS/logical) coords.
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width  = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    canvas.style.width = WIDTH + 'px';
    ctx     = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    nextCtx = nextCanvas ? nextCanvas.getContext('2d') : null;
    holdCtx = holdCanvas ? holdCanvas.getContext('2d') : null;

    highScore = Utils.highScore.load('tetris-high');
    board = createBoard();
    running = gameOver = false;
    score = level = 0; linesCleared = 0;
    current = next = held = null;
    bag = [];

    updateInfo();
    draw();
    drawPreview(nextCtx, null);
    drawPreview(holdCtx, null);

    document.addEventListener('keydown', Utils.whenViewActive('view-tetris', handleKey));

    // Basic touch support: swipe to move/drop, tap to rotate
    let tx = 0, ty = 0;
    canvas.addEventListener('touchstart', e => {
      tx = e.touches[0].clientX;
      ty = e.touches[0].clientY;
    }, { passive: true });
    canvas.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - tx;
      const dy = e.changedTouches[0].clientY - ty;
      if (!running) { start(); return; }
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        rotateCW(); // tap = rotate
      } else if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 20) move(1, 0); else if (dx < -20) move(-1, 0);
      } else {
        if (dy > 30) hardDrop(); else if (dy < -30) rotateCW();
      }
      draw(); updateInfo();
    }, { passive: true });
  }

  function createBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function rotateMat(shape) {
    const R = shape.length, C = shape[0].length;
    return Array.from({ length: C }, (_, c) =>
      Array.from({ length: R }, (_, r) => shape[R - 1 - r][c])
    );
  }

  function collides(shape, px, py) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = px + c, ny = py + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny < 0) continue;
        if (board[ny][nx]) return true;
      }
    }
    return false;
  }

  function move(dx, dy) {
    if (!current) return false;
    if (!collides(current.shape, current.x + dx, current.y + dy)) {
      current.x += dx;
      current.y += dy;
      if (dx !== 0) sfx('move'); // horizontal only — gravity would spam it
      return true;
    }
    return false;
  }

  function tryRotate(rotated) {
    if (!current) return;
    const kicks = [0, 1, -1, 2, -2];
    for (const k of kicks) {
      if (!collides(rotated, current.x + k, current.y)) {
        current.shape = rotated;
        current.x += k;
        sfx('rotate');
        return;
      }
    }
  }

  function rotateCW()  { if (current) tryRotate(rotateMat(current.shape)); }
  function rotateCCW() { if (current) tryRotate(rotateMat(rotateMat(rotateMat(current.shape)))); }

  function ghostRow() {
    if (!current) return 0;
    let y = current.y;
    while (!collides(current.shape, current.x, y + 1)) y++;
    return y;
  }

  function hardDrop() {
    if (!current) return;
    let dropped = 0;
    while (!collides(current.shape, current.x, current.y + 1)) {
      current.y++; dropped++;
    }
    score += dropped * 2;
    lock();
  }

  function lock() {
    if (!current) return;
    for (let r = 0; r < current.shape.length; r++) {
      for (let c = 0; c < current.shape[r].length; c++) {
        if (!current.shape[r][c]) continue;
        const ny = current.y + r;
        if (ny < 0) { endGame(); return; }
        board[ny][current.x + c] = current.color;
      }
    }
    sfx('lock');
    clearLines();
  }

  function spawnNext() {
    canHold = true;
    current = next;
    next = drawFromBag();
    drawPreview(nextCtx, next);
    if (collides(current.shape, current.x, current.y)) endGame();
  }

  function clearLines() {
    const full = [];
    for (let r = 0; r < ROWS; r++) {
      if (board[r].every(cell => cell !== null)) full.push(r);
    }
    if (!full.length) { spawnNext(); return; }
    sfx('clear');
    // Flash the rows white for a beat before collapsing them. The piece is
    // parked at null so the gravity interval no-ops until the collapse; the
    // one-shot timer then splices the rows and spawns the next piece.
    clearingRows = full;
    current = null;
    spawnClearSparks(full);
    Effects.shakeCanvas(canvas, 2 + full.length * 2, 140 + full.length * 60);
    draw();
    clearTimeout(clearTimer);
    clearTimer = setTimeout(collapseRows, 90);
  }

  function collapseRows() {
    if (!clearingRows) return;
    const cleared = clearingRows.length;
    // Ascending order: splice+unshift leaves rows below the removed row at
    // the same index, so the remaining (lower) full rows stay valid.
    for (const r of clearingRows) {
      board.splice(r, 1);
      board.unshift(Array(COLS).fill(null));
    }
    clearingRows = null;
    const pts = [0, 100, 300, 500, 800];
    score += (pts[Math.min(cleared, 4)]) * level;
    linesCleared += cleared;
    const newLevel = Math.floor(linesCleared / 10) + 1;
    if (newLevel !== level) { level = newLevel; restartLoop(); }
    highScore = Utils.highScore.save('tetris-high', score, highScore);
    spawnNext();
    updateInfo();
    draw();
  }

  function spawnClearSparks(rows) {
    for (const r of rows) {
      for (let c = 0; c < COLS; c++) {
        if (Math.random() < 0.65) {
          sparks.push({
            x: c * CELL + CELL / 2, y: r * CELL + CELL / 2,
            vx: (Math.random() - 0.5) * 4, vy: -1 - Math.random() * 3,
            life: 18 + Math.random() * 16, color: board[r][c] || '#E6EDF3',
          });
        }
      }
    }
    if (!sparkRaf) tickSparks();
  }

  function tickSparks() {
    sparkRaf = requestAnimationFrame(tickSparks);
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx; s.y += s.vy; s.vy += 0.15; s.life -= 1;
      if (s.life <= 0) sparks.splice(i, 1);
    }
    draw();
    if (!sparks.length) { cancelAnimationFrame(sparkRaf); sparkRaf = null; }
  }

  function dropMs() { return Math.max(50, 1000 - (level - 1) * 90); }

  function restartLoop() {
    if (!running) return;
    clearInterval(gameLoop);
    gameLoop = setInterval(autoDown, dropMs());
  }

  function autoDown() {
    if (!move(0, 1)) lock();
    draw(); updateInfo();
  }

  function holdPiece() {
    if (!canHold || !current) return;
    canHold = false;
    const swapOut = freshPiece(current.type);
    if (held) {
      const swapIn = held;
      held = swapOut;
      current = swapIn;
    } else {
      held = swapOut;
      current = next;
      next = drawFromBag();
      drawPreview(nextCtx, next);
    }
    drawPreview(holdCtx, held);
    if (collides(current.shape, current.x, current.y)) endGame();
    draw();
  }

  function start() {
    bag = [];
    board = createBoard();
    score = 0; level = 1; linesCleared = 0;
    held = null; canHold = true;
    gameOver = false; running = true;
    clearTimeout(clearTimer);
    clearingRows = null;
    sparks = [];
    sfx('start');
    current = drawFromBag();
    next    = drawFromBag();
    drawPreview(nextCtx, next);
    drawPreview(holdCtx, null);

    const ov = document.getElementById('tetris-overlay');
    if (ov) ov.style.display = 'none';

    clearInterval(gameLoop);
    gameLoop = setInterval(autoDown, dropMs());
    updateInfo(); draw();
  }

  function endGame() {
    running = false; gameOver = true;
    sfx('over');
    clearInterval(gameLoop);
    // Persist the high score here too — drops (not just line clears) add points,
    // so a run's best score can land outside clearLines().
    const prevHigh = highScore;
    highScore = Utils.highScore.save('tetris-high', score, highScore);
    if (highScore !== prevHigh) updateInfo();
    Utils.showGameOver('tetris-overlay', {
      lines: [`Score: ${score}`, `Level ${level} &middot; ${linesCleared} lines`],
      hint: 'Press SPACE to restart',
    });
  }

  function handleKey(e) {
    if (!running && e.key === ' ') { if (!e.repeat) start(); e.preventDefault(); return; }
    if (!running) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
    // One-shot actions must not fire on OS key auto-repeat: holding
    // Space delivered a hardDrop per repeat event, instantly locking
    // and free-falling every subsequent piece into a top-out (rotate
    // and hold had the same repeat bug). Held movement keys still
    // repeat — that's how left/right/soft-drop are meant to work.
    if (e.repeat && !['ArrowLeft', 'ArrowRight', 'ArrowDown'].includes(e.key)) return;
    switch (e.key) {
      case 'ArrowLeft':  move(-1, 0); break;
      case 'ArrowRight': move(1, 0);  break;
      case 'ArrowDown':
        if (!move(0, 1)) lock();
        score += 1;
        break;
      case 'ArrowUp': case 'x': case 'X': rotateCW();  break;
      case 'z': case 'Z':                 rotateCCW(); break;
      case ' ':  hardDrop(); e.preventDefault(); return;
      case 'c': case 'C':   holdPiece(); break;
      default: return;
    }
    draw(); updateInfo();
  }

  // ── Rendering ──────────────────────────────────────────────

  function drawCell(c, x, y, color, size) {
    size = size || CELL;
    c.fillStyle = color;
    c.shadowColor = color;
    c.shadowBlur = 6;
    c.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.shadowBlur = 0;
    c.fillRect(x * size + 1, y * size + 1, size - 2, 3);
    c.fillRect(x * size + 1, y * size + 1, 3, size - 2);
  }

  function draw() {
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, HEIGHT); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(WIDTH, y * CELL); ctx.stroke();
    }

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (board[r][c]) drawCell(ctx, c, r, board[r][c]);

    // White flash over rows about to collapse
    if (clearingRows) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const r of clearingRows) ctx.fillRect(0, r * CELL, WIDTH, CELL);
    }

    // Line-clear sparks
    for (const s of sparks) {
      ctx.globalAlpha = Math.max(0, Math.min(1, s.life / 20));
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    if (current && running) {
      // Ghost
      const gy = ghostRow();
      for (let r = 0; r < current.shape.length; r++) {
        for (let c = 0; c < current.shape[r].length; c++) {
          if (!current.shape[r][c]) continue;
          const py = gy + r;
          if (py < 0) continue;
          ctx.globalAlpha = 0.2;
          ctx.fillStyle = current.color;
          ctx.fillRect((current.x + c) * CELL + 1, py * CELL + 1, CELL - 2, CELL - 2);
          ctx.strokeStyle = current.color;
          ctx.lineWidth = 1;
          ctx.strokeRect((current.x + c) * CELL + 1, py * CELL + 1, CELL - 2, CELL - 2);
          ctx.globalAlpha = 1;
        }
      }
      // Piece
      for (let r = 0; r < current.shape.length; r++)
        for (let c = 0; c < current.shape[r].length; c++)
          if (current.shape[r][c] && current.y + r >= 0)
            drawCell(ctx, current.x + c, current.y + r, current.color);
    }

    if (!running && !gameOver) {
      ctx.fillStyle = 'rgba(13,17,23,0.75)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#E6EDF3';
      ctx.font = 'bold 18px Inter, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Press SPACE or tap New Game to start', WIDTH / 2, HEIGHT / 2);
      ctx.font = '11px Inter, monospace';
      ctx.fillStyle = '#7D8590';
      ctx.fillText('← → move  ·  ↑ / X rotate  ·  ↓ soft drop', WIDTH / 2, HEIGHT / 2 + 22);
      ctx.fillText('Space hard drop  ·  C hold', WIDTH / 2, HEIGHT / 2 + 38);
      ctx.textAlign = 'left';
    }
  }

  function drawPreview(c, piece) {
    if (!c) return;
    const W = c.canvas.width, H = c.canvas.height;
    c.fillStyle = '#0d1117';
    c.fillRect(0, 0, W, H);
    if (!piece) return;

    const shape = piece.shape;
    let minR = shape.length, maxR = 0, minC = shape[0].length, maxC = 0;
    for (let r = 0; r < shape.length; r++)
      for (let col = 0; col < shape[r].length; col++)
        if (shape[r][col]) {
          minR = Math.min(minR, r); maxR = Math.max(maxR, r);
          minC = Math.min(minC, col); maxC = Math.max(maxC, col);
        }
    const bR = maxR - minR + 1, bC = maxC - minC + 1;
    const cell = Math.min(Math.floor((W - 16) / bC), Math.floor((H - 16) / bR), 28);
    const sx = Math.floor((W - bC * cell) / 2);
    const sy = Math.floor((H - bR * cell) / 2);

    for (let r = minR; r <= maxR; r++) {
      for (let col = minC; col <= maxC; col++) {
        if (!shape[r][col]) continue;
        const px = sx + (col - minC) * cell;
        const py = sy + (r   - minR) * cell;
        c.fillStyle = piece.color;
        c.shadowColor = piece.color;
        c.shadowBlur = 6;
        c.fillRect(px + 1, py + 1, cell - 2, cell - 2);
        c.fillStyle = 'rgba(255,255,255,0.18)';
        c.shadowBlur = 0;
        c.fillRect(px + 1, py + 1, cell - 2, 3);
        c.fillRect(px + 1, py + 1, 3, cell - 2);
      }
    }
    c.shadowBlur = 0;
  }

  function updateInfo() {
    const el = id => document.getElementById(id);
    const s = el('tetris-score'), lv = el('tetris-level'), li = el('tetris-lines'), h = el('tetris-high');
    if (s)  s.textContent  = score        || 0;
    if (lv) lv.textContent = level        || 1;
    if (li) li.textContent = linesCleared || 0;
    if (h)  h.textContent  = highScore;
  }

  function destroy() {
    clearInterval(gameLoop);
    clearTimeout(clearTimer);
    if (sparkRaf) { cancelAnimationFrame(sparkRaf); sparkRaf = null; }
    clearingRows = null; sparks = [];
    // Shell re-inits a view only once and won't redraw on return — paint the
    // idle start screen now so returning doesn't show a frozen frame.
    running = false; gameOver = false;
    const ov = document.getElementById('tetris-overlay'); if (ov) ov.style.display = 'none';
    draw();
  }

  return { init, start, destroy };
})();
