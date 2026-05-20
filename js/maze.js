/* ============================================
   MAZE — Generator & Solver with animation
   ============================================ */

const MazeGame = (() => {
  const CELL = 16;
  let canvas, ctx;
  let cols, rows;
  let grid;        // 2D array: 0=path, 1=wall
  let solving = false;
  let animFrameId = null;

  // Play mode state
  let playMode = false;
  let player = null;
  let playerStartTime = null;
  let playerSteps = 0;
  let playerWon = false;
  let playerTimerInterval = null;

  function init() {
    canvas = document.getElementById('maze-canvas');
    if (!canvas) return;
    cols = 41;  // must be odd
    rows = 31;  // must be odd
    canvas.width = cols * CELL;
    canvas.height = rows * CELL;
    ctx = canvas.getContext('2d');
    generate();
  }

  // ---- GENERATION (Recursive Backtracking) ----
  function generate() {
    cancelAnimation();
    solving = false;
    stopPlay();
    grid = Array.from({ length: rows }, () => Array(cols).fill(1));

    const stack = [];
    const startR = 1, startC = 1;
    grid[startR][startC] = 0;
    stack.push([startR, startC]);

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

      if (neighbors.length === 0) {
        stack.pop();
      } else {
        const [nr, nc, wr, wc] = neighbors[Math.floor(Math.random() * neighbors.length)];
        grid[wr][wc] = 0;
        grid[nr][nc] = 0;
        stack.push([nr, nc]);
      }
    }

    // Ensure start and end are open
    grid[1][0] = 0;               // entrance
    grid[rows - 2][cols - 1] = 0; // exit

    draw();
    updateStatus('Maze generated. Choose an algorithm and solve!');
  }

  // ---- PLAY MODE ----
  function startPlay() {
    if (playMode) {
      stopPlay();
      return;
    }
    if (solving) return;

    playMode = true;
    playerWon = false;
    player = { r: 1, c: 0 };
    playerStartTime = Date.now();
    playerSteps = 0;

    document.addEventListener('keydown', handlePlayerKey);
    playerTimerInterval = setInterval(updatePlayInfo, 200);

    const btn = document.getElementById('maze-play-btn');
    if (btn) { btn.textContent = 'Give Up'; btn.style.borderColor = '#F85149'; btn.style.color = '#F85149'; }

    updatePlayInfo();
    draw();
    updateStatus('Find the pink dot! Arrow keys or WASD to move.');
  }

  function stopPlay() {
    if (!playMode) return;
    playMode = false;
    player = null;
    clearInterval(playerTimerInterval);
    document.removeEventListener('keydown', handlePlayerKey);

    const btn = document.getElementById('maze-play-btn');
    if (btn) { btn.textContent = 'Play Mode'; btn.style.borderColor = ''; btn.style.color = ''; }

    const info = document.getElementById('maze-play-info');
    if (info) info.style.display = 'none';

    draw();
    if (!playerWon) updateStatus('Maze generated. Choose an algorithm and solve!');
  }

  function handlePlayerKey(e) {
    if (!playMode || playerWon) return;
    const dirs = { ArrowUp: [-1, 0], w: [-1, 0], W: [-1, 0],
                   ArrowDown: [1, 0],  s: [1, 0],  S: [1, 0],
                   ArrowLeft: [0, -1], a: [0, -1], A: [0, -1],
                   ArrowRight: [0, 1], d: [0, 1],  D: [0, 1] };
    if (!dirs[e.key]) return;
    e.preventDefault();

    const [dr, dc] = dirs[e.key];
    const nr = player.r + dr, nc = player.c + dc;
    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return;
    if (grid[nr][nc] === 1) return;

    player = { r: nr, c: nc };
    playerSteps++;
    updatePlayInfo();
    draw();

    if (nr === rows - 2 && nc === cols - 1) {
      playerWon = true;
      clearInterval(playerTimerInterval);
      const elapsed = ((Date.now() - playerStartTime) / 1000).toFixed(1);
      updateStatus(`You solved it in ${elapsed}s with ${playerSteps} steps!`);

      const btn = document.getElementById('maze-play-btn');
      if (btn) { btn.textContent = 'Play Mode'; btn.style.borderColor = ''; btn.style.color = ''; }
      playMode = false;
      document.removeEventListener('keydown', handlePlayerKey);
    }
  }

  function drawPlayer() {
    if (!player) return;
    const x = player.c * CELL + CELL / 2;
    const y = player.r * CELL + CELL / 2;
    ctx.fillStyle = '#3FB950';
    ctx.shadowColor = '#3FB950';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(x, y, CELL / 2 - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function updatePlayInfo() {
    const el = document.getElementById('maze-play-info');
    if (!el) return;
    if (!playMode) { el.style.display = 'none'; return; }
    const elapsed = ((Date.now() - playerStartTime) / 1000).toFixed(1);
    el.style.display = '';
    el.textContent = `Time: ${elapsed}s · Steps: ${playerSteps}`;
  }

  // ---- SOLVING ----
  async function solve(algorithm) {
    if (solving || playMode) return;
    solving = true;

    // Reset visited/solution display
    const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
    const parent = Array.from({ length: rows }, () => Array(cols).fill(null));

    const startR = 1, startC = 0;
    const endR = rows - 2, endC = cols - 1;

    let found = false;

    updateStatus(`Solving with ${algorithm.toUpperCase()}...`);

    if (algorithm === 'bfs') {
      found = await solveBFS(startR, startC, endR, endC, visited, parent);
    } else if (algorithm === 'dfs') {
      found = await solveDFS(startR, startC, endR, endC, visited, parent);
    } else if (algorithm === 'astar') {
      found = await solveAStar(startR, startC, endR, endC, visited, parent);
    }

    if (found) {
      // Trace solution path
      const path = [];
      let cur = [endR, endC];
      while (cur) {
        path.push(cur);
        cur = parent[cur[0]][cur[1]];
      }
      path.reverse();
      await animateSolution(path, visited);
      updateStatus(`Solved with ${algorithm.toUpperCase()}! Path length: ${path.length}`);
    } else {
      updateStatus('No solution found (this shouldn\'t happen!)');
    }

    solving = false;
  }

  async function solveBFS(sr, sc, er, ec, visited, parent) {
    const queue = [[sr, sc]];
    visited[sr][sc] = true;
    const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    let steps = 0;

    while (queue.length > 0) {
      const [r, c] = queue.shift();
      if (r === er && c === ec) return true;

      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
            !visited[nr][nc] && grid[nr][nc] === 0) {
          visited[nr][nc] = true;
          parent[nr][nc] = [r, c];
          queue.push([nr, nc]);
        }
      }

      steps++;
      if (steps % 4 === 0) {
        drawWithVisited(visited, []);
        await delay(10);
        if (!solving) return false;
      }
    }
    return false;
  }

  async function solveDFS(sr, sc, er, ec, visited, parent) {
    const stack = [[sr, sc]];
    visited[sr][sc] = true;
    const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    let steps = 0;

    while (stack.length > 0) {
      const [r, c] = stack.pop();
      if (r === er && c === ec) return true;

      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
            !visited[nr][nc] && grid[nr][nc] === 0) {
          visited[nr][nc] = true;
          parent[nr][nc] = [r, c];
          stack.push([nr, nc]);
        }
      }

      steps++;
      if (steps % 3 === 0) {
        drawWithVisited(visited, []);
        await delay(10);
        if (!solving) return false;
      }
    }
    return false;
  }

  async function solveAStar(sr, sc, er, ec, visited, parent) {
    const heuristic = (r, c) => Math.abs(r - er) + Math.abs(c - ec);
    const gScore = Array.from({ length: rows }, () => Array(cols).fill(Infinity));
    gScore[sr][sc] = 0;

    // Simple priority queue using sorted array
    const open = [{ r: sr, c: sc, f: heuristic(sr, sc) }];
    visited[sr][sc] = true;
    const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    let steps = 0;

    while (open.length > 0) {
      open.sort((a, b) => a.f - b.f);
      const { r, c } = open.shift();

      if (r === er && c === ec) return true;

      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] === 0) {
          const ng = gScore[r][c] + 1;
          if (ng < gScore[nr][nc]) {
            gScore[nr][nc] = ng;
            parent[nr][nc] = [r, c];
            visited[nr][nc] = true;
            open.push({ r: nr, c: nc, f: ng + heuristic(nr, nc) });
          }
        }
      }

      steps++;
      if (steps % 4 === 0) {
        drawWithVisited(visited, []);
        await delay(10);
        if (!solving) return false;
      }
    }
    return false;
  }

  async function animateSolution(path, visited) {
    for (let i = 0; i < path.length; i++) {
      drawWithVisited(visited, path.slice(0, i + 1));
      await delay(15);
      if (!solving) return;
    }
  }

  const delay = Utils.delay;

  // ---- DRAWING ----
  function draw() {
    drawWithVisited(null, []);
    if (playMode && player) drawPlayer();
  }

  function drawWithVisited(visited, solution) {
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * CELL, y = r * CELL;

        if (grid[r][c] === 1) {
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fillRect(x, y, CELL, CELL);
        } else if (visited && visited[r][c]) {
          ctx.fillStyle = 'rgba(88, 166, 255, 0.2)';
          ctx.fillRect(x, y, CELL, CELL);
        }
      }
    }

    // Draw solution path
    if (solution && solution.length > 0) {
      for (const [r, c] of solution) {
        ctx.fillStyle = '#6C63FF';
        ctx.shadowColor = '#6C63FF';
        ctx.shadowBlur = 4;
        ctx.fillRect(c * CELL + 2, r * CELL + 2, CELL - 4, CELL - 4);
      }
      ctx.shadowBlur = 0;
    }

    // Start and end markers
    ctx.fillStyle = '#6C63FF';
    ctx.shadowColor = '#6C63FF';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0 * CELL + CELL / 2, 1 * CELL + CELL / 2, CELL / 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#F778BA';
    ctx.shadowColor = '#F778BA';
    ctx.beginPath();
    ctx.arc((cols - 1) * CELL + CELL / 2, (rows - 2) * CELL + CELL / 2, CELL / 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function cancelAnimation() {
    solving = false;
  }

  function updateStatus(msg) {
    const el = document.getElementById('maze-status');
    if (el) el.textContent = msg;
  }

  function destroy() {
    cancelAnimation();
  }

  return { init, generate, solve, startPlay, destroy };
})();
