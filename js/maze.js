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

  // ---- SOLVING ----
  async function solve(algorithm) {
    if (solving) return;
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

  return { init, generate, solve, destroy };
})();
