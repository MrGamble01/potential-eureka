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
  let gameLoop, running, gameOver, paused, canHold;
  let combo, lastClearWasTetris, clearMsg, clearMsgExpiry;
  let bag = [];

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

    canvas.width  = WIDTH;
    canvas.height = HEIGHT;
    ctx     = canvas.getContext('2d');
    nextCtx = nextCanvas ? nextCanvas.getContext('2d') : null;
    holdCtx = holdCanvas ? holdCanvas.getContext('2d') : null;

    highScore = parseInt(localStorage.getItem('tetris-high') || '0');
    board = createBoard();
    running = gameOver = false;
    score = level = 0; linesCleared = 0;
    current = next = held = null;
    bag = [];

    updateInfo();
    draw();
    drawPreview(nextCtx, null);
    drawPreview(holdCtx, null);

    document.addEventListener('keydown', handleKey);

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
    clearLines();
    canHold = true;
    current = next;
    next = drawFromBag();
    drawPreview(nextCtx, next);
    if (collides(current.shape, current.x, current.y)) endGame();
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every(cell => cell !== null)) {
        board.splice(r, 1);
        board.unshift(Array(COLS).fill(null));
        cleared++; r++;
      }
    }
    if (!cleared) { combo = 0; return; }

    const isTetris = cleared === 4;
    const b2b = isTetris && lastClearWasTetris;
    combo++;

    const basePts = [0, 100, 300, 500, 800][Math.min(cleared, 4)];
    let pts = basePts * level;
    if (b2b) pts = Math.floor(pts * 1.5);
    if (combo > 1) pts += 50 * (combo - 1) * level;
    score += pts;

    lastClearWasTetris = isTetris;
    linesCleared += cleared;

    if (b2b) clearMsg = 'BACK-TO-BACK TETRIS!';
    else if (isTetris) clearMsg = 'TETRIS!';
    else if (cleared === 3) clearMsg = 'TRIPLE!';
    else if (cleared === 2) clearMsg = 'DOUBLE!';
    else clearMsg = 'SINGLE';
    if (combo > 1) clearMsg += `  COMBO ×${combo}`;
    clearMsgExpiry = Date.now() + 1800;

    const newLevel = Math.floor(linesCleared / 10) + 1;
    if (newLevel !== level) { level = newLevel; restartLoop(); }
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('tetris-high', String(highScore));
    }
    updateInfo();
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
    draw();
  }

  function start() {
    bag = [];
    board = createBoard();
    score = 0; level = 1; linesCleared = 0;
    held = null; canHold = true;
    gameOver = false; running = true; paused = false;
    combo = 0; lastClearWasTetris = false; clearMsg = ''; clearMsgExpiry = 0;
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

  function togglePause() {
    if (!running || gameOver) return;
    paused = !paused;
    if (paused) clearInterval(gameLoop);
    else gameLoop = setInterval(autoDown, dropMs());
    draw();
  }

  function endGame() {
    running = false; gameOver = true;
    clearInterval(gameLoop);
    const ov = document.getElementById('tetris-overlay');
    if (ov) {
      ov.style.display = 'flex';
      ov.innerHTML = `
        <h2>GAME OVER</h2>
        <p>Score: ${score}</p>
        <p>Level ${level} &middot; ${linesCleared} lines</p>
        <p style="font-size:12px; color: var(--text-dim)">Press SPACE to restart</p>
      `;
    }
  }

  function handleKey(e) {
    if (!running && e.key === ' ') { start(); e.preventDefault(); return; }
    if (!running) return;
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { togglePause(); e.preventDefault(); return; }
    if (paused) return;
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

    // Pause overlay
    if (running && paused) {
      ctx.fillStyle = 'rgba(13,17,23,0.75)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = 'bold 24px Inter, monospace';
      ctx.fillStyle = '#6C63FF';
      ctx.shadowColor = '#6C63FF';
      ctx.shadowBlur = 18;
      ctx.fillText('PAUSED', WIDTH / 2, HEIGHT / 2);
      ctx.font = '11px Inter, monospace';
      ctx.fillStyle = '#7D8590';
      ctx.shadowBlur = 0;
      ctx.fillText('Press P or Esc to resume', WIDTH / 2, HEIGHT / 2 + 24);
      ctx.restore();
    }

    // Combo / line-clear message
    if (clearMsg && clearMsgExpiry > Date.now()) {
      const remaining = clearMsgExpiry - Date.now();
      const alpha = Math.min(1, remaining / 300);
      const isSpecial = clearMsg.startsWith('BACK') || clearMsg.startsWith('TETRIS');
      const color = isSpecial ? '#F7C948' : '#58A6FF';
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.font = `bold ${isSpecial ? 20 : 17}px Inter, monospace`;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
      ctx.fillText(clearMsg, WIDTH / 2, HEIGHT / 2 - 10);
      ctx.restore();
    }

    if (!running && !gameOver) {
      ctx.fillStyle = 'rgba(13,17,23,0.75)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#E6EDF3';
      ctx.font = 'bold 18px Inter, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Press SPACE to start', WIDTH / 2, HEIGHT / 2);
      ctx.font = '11px Inter, monospace';
      ctx.fillStyle = '#7D8590';
      ctx.fillText('← → move  ·  ↑ / X rotate  ·  ↓ soft drop', WIDTH / 2, HEIGHT / 2 + 22);
      ctx.fillText('Space hard drop  ·  C hold  ·  P pause', WIDTH / 2, HEIGHT / 2 + 38);
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
    running = false;
    document.removeEventListener('keydown', handleKey);
  }

  return { init, start, destroy };
})();
