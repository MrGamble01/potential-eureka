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
  // Parallel age buffer: how many generations each live cell has survived.
  // Kept separate from `grid` (which stays strictly 0/1) so neighbour
  // counting is unaffected — the age only drives colour.
  let age, nextAge;
  let running = false;
  let generation = 0;
  let population = 0;
  let intervalId = null;
  let speed = 100;
  let drawing = false;
  let popHistory = [];   // recent population, for the sparkline

  // Age → colour ramp: newborns burn bright cyan-white; survivors cool
  // through green and blue; long-lived still-lifes settle into deep violet.
  // So gliders (forever young) shimmer while stable structures glow old.
  function ageColor(a) {
    if (a <= 1) return '#eaffff';
    if (a === 2) return '#7ef0d0';
    if (a <= 4) return '#3FB950';
    if (a <= 8) return '#58A6FF';
    if (a <= 16) return '#7c7cff';
    return '#a06cff';
  }

  function init() {
    canvas = document.getElementById('life-canvas');
    if (!canvas) return;
    // Size the backing store to CSS px * devicePixelRatio for crisp HiDPI
    // rendering; game logic keeps using WIDTH/HEIGHT (CSS/logical) coords.
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    canvas.style.width = WIDTH + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    grid = makeGrid();
    nextGrid = makeGrid();
    age = makeGrid();
    nextAge = makeGrid();

    canvas.addEventListener('mousedown', e => { drawing = true; toggleCell(e); });
    canvas.addEventListener('mousemove', e => { if (drawing) toggleCell(e); });
    canvas.addEventListener('mouseup', () => drawing = false);
    canvas.addEventListener('mouseleave', () => drawing = false);

    // Touch support
    canvas.addEventListener('touchstart', e => { drawing = true; toggleCell(e.touches[0]); e.preventDefault(); });
    canvas.addEventListener('touchmove', e => { if (drawing) toggleCell(e.touches[0]); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchend', () => drawing = false);
    canvas.addEventListener('touchcancel', () => drawing = false);

    draw();
    updateInfo();
  }

  function makeGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }

  function toggleCell(e) {
    const rect = canvas.getBoundingClientRect();
    // Use logical WIDTH/HEIGHT (not the DPR-scaled backing store) so the
    // click-to-cell mapping isn't thrown off by devicePixelRatio.
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    const c = Math.floor((e.clientX - rect.left) * scaleX / CELL);
    const r = Math.floor((e.clientY - rect.top) * scaleY / CELL);
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
      grid[r][c] = 1;
      if (!age[r][c]) age[r][c] = 1;
      draw();
      updateInfo();
    }
  }

  function step() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const neighbors = countNeighbors(r, c);
        const alive = grid[r][c] === 1
          ? (neighbors === 2 || neighbors === 3)
          : neighbors === 3;
        nextGrid[r][c] = alive ? 1 : 0;
        // Survivors age up (capped); newborns start at 1; dead cells reset.
        nextAge[r][c] = alive ? (grid[r][c] === 1 ? Math.min(age[r][c] + 1, 99) : 1) : 0;
      }
    }
    [grid, nextGrid] = [nextGrid, grid];
    [age, nextAge] = [nextAge, age];
    generation++;
    draw();
    updateInfo();
    popHistory.push(population);
    if (popHistory.length > 120) popHistory.shift();
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

  // After any bulk board edit, seed each live cell's age to 1 so the colour
  // ramp starts fresh, and reset the sparkline history.
  function syncAge() {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) age[r][c] = grid[r][c] ? 1 : 0;
    popHistory = [];
  }

  function clear() {
    pause();
    grid = makeGrid();
    generation = 0;
    syncAge();
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
    syncAge();
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

    syncAge();
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

    // Cells — coloured by age, with newborns getting a soft glow so births
    // and gliders visibly shimmer against long-lived structures.
    population = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] === 1) {
          population++;
          const a = age[r][c] || 1;
          ctx.fillStyle = ageColor(a);
          if (a <= 1) { ctx.shadowColor = '#aaffff'; ctx.shadowBlur = 6; }
          else ctx.shadowBlur = 0;
          ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
        }
      }
    }
    ctx.shadowBlur = 0;

    drawSparkline();

    // Idle prompt on an empty board, so a blank grid isn't a dead end.
    if (population === 0 && !running) {
      ctx.fillStyle = '#E6EDF3';
      ctx.font = '18px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Click or tap to draw cells', WIDTH / 2, HEIGHT / 2 - 8);
      ctx.font = '12px Inter, sans-serif';
      ctx.fillStyle = '#7D8590';
      ctx.fillText('…or pick a pattern below, then press Play', WIDTH / 2, HEIGHT / 2 + 16);
      ctx.textAlign = 'left';
    }
  }

  // Tiny population-over-time graph tucked into the top-right corner — lets
  // you watch a soup crash, stabilise, or oscillate at a glance.
  function drawSparkline() {
    if (popHistory.length < 2) return;
    const w = 116, h = 34, pad = 8;
    const x0 = WIDTH - w - pad, y0 = pad;
    ctx.fillStyle = 'rgba(13,17,23,0.6)';
    ctx.fillRect(x0, y0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, w, h);
    const max = Math.max(1, ...popHistory);
    ctx.beginPath();
    ctx.strokeStyle = '#58A6FF';
    ctx.lineWidth = 1.5;
    popHistory.forEach((p, i) => {
      const x = x0 + (i / (popHistory.length - 1)) * w;
      const y = y0 + h - (p / max) * (h - 4) - 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = 'rgba(230,237,243,0.5)';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.fillText('pop', x0 + 4, y0 + 11);
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
