/* ============================================
   GAME OF LIFE — Conway's cellular automaton
   ============================================ */

const LifeGame = (() => {
  const CELL = 12;
  const COLS = 60;
  const ROWS = 40;
  const WIDTH = COLS * CELL;
  const HEIGHT = ROWS * CELL;

  let canvas, ctx;
  let grid, nextGrid;
  let running = false;
  let generation = 0;
  let population = 0;
  let intervalId = null;
  let speed = 100;
  let drawing = false;
  let erasing = false;

  function init() {
    canvas = document.getElementById('life-canvas');
    if (!canvas) return;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    ctx = canvas.getContext('2d');

    grid = makeGrid();
    nextGrid = makeGrid();

    canvas.addEventListener('mousedown', e => {
      drawing = true;
      const rect = canvas.getBoundingClientRect();
      const c = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width) / CELL);
      const r = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height) / CELL);
      erasing = (r >= 0 && r < ROWS && c >= 0 && c < COLS && grid[r][c] === 1);
      toggleCell(e);
    });
    canvas.addEventListener('mousemove', e => { if (drawing) toggleCell(e); });
    canvas.addEventListener('mouseup', () => drawing = false);
    canvas.addEventListener('mouseleave', () => drawing = false);

    // Touch support
    canvas.addEventListener('touchstart', e => {
      drawing = true;
      const t = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const c = Math.floor((t.clientX - rect.left) * (canvas.width / rect.width) / CELL);
      const r = Math.floor((t.clientY - rect.top) * (canvas.height / rect.height) / CELL);
      erasing = (r >= 0 && r < ROWS && c >= 0 && c < COLS && grid[r][c] === 1);
      toggleCell(t); e.preventDefault();
    });
    canvas.addEventListener('touchmove', e => { if (drawing) toggleCell(e.touches[0]); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchend', () => drawing = false);

    draw();
    updateInfo();
  }

  function makeGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }

  function toggleCell(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const c = Math.floor((e.clientX - rect.left) * scaleX / CELL);
    const r = Math.floor((e.clientY - rect.top) * scaleY / CELL);
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
      grid[r][c] = erasing ? 0 : 1;
      draw();
      updateInfo();
    }
  }

  function step() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const neighbors = countNeighbors(r, c);
        if (grid[r][c] === 1) {
          nextGrid[r][c] = (neighbors === 2 || neighbors === 3) ? 1 : 0;
        } else {
          nextGrid[r][c] = neighbors === 3 ? 1 : 0;
        }
      }
    }
    [grid, nextGrid] = [nextGrid, grid];
    generation++;
    draw();
    updateInfo();
  }

  function countNeighbors(r, c) {
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = (r + dr + ROWS) % ROWS;
        const nc = (c + dc + COLS) % COLS;
        count += grid[nr][nc];
      }
    }
    return count;
  }

  function play() {
    if (running) return;
    running = true;
    intervalId = setInterval(step, speed);
    updatePlayButton();
  }

  function pause() {
    running = false;
    clearInterval(intervalId);
    updatePlayButton();
  }

  function togglePlay() {
    running ? pause() : play();
  }

  function setSpeed(ms) {
    speed = ms;
    if (running) {
      clearInterval(intervalId);
      intervalId = setInterval(step, speed);
    }
  }

  function clear() {
    pause();
    grid = makeGrid();
    generation = 0;
    draw();
    updateInfo();
  }

  function randomize() {
    pause();
    generation = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        grid[r][c] = Math.random() < 0.3 ? 1 : 0;
      }
    }
    draw();
    updateInfo();
  }

  // ---- PRESETS ----
  function loadPreset(name) {
    pause();
    grid = makeGrid();
    generation = 0;

    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);

    const presets = {
      glider: [[0,1],[1,2],[2,0],[2,1],[2,2]],
      blinker: [[0,0],[0,1],[0,2]],
      pulsar: (() => {
        const pts = [];
        const offsets = [
          [-6,-4],[-6,-3],[-6,-2],[-6,2],[-6,3],[-6,4],
          [-4,-6],[-3,-6],[-2,-6],[-4,-1],[-3,-1],[-2,-1],
          [-4,1],[-3,1],[-2,1],[-4,6],[-3,6],[-2,6],
          [-1,-4],[-1,-3],[-1,-2],[-1,2],[-1,3],[-1,4],
          [1,-4],[1,-3],[1,-2],[1,2],[1,3],[1,4],
          [2,-6],[3,-6],[4,-6],[2,-1],[3,-1],[4,-1],
          [2,1],[3,1],[4,1],[2,6],[3,6],[4,6],
          [6,-4],[6,-3],[6,-2],[6,2],[6,3],[6,4],
        ];
        offsets.forEach(([dr, dc]) => pts.push([dr, dc]));
        return pts;
      })(),
      gliderGun: [
        [0,24],[1,22],[1,24],[2,12],[2,13],[2,20],[2,21],[2,34],[2,35],
        [3,11],[3,15],[3,20],[3,21],[3,34],[3,35],[4,0],[4,1],[4,10],
        [4,16],[4,20],[4,21],[5,0],[5,1],[5,10],[5,14],[5,16],[5,17],
        [5,22],[5,24],[6,10],[6,16],[6,24],[7,11],[7,15],[8,12],[8,13],
      ],
      lwss: [[0,1],[0,4],[1,0],[2,0],[2,4],[3,0],[3,1],[3,2],[3,3]],
      pentadecathlon: [
        [0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[7,0],[8,0],[9,0],
        // Actually the pentadecathlon is more nuanced, let's use the cross form
      ],
      beacon: [[0,0],[0,1],[1,0],[2,3],[3,2],[3,3]],
      toad: [[0,1],[0,2],[0,3],[1,0],[1,1],[1,2]],
      rpentomino: [[0,1],[0,2],[1,0],[1,1],[2,1]],
    };

    // Override pentadecathlon with correct pattern
    presets.pentadecathlon = [[0,-1],[0,0],[0,1],[-1,0],[1,0],
      [0,3],[0,4],[0,5],[0,-3],[0,-4],[0,-5],
      [-1,-4],[-1,4],[1,-4],[1,4]];

    const cells = presets[name];
    if (!cells) return;

    // Offset for glider gun (place top-left)
    const offsetR = name === 'gliderGun' ? 5 : cy;
    const offsetC = name === 'gliderGun' ? 2 : cx;

    cells.forEach(([r, c]) => {
      const nr = r + offsetR;
      const nc = c + offsetC;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
        grid[nr][nc] = 1;
      }
    });

    draw();
    updateInfo();
  }

  // ---- DRAWING ----
  function draw() {
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, HEIGHT); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(WIDTH, y * CELL); ctx.stroke();
    }

    // Cells
    population = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] === 1) {
          population++;
          // Color based on neighbor count for visual variety
          const n = countNeighbors(r, c);
          if (n <= 1) ctx.fillStyle = '#F85149';       // dying (underpopulation)
          else if (n === 2) ctx.fillStyle = '#3FB950';  // stable
          else if (n === 3) ctx.fillStyle = '#58A6FF';  // thriving
          else ctx.fillStyle = '#D29922';               // dying (overpopulation)

          ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
        }
      }
    }
  }

  function updateInfo() {
    const genEl = document.getElementById('life-gen');
    const popEl = document.getElementById('life-pop');
    if (genEl) genEl.textContent = generation;
    if (popEl) popEl.textContent = population;
  }

  function updatePlayButton() {
    const btn = document.getElementById('life-play-btn');
    if (btn) btn.textContent = running ? 'Pause' : 'Play';
  }

  function destroy() {
    pause();
  }

  return { init, step, togglePlay, clear, randomize, loadPreset, setSpeed, destroy };
})();
