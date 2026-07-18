/* ============================================
   2048 — slide & merge. Canvas board with a
   slide tween and pop on spawn/merge. Arrow keys /
   WASD / swipe. Score + best; win at 2048, keep going.
   Follows the arcade module pattern.
   ============================================ */

const Game2048 = (() => {
  const N = 4;
  const GAP = 12, CELL = 108, PAD = 14;
  const SIZE = PAD * 2 + N * CELL + (N - 1) * GAP; // board pixel size
  const TILE_COLORS = {
    2: '#1f6feb', 4: '#388bfd', 8: '#3fb950', 16: '#d29922', 32: '#f0883e',
    64: '#f85149', 128: '#f778ba', 256: '#a371f7', 512: '#22d3ee',
    1024: '#facc15', 2048: '#ffd700',
  };

  let canvas, ctx;
  let grid;          // N×N of values (0 empty)
  let score, best, won, over, running;
  let anim = null;   // { t, dur, moves:[{val,fr,fc,tr,tc,merge}], spawn:{r,c}, merged:[{r,c}] }
  let raf, lastT;
  let queuedDir = null;    // input buffered while the slide animation runs
  let winBannerUntil = 0;  // one-time "you made 2048" banner deadline

  function init() {
    canvas = document.getElementById('g2048-canvas');
    if (!canvas) return;
    // Size the backing store to CSS px * devicePixelRatio for crisp HiDPI
    // rendering; game logic keeps using the SIZE (CSS/logical) coords.
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = SIZE * dpr; canvas.height = SIZE * dpr;
    canvas.style.width = SIZE + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvas.style.touchAction = 'none'; // swipes drive the board, not page scroll
    best = Utils.highScore.load('g2048-best');
    newGame(false);

    // Bind input once — init() runs on every view entry, so guard against
    // stacking duplicate listeners (which would leak and multi-fire).
    if (!bound) {
      bound = true;
      document.addEventListener('keydown', Utils.whenViewActive('view-2048', onKey));
      canvas.addEventListener('mousedown', onMouseDown);
      canvas.addEventListener('touchstart', onTouchStart, { passive: true });
      canvas.addEventListener('touchend', onTouchEnd, { passive: true });
    }
    updateInfo();
    draw();
  }

  let bound = false, touchSX = 0, touchSY = 0;
  function onMouseDown() { if (!running || over) newGame(true); }
  function onTouchStart(e) { touchSX = e.touches[0].clientX; touchSY = e.touches[0].clientY; }
  function onTouchEnd(e) {
    const dx = e.changedTouches[0].clientX - touchSX, dy = e.changedTouches[0].clientY - touchSY;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) { if (over || !running) newGame(true); return; }
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'R' : 'L');
    else move(dy > 0 ? 'D' : 'U');
  }

  function onKey(e) {
    // Space / Enter (re)starts when idle or after game over — matches the overlay hint.
    if ((e.key === ' ' || e.key === 'Enter') && (over || !running)) { newGame(true); e.preventDefault(); return; }
    const map = { ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'U', ArrowDown: 'D',
      a: 'L', d: 'R', w: 'U', s: 'D', A: 'L', D: 'R', W: 'U', S: 'D' };
    const dir = map[e.key];
    if (dir) { move(dir); e.preventDefault(); }
  }

  function newGame(run) {
    clearTimeout(overTimer);
    grid = Array.from({ length: N }, () => Array(N).fill(0));
    score = 0; won = false; over = false;
    anim = null; queuedDir = null; winBannerUntil = 0;
    mergedCells = null;
    addRandom(); addRandom();
    running = run !== false;
    const ov = document.getElementById('g2048-overlay');
    if (ov) ov.style.display = 'none';
    updateInfo();
    ensureLoop();
    draw();
  }
  function start() { newGame(true); }

  function addRandom() {
    const empty = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!grid[r][c]) empty.push([r, c]);
    if (!empty.length) return null;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    grid[r][c] = Math.random() < 0.9 ? 2 : 4;
    return { r, c };
  }

  // Compress one line (array of 4 values) toward index 0; returns moves relative to line.
  function compress(line) {
    const nz = [];
    line.forEach((v, i) => { if (v) nz.push({ v, i }); });
    const out = [0, 0, 0, 0], moves = []; let pos = 0, gained = 0;
    for (let k = 0; k < nz.length; k++) {
      if (k + 1 < nz.length && nz[k + 1].v === nz[k].v) {
        const val = nz[k].v * 2; out[pos] = val; gained += val; if (val === 2048) won = true;
        moves.push({ from: nz[k].i, to: pos, val: nz[k].v, merge: true });
        moves.push({ from: nz[k + 1].i, to: pos, val: nz[k].v, merge: true });
        k++; pos++;
      } else {
        out[pos] = nz[k].v; moves.push({ from: nz[k].i, to: pos, val: nz[k].v, merge: false }); pos++;
      }
    }
    return { out, moves, gained };
  }

  // Map a line index + row number into grid (r,c) for a given direction.
  function coord(dir, lineNo, idx) {
    switch (dir) {
      case 'L': return [lineNo, idx];
      case 'R': return [lineNo, N - 1 - idx];
      case 'U': return [idx, lineNo];
      case 'D': return [N - 1 - idx, lineNo];
    }
  }
  function readLine(dir, lineNo) {
    const line = [];
    for (let i = 0; i < N; i++) { const [r, c] = coord(dir, lineNo, i); line.push(grid[r][c]); }
    return line;
  }

  function move(dir) {
    if (!running || over) return;
    // Mid-slide inputs aren't dropped — remember the last one and replay it
    // as soon as the animation clears.
    if (anim) { queuedDir = dir; return; }
    const wasWon = won;
    const allMoves = []; const mergedTo = []; let gained = 0; let changed = false;
    const next = Array.from({ length: N }, () => Array(N).fill(0));
    for (let lineNo = 0; lineNo < N; lineNo++) {
      const line = readLine(dir, lineNo);
      const { out, moves, gained: g } = compress(line);
      gained += g;
      for (let i = 0; i < N; i++) { const [r, c] = coord(dir, lineNo, i); next[r][c] = out[i]; }
      moves.forEach(m => {
        const [fr, fc] = coord(dir, lineNo, m.from);
        const [tr, tc] = coord(dir, lineNo, m.to);
        if (fr !== tr || fc !== tc || m.merge) changed = true;
        allMoves.push({ val: m.val, fr, fc, tr, tc, merge: m.merge });
        if (m.merge && !mergedTo.some(t => t.r === tr && t.c === tc)) mergedTo.push({ r: tr, c: tc });
      });
    }
    if (!changed) return;

    score += gained;
    // Victory jingle only on the move that first reaches 2048; merges otherwise.
    if (gained > 0) SFX_play((won && !wasWon) ? 'clear' : 'bonus'); else SFX_play('move');
    // One-time win banner on the move that first makes 2048 — play continues.
    if (won && !wasWon) winBannerUntil = performance.now() + 2600;
    best = Utils.highScore.save('g2048-best', score, best);

    // Commit the model, then animate the slide from old positions.
    grid = next;
    const spawn = addRandom();
    anim = { t: 0, dur: 90, moves: allMoves, spawn, merged: mergedTo, start: performance.now() };
    updateInfo();
    ensureLoop();

    // After the slide, check for game over.
    if (isStuck()) endGameSoon();
  }

  let overTimer = null;
  function endGameSoon() { clearTimeout(overTimer); overTimer = setTimeout(() => { if (isStuck()) endGame(); }, 160); }

  function isStuck() {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (!grid[r][c]) return false;
      if (c + 1 < N && grid[r][c] === grid[r][c + 1]) return false;
      if (r + 1 < N && grid[r][c] === grid[r + 1][c]) return false;
    }
    return true;
  }

  function endGame() {
    over = true; running = false;
    SFX_play('over');
    best = Utils.highScore.save('g2048-best', score, best);
    Utils.showGameOver('g2048-overlay', {
      lines: ['Score: ' + score],
      hint: 'Press SPACE or tap to play again',
    });
  }

  const SFX_play = Utils.sfx;

  function updateInfo() {
    const s = document.getElementById('g2048-score'), b = document.getElementById('g2048-best');
    if (s) s.textContent = score;
    if (b) b.textContent = best;
  }

  function cellXY(r, c) { return [PAD + c * (CELL + GAP), PAD + r * (CELL + GAP)]; }

  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  let spawnCell = null, spawnAt = 0;
  let mergedCells = null, mergedAt = 0;

  function ensureLoop() { if (!raf) { lastT = performance.now(); loop(); } }
  function loop() {
    raf = requestAnimationFrame(loop);
    draw();
  }

  function drawTile(x, y, val, scale) {
    const s = CELL * scale, off = (CELL - s) / 2;
    ctx.fillStyle = TILE_COLORS[val] || '#ffd700';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = val >= 128 ? 16 : 8;
    roundRect(x + off, y + off, s, s, 8); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = val <= 4 ? '#dbeafe' : '#0d1117';
    const fs = val < 100 ? 40 : val < 1000 ? 32 : 26;
    ctx.font = '800 ' + Math.round(fs * scale) + 'px JetBrains Mono, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(val), x + CELL / 2, y + CELL / 2 + 1);
  }

  function draw() {
    if (!ctx) return;
    // board bg
    ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, SIZE, SIZE);
    roundRect(2, 2, SIZE - 4, SIZE - 4, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fill();
    // empty cells
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const [x, y] = cellXY(r, c);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      roundRect(x, y, CELL, CELL, 8); ctx.fill();
    }

    const nowMs = performance.now();
    let sliding = false;
    if (anim) {
      const t = Math.min(1, (nowMs - anim.start) / anim.dur);
      const e = ease(t);
      sliding = t < 1;
      for (const m of anim.moves) {
        const [fx, fy] = cellXY(m.fr, m.fc);
        const [tx, ty] = cellXY(m.tr, m.tc);
        drawTile(fx + (tx - fx) * e, fy + (ty - fy) * e, m.val, 1);
      }
      if (!sliding) {
        spawnCell = anim.spawn; spawnAt = nowMs;
        mergedCells = anim.merged && anim.merged.length ? anim.merged : null; mergedAt = nowMs;
        anim = null;
      }
    }

    if (!sliding) {
      const popActive = spawnCell && nowMs - spawnAt < 130;
      const mergePop = mergedCells && nowMs - mergedAt < 160;
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const v = grid[r][c];
        if (!v) continue;
        const [x, y] = cellXY(r, c);
        let scale = 1;
        if (popActive && spawnCell.r === r && spawnCell.c === c) {
          scale = 0.3 + 0.7 * ease((nowMs - spawnAt) / 130);
        } else if (mergePop && mergedCells.some(m => m.r === r && m.c === c)) {
          // Scale-overshoot bounce on the tile the merge landed in.
          scale = 1 + 0.22 * Math.sin(Math.PI * ((nowMs - mergedAt) / 160));
        }
        drawTile(x, y, v, scale);
      }
    }

    // One-time win banner — announces 2048 without ending the run.
    if (winBannerUntil && nowMs < winBannerUntil) {
      ctx.globalAlpha = Math.min(1, (winBannerUntil - nowMs) / 400);
      ctx.fillStyle = 'rgba(13,17,23,0.85)';
      roundRect(SIZE / 2 - 190, SIZE / 2 - 46, 380, 92, 12); ctx.fill();
      ctx.fillStyle = '#ffd700'; ctx.font = "800 26px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('YOU MADE 2048!', SIZE / 2, SIZE / 2 - 12);
      ctx.font = '14px Inter, sans-serif'; ctx.fillStyle = '#E6EDF3';
      ctx.fillText('Keep going?', SIZE / 2, SIZE / 2 + 20);
      ctx.globalAlpha = 1;
    } else if (winBannerUntil && nowMs >= winBannerUntil) {
      winBannerUntil = 0;
    }

    // idle prompt
    if (!running && !over) {
      ctx.fillStyle = 'rgba(13,17,23,0.72)'; ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = '#E6EDF3'; ctx.font = "800 24px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('2048', SIZE / 2, SIZE / 2 - 14);
      ctx.font = '13px Inter, sans-serif'; ctx.fillStyle = '#7D8590';
      ctx.fillText('Swipe or arrow keys to combine tiles', SIZE / 2, SIZE / 2 + 16);
      ctx.fillText('Click or tap to start', SIZE / 2, SIZE / 2 + 38);
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

    // Replay an input that arrived mid-slide, now that the board is settled.
    if (!anim && queuedDir) { const dir = queuedDir; queuedDir = null; move(dir); }

    // Stop the loop when fully static (nothing sliding, no pop or banner in flight).
    const popActive = spawnCell && nowMs - spawnAt < 130;
    const mergePop = mergedCells && nowMs - mergedAt < 160;
    if (!anim && !sliding && !popActive && !mergePop && !winBannerUntil) { cancelAnimationFrame(raf); raf = null; }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function destroy() {
    cancelAnimationFrame(raf); raf = null; clearTimeout(overTimer);
    // The shell re-inits a view only once, and won't redraw on return — so
    // paint the idle "tap to start" state now, else a frozen frame shows.
    running = false; over = false;
    const ov = document.getElementById('g2048-overlay'); if (ov) ov.style.display = 'none';
    draw();
  }

  return { init, start, destroy };
})();
