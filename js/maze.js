/* ============================================
   MAZE RUNNER — playable maze + AI-solve demo
   Navigate the runner to the exit, grab the gems,
   beat the clock. "Watch AI Solve" keeps the old
   BFS/DFS/A* visualizer as a secondary mode.
   ============================================ */

const MazeGame = (() => {
  const CELL = 16;
  const COLS = 31;   // must be odd
  const ROWS = 21;   // must be odd
  const W = COLS * CELL, H = ROWS * CELL;

  let canvas, ctx;
  let cols = COLS, rows = ROWS;
  let grid;          // 2D array: 0=path, 1=wall
  let solving = false;
  let solveRun = 0;  // monotonic token — invalidates stale solve coroutines

  // --- game state ---
  let player, goal, gems, level, score, best, collected;
  let elapsed, playing, won, fog, visionR;
  const viewActive = () => {
    const v = document.getElementById('view-maze');
    return v && v.classList.contains('active');
  };
  let bump = 0;      // brief red-flash timer when you walk into a wall
  let winFlash = 0;
  let sparks = [];
  let rafId = null;
  const held = {};

  const sfx = Utils.sfx;

  function init() {
    canvas = document.getElementById('maze-canvas');
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    best = Utils.highScore.load('maze-best');

    document.addEventListener('keydown', Utils.whenViewActive('view-maze', onKey));
    bindSwipe();
    newGame();
    startLoop();
  }

  // ---- GENERATION (Recursive Backtracking) ----
  function generateGrid() {
    grid = Array.from({ length: rows }, () => Array(cols).fill(1));
    const stack = [];
    grid[1][1] = 0;
    stack.push([1, 1]);
    const dirs = [[0, 2], [2, 0], [0, -2], [-2, 0]];

    while (stack.length > 0) {
      const [r, c] = stack[stack.length - 1];
      const neighbors = [];
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (nr > 0 && nr < rows - 1 && nc > 0 && nc < cols - 1 && grid[nr][nc] === 1) {
          neighbors.push([nr, nc, r + dr / 2, c + dc / 2]);
        }
      }
      if (neighbors.length === 0) { stack.pop(); }
      else {
        const [nr, nc, wr, wc] = neighbors[Math.floor(Math.random() * neighbors.length)];
        grid[wr][wc] = 0;
        grid[nr][nc] = 0;
        stack.push([nr, nc]);
      }
    }
    grid[1][0] = 0;               // entrance
    grid[rows - 2][cols - 1] = 0; // exit
  }

  // Called by the "Generate New" / regenerate button — starts a fresh run.
  function generate() { newGame(); }

  function newGame() {
    level = 1; score = 0;
    buildLevel();
    updateStatus();
  }

  function buildLevel() {
    cancelSolve();
    solving = false;
    generateGrid();
    player = { r: 1, c: 0 };
    goal = { r: rows - 2, c: cols - 1 };
    fog = level >= 3;
    visionR = Math.max(3.5, 7 - (level - 3) * 0.6);   // shrinks as levels climb

    // Scatter gems on open path cells, away from start/goal.
    gems = [];
    const open = [];
    for (let r = 0; r < rows; r++)
      for (let c = 1; c < cols - 1; c++)
        if (grid[r][c] === 0 && !(r === player.r && Math.abs(c - player.c) < 3)) open.push([r, c]);
    const nGems = Math.min(open.length, 4 + level);
    for (let i = 0; i < nGems && open.length; i++) {
      const idx = Math.floor(Math.random() * open.length);
      const [r, c] = open.splice(idx, 1)[0];
      gems.push({ r, c });
    }
    collected = 0;
    elapsed = 0;
    playing = true; won = false;
    bump = 0; winFlash = 0; sparks = [];
  }

  // ---- INPUT ----
  function onKey(e) {
    const k = e.key.toLowerCase();
    const map = { arrowup: [-1, 0], w: [-1, 0], arrowdown: [1, 0], s: [1, 0],
                  arrowleft: [0, -1], a: [0, -1], arrowright: [0, 1], d: [0, 1] };
    if (map[k]) { move(map[k][0], map[k][1]); e.preventDefault(); }
    else if (k === 'n') { newGame(); e.preventDefault(); }
  }

  function move(dr, dc) {
    if (!playing || solving) return;
    const nr = player.r + dr, nc = player.c + dc;
    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return;
    if (grid[nr][nc] !== 0) { bump = 8; sfx('move'); return; }
    player.r = nr; player.c = nc;

    // Gem?
    for (let i = gems.length - 1; i >= 0; i--) {
      if (gems[i].r === nr && gems[i].c === nc) {
        gems.splice(i, 1);
        collected++;
        score += 25;
        sfx('eat');
        spark(nc, nr, '#F7C948', 10);
        updateStatus();
      }
    }
    // Reached the exit?
    if (nr === goal.r && nc === goal.c) winLevel();
  }

  function winLevel() {
    playing = false; won = true;
    const secs = elapsed / 1000;
    const timeBonus = Math.max(40, Math.round(600 - secs * 12));
    const gemBonus = collected * 25;
    const allGems = gems.length === 0 ? 150 : 0;   // clean sweep bonus
    score += timeBonus + gemBonus + level * 30 + allGems;
    best = Utils.highScore.save('maze-best', score, best);
    sfx('bonus');
    Effects.shakeCanvas(canvas, 6, 300);
    winFlash = 40;
    spark(goal.c, goal.r, '#3FB950', 24);
    updateStatus('🎉 Level ' + level + ' cleared! +' + (timeBonus + gemBonus + level * 30 + allGems));
    level++;
    setTimeout(() => buildLevel(), 900);
  }

  function spark(c, r, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 0.5 + Math.random() * 2.2;
      sparks.push({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 18 + Math.random() * 14, color });
    }
  }

  function bindSwipe() {
    let sx = 0, sy = 0, active = false;
    canvas.addEventListener('touchstart', e => { active = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY; e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchmove', e => {
      if (!active) return;
      const dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
      if (Math.hypot(dx, dy) < 24) return;
      active = false;
      if (Math.abs(dx) > Math.abs(dy)) move(0, dx > 0 ? 1 : -1);
      else move(dy > 0 ? 1 : -1, 0);
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', () => { active = false; });
  }

  // ---- SOLVING (AI demo — secondary "Watch AI Solve" mode) ----
  async function solve(algorithm) {
    if (solving) return;
    playing = false;              // pause the runner while the AI demos
    solving = true;
    const myRun = ++solveRun;
    const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
    const parent = Array.from({ length: rows }, () => Array(cols).fill(null));
    const sr = 1, sc = 0, er = rows - 2, ec = cols - 1;
    let found = false;
    updateStatus('🤖 ' + algorithm.toUpperCase() + ' solving…');

    if (algorithm === 'bfs') found = await solveBFS(myRun, sr, sc, er, ec, visited, parent);
    else if (algorithm === 'dfs') found = await solveDFS(myRun, sr, sc, er, ec, visited, parent);
    else if (algorithm === 'astar') found = await solveAStar(myRun, sr, sc, er, ec, visited, parent);

    if (myRun !== solveRun) return;
    if (found) {
      const path = [];
      let cur = [er, ec];
      while (cur) { path.push(cur); cur = parent[cur[0]][cur[1]]; }
      path.reverse();
      await animateSolution(myRun, path, visited);
      if (myRun !== solveRun) return;
      updateStatus('🤖 ' + algorithm.toUpperCase() + ' path: ' + path.length + ' steps. Press N for a new game.');
    }
    solving = false;
    solveVisited = null; solvePath = null;
  }

  // The solver draws through these shared buffers so the main render loop
  // (which owns the canvas) can paint them without a competing draw call.
  let solveVisited = null, solvePath = null;

  async function solveBFS(myRun, sr, sc, er, ec, visited, parent) {
    const queue = [[sr, sc]]; visited[sr][sc] = true;
    const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]]; let steps = 0;
    while (queue.length) {
      const [r, c] = queue.shift();
      if (r === er && c === ec) return true;
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc] && grid[nr][nc] === 0) {
          visited[nr][nc] = true; parent[nr][nc] = [r, c]; queue.push([nr, nc]);
        }
      }
      if (++steps % 4 === 0) { solveVisited = visited; await delay(10); if (myRun !== solveRun) return false; }
    }
    return false;
  }

  async function solveDFS(myRun, sr, sc, er, ec, visited, parent) {
    const stack = [[sr, sc]]; visited[sr][sc] = true;
    const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]]; let steps = 0;
    while (stack.length) {
      const [r, c] = stack.pop();
      if (r === er && c === ec) return true;
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc] && grid[nr][nc] === 0) {
          visited[nr][nc] = true; parent[nr][nc] = [r, c]; stack.push([nr, nc]);
        }
      }
      if (++steps % 3 === 0) { solveVisited = visited; await delay(10); if (myRun !== solveRun) return false; }
    }
    return false;
  }

  async function solveAStar(myRun, sr, sc, er, ec, visited, parent) {
    const heuristic = (r, c) => Math.abs(r - er) + Math.abs(c - ec);
    const gScore = Array.from({ length: rows }, () => Array(cols).fill(Infinity));
    gScore[sr][sc] = 0;
    const open = [{ r: sr, c: sc, f: heuristic(sr, sc) }]; visited[sr][sc] = true;
    const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]]; let steps = 0;
    while (open.length) {
      open.sort((a, b) => a.f - b.f);
      const { r, c } = open.shift();
      if (r === er && c === ec) return true;
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] === 0) {
          const ng = gScore[r][c] + 1;
          if (ng < gScore[nr][nc]) {
            gScore[nr][nc] = ng; parent[nr][nc] = [r, c]; visited[nr][nc] = true;
            open.push({ r: nr, c: nc, f: ng + heuristic(nr, nc) });
          }
        }
      }
      if (++steps % 4 === 0) { solveVisited = visited; await delay(10); if (myRun !== solveRun) return false; }
    }
    return false;
  }

  async function animateSolution(myRun, path, visited) {
    for (let i = 0; i < path.length; i++) {
      solveVisited = visited; solvePath = path.slice(0, i + 1);
      await delay(15);
      if (myRun !== solveRun) return;
    }
  }

  const delay = Utils.delay;

  // ---- MAIN LOOP + DRAW ----
  function startLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    let last = performance.now();
    const frame = (now) => {
      const dt = now - last; last = now;
      rafId = requestAnimationFrame(frame);
      // Loop lives for the page's lifetime (init runs once). Skip all work
      // while the maze view is hidden — and accumulate elapsed time only
      // while active, so leaving the view pauses the timer instead of
      // letting wall-clock run on in the background.
      if (!viewActive()) return;
      if (playing && !solving) elapsed += dt;
      if (bump > 0) bump -= 1;
      if (winFlash > 0) winFlash -= 1;
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx; s.y += s.vy; s.vy += 0.04; s.life -= 1;
        if (s.life <= 0) sparks.splice(i, 1);
      }
      draw();
    };
    rafId = requestAnimationFrame(frame);
  }

  function draw() {
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, W, H);

    const vis = solving ? solveVisited : null;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * CELL, y = r * CELL;
        if (grid[r][c] === 1) {
          ctx.fillStyle = bump > 0 ? 'rgba(248,81,73,0.16)' : 'rgba(255,255,255,0.08)';
          ctx.fillRect(x, y, CELL, CELL);
        } else if (vis && vis[r][c]) {
          ctx.fillStyle = 'rgba(88,166,255,0.22)';
          ctx.fillRect(x, y, CELL, CELL);
        }
      }
    }

    // AI solution path (demo mode)
    if (solving && solvePath) {
      for (const [r, c] of solvePath) {
        ctx.fillStyle = '#6C63FF'; ctx.shadowColor = '#6C63FF'; ctx.shadowBlur = 4;
        ctx.fillRect(c * CELL + 2, r * CELL + 2, CELL - 4, CELL - 4);
      }
      ctx.shadowBlur = 0;
    }

    // Gems
    for (const g of gems) {
      const cx = g.c * CELL + CELL / 2, cy = g.r * CELL + CELL / 2;
      ctx.fillStyle = '#F7C948'; ctx.shadowColor = '#F7C948'; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 5); ctx.lineTo(cx + 5, cy); ctx.lineTo(cx, cy + 5); ctx.lineTo(cx - 5, cy);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Goal
    ctx.fillStyle = '#F778BA'; ctx.shadowColor = '#F778BA'; ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(goal.c * CELL + CELL / 2, goal.r * CELL + CELL / 2, CELL / 2.6, 0, Math.PI * 2);
    ctx.fill(); ctx.shadowBlur = 0;

    // Player
    if (!solving) {
      ctx.fillStyle = '#3FB950'; ctx.shadowColor = '#3FB950'; ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(player.c * CELL + CELL / 2, player.r * CELL + CELL / 2, CELL / 2.4, 0, Math.PI * 2);
      ctx.fill(); ctx.shadowBlur = 0;
    }

    // Sparks
    for (const s of sparks) {
      ctx.globalAlpha = Math.max(0, s.life / 24);
      ctx.fillStyle = s.color; ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;

    // Fog of war (higher levels) — darken cells beyond the runner's vision.
    if (fog && !solving) {
      const pc = player.c * CELL + CELL / 2, pr = player.r * CELL + CELL / 2;
      const grad = ctx.createRadialGradient(pc, pr, visionR * CELL * 0.4, pc, pr, visionR * CELL);
      grad.addColorStop(0, 'rgba(13,17,23,0)');
      grad.addColorStop(1, 'rgba(13,17,23,0.97)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // Win flash sweep
    if (winFlash > 0) {
      ctx.fillStyle = 'rgba(63,185,80,' + (winFlash / 40 * 0.25) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  function fmtTime(ms) {
    const s = ms / 1000;
    return s.toFixed(1) + 's';
  }

  function updateStatus(msg) {
    const el = document.getElementById('maze-status');
    if (!el) return;
    if (msg) { el.innerHTML = msg; return; }
    el.innerHTML = '<b style="color:#3FB950">LV ' + level + '</b> &nbsp;·&nbsp; ' +
      'Score <b>' + score + '</b> &nbsp;·&nbsp; ' +
      'Best <b style="color:#F7C948">' + best + '</b> &nbsp;·&nbsp; ' +
      '💎 ' + collected + '/' + (collected + gems.length) +
      (fog ? ' &nbsp;·&nbsp; <span style="color:#F778BA">🔦 dark</span>' : '');
  }

  // The status bar shows live time via this cheap ticker so we don't rebuild
  // the whole string every frame.
  setInterval(() => {
    if (!playing || !viewActive()) return;
    const el = document.getElementById('maze-time');
    if (el) el.textContent = fmtTime(elapsed);
  }, 100);

  function cancelSolve() {
    solving = false;
    solveRun++;
    solveVisited = null; solvePath = null;
  }

  function destroy() {
    // Stop any AI-solve demo, but LEAVE the render loop + `playing` alone:
    // init() runs only once, so the loop must survive view switches (it
    // no-ops while hidden via viewActive()). The runner resumes right where
    // you left it when you come back.
    cancelSolve();
  }

  return { init, generate, newGame, solve, destroy };
})();
