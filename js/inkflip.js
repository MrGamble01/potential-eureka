/* Inkflip — a one-player reversi table.
   You play the dark discs. The house plays the light ones.
   Corners are worth taking. The journal of the best finish
   stays in this browser. No network, no key. */

const InkflipGame = (() => {
  const N = 8;
  const SIZE = 560;
  const CELL = SIZE / N;
  const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const ME = 1;
  const THEM = 2;

  let canvas, ctx, loop;
  let board, cursor, turn, paused, over, thinking, best, mine, theirs;
  let flips = [];
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init() {
    canvas = document.getElementById('inkflip-canvas');
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    canvas.style.width = '100%';
    canvas.style.maxWidth = SIZE + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    best = Utils.highScore.load('inkflip-best');
    reset(false);
    updateInfo();
    canvas.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', Utils.whenViewActive('view-inkflip', onKey));
    loop = Utils.gameLoop(tick);
    loop.start();
    draw();
  }

  function emptyBoard() {
    const next = Array.from({ length: N }, () => Array(N).fill(0));
    next[3][3] = THEM;
    next[3][4] = ME;
    next[4][3] = ME;
    next[4][4] = THEM;
    return next;
  }

  function reset(run) {
    board = emptyBoard();
    cursor = { r: 2, c: 3 };
    turn = ME;
    paused = false;
    over = false;
    thinking = 0;
    flips = [];
    syncPause();
    tally();
    const ov = document.getElementById('inkflip-overlay');
    if (ov) ov.style.display = 'none';
    if (run) Utils.sfx('start');
  }

  function start() {
    reset(true);
    updateInfo();
    if (loop) loop.start();
    draw();
  }

  function resume() {
    if (loop) loop.start();
    draw();
  }

  function togglePause() {
    if (over) return;
    paused = !paused;
    syncPause();
    draw();
  }

  function restart() { start(); }

  function syncPause() {
    const btn = document.getElementById('inkflip-pause');
    if (btn) btn.textContent = paused ? 'Resume' : 'Pause';
  }

  function onKey(e) {
    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); togglePause(); return; }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); restart(); return; }
    if (paused || over || turn !== ME || flips.length) return;
    if (e.key === 'ArrowUp') { cursor.r = (cursor.r + N - 1) % N; e.preventDefault(); }
    else if (e.key === 'ArrowDown') { cursor.r = (cursor.r + 1) % N; e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { cursor.c = (cursor.c + N - 1) % N; e.preventDefault(); }
    else if (e.key === 'ArrowRight') { cursor.c = (cursor.c + 1) % N; e.preventDefault(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); place(cursor.r, cursor.c); }
    draw();
  }

  function onPointer(e) {
    if (paused || over || turn !== ME || flips.length) return;
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * SIZE;
    const y = (e.clientY - r.top) / r.height * SIZE;
    const c = Math.floor(x / CELL);
    const row = Math.floor(y / CELL);
    if (row < 0 || c < 0 || row >= N || c >= N) return;
    cursor = { r: row, c };
    place(row, c);
  }

  function captured(grid, row, col, who) {
    if (grid[row][col] !== 0) return [];
    const foe = who === ME ? THEM : ME;
    const out = [];
    for (const [dr, dc] of DIRS) {
      const line = [];
      let r = row + dr;
      let c = col + dc;
      while (r >= 0 && c >= 0 && r < N && c < N && grid[r][c] === foe) {
        line.push([r, c]);
        r += dr;
        c += dc;
      }
      if (line.length && r >= 0 && c >= 0 && r < N && c < N && grid[r][c] === who) out.push(...line);
    }
    return out;
  }

  function legal(who) {
    const moves = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const got = captured(board, r, c, who);
        if (got.length) moves.push({ r, c, n: got.length, cells: got });
      }
    }
    return moves;
  }

  function place(row, col) {
    const cells = captured(board, row, col, ME);
    if (!cells.length) {
      Utils.sfx('move');
      return;
    }
    board[row][col] = ME;
    beginFlip(cells, THEM);
    Utils.sfx('lock');
    afterMove(ME);
  }

  function houseMove() {
    const moves = legal(THEM);
    if (!moves.length) { passOrEnd(); return; }
    let bestMove = moves[0];
    let score = -999;
    for (const move of moves) {
      let s = move.n;
      const corner = (move.r === 0 || move.r === 7) && (move.c === 0 || move.c === 7);
      const beside = (move.r <= 1 || move.r >= 6) && (move.c <= 1 || move.c >= 6);
      if (corner) s += 40;
      else if (beside) s -= 12;
      if (s > score) { score = s; bestMove = move; }
    }
    board[bestMove.r][bestMove.c] = THEM;
    beginFlip(bestMove.cells, ME);
    Utils.sfx('bounce');
    afterMove(THEM);
  }

  function beginFlip(cells, from) {
    const to = from === ME ? THEM : ME;
    for (const [r, c] of cells) board[r][c] = to;
    flips = reduce() ? [] : cells.map(([r, c]) => ({ r, c, from, to, t: 0 }));
    tally();
  }

  function afterMove(who) {
    tally();
    const next = who === ME ? THEM : ME;
    if (legal(next).length) {
      turn = next;
      if (next === THEM && !flips.length) thinking = 18;
    } else if (legal(who).length) {
      turn = who;
      if (who === THEM && !flips.length) thinking = 18;
    } else finish();
    updateInfo();
    draw();
  }

  function passOrEnd() {
    if (legal(ME).length) { turn = ME; updateInfo(); }
    else finish();
  }

  function tally() {
    mine = 0;
    theirs = 0;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (board[r][c] === ME) mine++;
        else if (board[r][c] === THEM) theirs++;
      }
    }
  }

  function finish() {
    over = true;
    turn = 0;
    tally();
    if (mine > best) best = Utils.highScore.save('inkflip-best', mine, best);
    Utils.sfx(mine > theirs ? 'clear' : 'over');
    Utils.showGameOver('inkflip-overlay', {
      lines: [
        mine > theirs ? 'The dark holds the board.' : mine < theirs ? 'The light keeps the board.' : 'The board is split.',
        mine + ' dark · ' + theirs + ' light',
        'Best finish: ' + best,
      ],
      hint: 'Restart deals a fresh table',
    });
    updateInfo();
  }

  function tick() {
    if (flips.length) {
      let live = false;
      for (const disc of flips) {
        disc.t += 0.12;
        if (disc.t < 1) live = true;
      }
      if (!live) {
        flips = [];
        if (turn === THEM && !over && !paused) thinking = 14;
        updateInfo();
      }
      draw();
      return;
    }
    if (paused || over) { draw(); return; }
    if (turn === THEM && thinking > 0) {
      thinking -= 1;
      if (thinking <= 0) houseMove();
    }
    draw();
  }

  function updateInfo() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('inkflip-you', mine || 0);
    set('inkflip-them', theirs || 0);
    set('inkflip-best', best || 0);
    set('inkflip-turn', over ? 'Done' : paused ? 'Paused' : turn === ME ? 'You' : 'House');
  }

  function draw() {
    if (!ctx) return;
    ctx.fillStyle = '#10140f';
    ctx.fillRect(0, 0, SIZE, SIZE);
    const moves = (!over && turn === ME) ? legal(ME) : [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const x = c * CELL;
        const y = r * CELL;
        ctx.fillStyle = (r + c) % 2 ? '#1a3a2a' : '#163226';
        ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
        const legalHere = moves.some(m => m.r === r && m.c === c);
        if (legalHere) {
          ctx.fillStyle = 'rgba(227,179,65,0.45)';
          ctx.beginPath();
          ctx.arc(x + CELL / 2, y + CELL / 2, 6, 0, Math.PI * 2);
          ctx.fill();
        }
        const flipping = flips.find(d => d.r === r && d.c === c);
        const disc = flipping ? (flipping.t < 0.5 ? flipping.from : flipping.to) : board[r][c];
        if (disc) {
          const who = disc;
          const squash = flipping ? Math.abs(Math.cos(flipping.t * Math.PI)) : 1;
          ctx.save();
          ctx.translate(x + CELL / 2, y + CELL / 2);
          ctx.scale(1, Math.max(0.08, squash));
          ctx.beginPath();
          ctx.arc(0, 0, CELL * 0.34, 0, Math.PI * 2);
          ctx.fillStyle = who === ME ? '#14181f' : '#f4efe4';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = who === ME ? '#3a4454' : '#e3b341';
          ctx.stroke();
          ctx.restore();
        }
      }
    }
    if (!over && turn === ME) {
      ctx.strokeStyle = '#e3b341';
      ctx.lineWidth = 3;
      ctx.strokeRect(cursor.c * CELL + 4, cursor.r * CELL + 4, CELL - 8, CELL - 8);
    }
    if (paused) {
      ctx.fillStyle = 'rgba(7,8,13,0.55)';
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = '#e6edf3';
      ctx.font = '600 28px Outfit, Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Paused', SIZE / 2, SIZE / 2);
      ctx.textAlign = 'left';
    }
  }

  function destroy() {
    if (loop) loop.stop();
    paused = false;
    over = false;
    const ov = document.getElementById('inkflip-overlay');
    if (ov) ov.style.display = 'none';
    reset(false);
    updateInfo();
    draw();
  }

  return { init, start, resume, destroy, togglePause, restart };
})();
