/* ============================================
   SNAKE — Classic arcade game
   Power-ups, difficulty levels, pause, particles.
   ============================================ */

const SnakeGame = (() => {
  const GRID = 20;          // grid cell size in pixels
  const COLS = 30;
  const ROWS = 20;
  const WIDTH = COLS * GRID;
  const HEIGHT = ROWS * GRID;

  const DIFFICULTIES = {
    easy:   { startSpeed: 160, decrement: 1, minSpeed: 100, label: 'Easy' },
    normal: { startSpeed: 120, decrement: 2, minSpeed: 60,  label: 'Normal' },
    hard:   { startSpeed: 90,  decrement: 3, minSpeed: 40,  label: 'Hard' },
  };

  // Power-up definitions. Each spawns occasionally and grants a temporary effect.
  const POWERUPS = {
    slow:  { color: '#58A6FF', glyph: '❄', label: 'SLOW',  duration: 5000 },
    mult:  { color: '#3FB950', glyph: '×', label: '2× SCORE', duration: 10000 },
    phase: { color: '#F778BA', glyph: '⌽', label: 'PHASE', duration: 5000 },
  };
  const POWERUP_LIFETIME = 7000;   // ms on the board before it expires
  const POWERUP_EVERY    = 7;      // try to spawn one after every N apples

  let canvas, ctx;
  let snake, direction, nextDirection;
  let food, bonusFood, powerup, score, highScore, baseSpeed;
  let foodCount, wallWrap, difficulty;
  let running, gameOver, paused;
  let particles = [];
  let active = {};                 // { slow: expireAt, mult: expireAt, phase: expireAt }
  let tickAcc = 0;
  let lastFrame = 0;
  let rafId = null;

  function init() {
    canvas = document.getElementById('snake-canvas');
    if (!canvas) return;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    ctx = canvas.getContext('2d');
    highScore = parseInt(Utils.store.getRaw('snake-high') || '0');
    difficulty = Utils.store.getRaw('snake-difficulty') || 'normal';
    snake = [];
    running = false;
    gameOver = false;
    paused = false;
    foodCount = 0;
    bonusFood = null;
    powerup = null;
    wallWrap = false;
    active = {};
    particles = [];
    syncDifficultyButton();
    syncPauseButton();
    updateInfo();
    draw();

    document.addEventListener('keydown', handleKey);

    // Mobile swipe support
    let touchStartX, touchStartY;
    canvas.addEventListener('touchstart', e => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    });
    canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    canvas.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 30) setDir(1, 0);
        else if (dx < -30) setDir(-1, 0);
      } else {
        if (dy > 30) setDir(0, 1);
        else if (dy < -30) setDir(0, -1);
      }
    });

    cancelAnimationFrame(rafId);
    lastFrame = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function setDir(dx, dy) {
    if (!direction) return;
    if (dx === 1 && direction.x !== -1) nextDirection = { x: 1, y: 0 };
    else if (dx === -1 && direction.x !== 1) nextDirection = { x: -1, y: 0 };
    else if (dy === 1 && direction.y !== -1) nextDirection = { x: 0, y: 1 };
    else if (dy === -1 && direction.y !== 1) nextDirection = { x: 0, y: -1 };
  }

  function handleKey(e) {
    // Only respond if the Snake view is visible.
    const view = document.getElementById('view-snake');
    if (!view || !view.classList.contains('active')) return;

    if (e.key === 'p' || e.key === 'P') {
      togglePause();
      e.preventDefault();
      return;
    }
    if (!running && !gameOver && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      start();
      return;
    }
    switch (e.key) {
      case 'ArrowUp':    case 'w': case 'W': setDir(0, -1); e.preventDefault(); break;
      case 'ArrowDown':  case 's': case 'S': setDir(0, 1);  e.preventDefault(); break;
      case 'ArrowLeft':  case 'a': case 'A': setDir(-1, 0); e.preventDefault(); break;
      case 'ArrowRight': case 'd': case 'D': setDir(1, 0);  e.preventDefault(); break;
      case ' ':
        if (gameOver) start();
        e.preventDefault();
        break;
    }
  }

  function start() {
    snake = [{ x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) }];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    foodCount = 0;
    bonusFood = null;
    powerup = null;
    active = {};
    particles = [];
    gameOver = false;
    paused = false;
    running = true;
    baseSpeed = DIFFICULTIES[difficulty].startSpeed;
    spawnFood();
    updateInfo();
    syncPauseButton();

    const overlay = document.getElementById('snake-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  function togglePause() {
    if (!running || gameOver) return;
    paused = !paused;
    syncPauseButton();
    if (!paused) lastFrame = performance.now();
  }

  function syncPauseButton() {
    const btn = document.getElementById('snake-pause-btn');
    if (!btn) return;
    btn.textContent = paused ? 'Resume' : 'Pause';
    btn.disabled = !running || gameOver;
  }

  function cycleDifficulty() {
    const order = ['easy', 'normal', 'hard'];
    difficulty = order[(order.indexOf(difficulty) + 1) % order.length];
    Utils.store.setRaw('snake-difficulty', difficulty);
    syncDifficultyButton();
  }

  function syncDifficultyButton() {
    const btn = document.getElementById('snake-difficulty-btn');
    if (!btn) return;
    btn.textContent = `Difficulty: ${DIFFICULTIES[difficulty].label}`;
    const accent = difficulty === 'easy' ? '#3FB950' : difficulty === 'hard' ? '#F85149' : '#58A6FF';
    btn.style.borderColor = accent;
    btn.style.color = accent;
  }

  function spawnFood() {
    do {
      food = {
        x: Math.floor(Math.random() * COLS),
        y: Math.floor(Math.random() * ROWS),
      };
    } while (snake.some(s => s.x === food.x && s.y === food.y));
  }

  function spawnBonusFood() {
    const pos = randomEmptyCell();
    if (pos) bonusFood = { ...pos, expireAt: Date.now() + 5000 };
  }

  function spawnPowerup() {
    const pos = randomEmptyCell();
    if (!pos) return;
    const types = Object.keys(POWERUPS);
    const type = types[Math.floor(Math.random() * types.length)];
    powerup = { ...pos, type, expireAt: Date.now() + POWERUP_LIFETIME };
  }

  function randomEmptyCell() {
    for (let attempts = 0; attempts < 100; attempts++) {
      const p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
      if (snake.some(s => s.x === p.x && s.y === p.y)) continue;
      if (food && food.x === p.x && food.y === p.y) continue;
      if (bonusFood && bonusFood.x === p.x && bonusFood.y === p.y) continue;
      if (powerup && powerup.x === p.x && powerup.y === p.y) continue;
      return p;
    }
    return null;
  }

  function getLevel() {
    return Math.floor(foodCount / 3) + 1;
  }

  function currentSpeed() {
    const d = DIFFICULTIES[difficulty];
    let s = Math.max(d.minSpeed, baseSpeed);
    if (active.slow && Date.now() < active.slow) s *= 2;
    return s;
  }

  function toggleWallWrap() {
    wallWrap = !wallWrap;
    const btn = document.getElementById('snake-wrap-btn');
    if (btn) {
      btn.textContent = `Wrap: ${wallWrap ? 'ON' : 'OFF'}`;
      btn.style.borderColor = wallWrap ? '#3FB950' : '';
      btn.style.color = wallWrap ? '#3FB950' : '';
    }
  }

  function frame(now) {
    const dt = now - lastFrame;
    lastFrame = now;

    if (running && !paused && !gameOver) {
      tickAcc += dt;
      const spd = currentSpeed();
      while (tickAcc >= spd) {
        tick();
        tickAcc -= spd;
        if (gameOver) break;
      }
      updateParticles(dt);
      // Auto-clean expired powerups in `active`
      for (const k of Object.keys(active)) {
        if (Date.now() > active[k]) delete active[k];
      }
      // Expire on-board powerup
      if (powerup && Date.now() > powerup.expireAt) powerup = null;
    } else {
      // Even when paused/over, advance particles slightly slower for visual continuity.
      updateParticles(dt * (paused ? 0 : 1));
    }

    draw();
    updateInfo();
    rafId = requestAnimationFrame(frame);
  }

  function tick() {
    direction = { ...nextDirection };
    let head = {
      x: snake[0].x + direction.x,
      y: snake[0].y + direction.y,
    };

    if (wallWrap) {
      head.x = (head.x + COLS) % COLS;
      head.y = (head.y + ROWS) % ROWS;
    } else if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      return endGame();
    }

    // Self collision (ignored while PHASE is active)
    const phasing = active.phase && Date.now() < active.phase;
    if (!phasing && snake.some(s => s.x === head.x && s.y === head.y)) {
      return endGame();
    }

    snake.unshift(head);

    // Expire bonus food
    if (bonusFood && Date.now() > bonusFood.expireAt) {
      bonusFood = null;
    }

    const multActive = active.mult && Date.now() < active.mult;
    let ate = false;

    // Regular food
    if (head.x === food.x && head.y === food.y) {
      ate = true;
      const gained = 10 * (multActive ? 2 : 1);
      score += gained;
      foodCount++;
      bumpHigh();
      burst(food.x, food.y, '#F778BA', 12);
      spawnFood();
      if (foodCount % 5 === 0) spawnBonusFood();
      if (foodCount > 0 && foodCount % POWERUP_EVERY === 0 && !powerup) spawnPowerup();
      // Speed up slightly
      baseSpeed = Math.max(DIFFICULTIES[difficulty].minSpeed, baseSpeed - DIFFICULTIES[difficulty].decrement);
    } else if (bonusFood && head.x === bonusFood.x && head.y === bonusFood.y) {
      ate = true;
      score += 50 * (multActive ? 2 : 1);
      burst(bonusFood.x, bonusFood.y, '#F7C948', 22);
      bonusFood = null;
      bumpHigh();
    } else if (powerup && head.x === powerup.x && head.y === powerup.y) {
      const def = POWERUPS[powerup.type];
      active[powerup.type] = Date.now() + def.duration;
      burst(powerup.x, powerup.y, def.color, 26);
      powerup = null;
      // Powerup pickup does NOT grow the snake or count as food.
    }

    if (!ate) snake.pop();
  }

  function bumpHigh() {
    if (score > highScore) {
      highScore = score;
      Utils.store.setRaw('snake-high', String(highScore));
    }
  }

  function endGame() {
    running = false;
    gameOver = true;
    bonusFood = null;
    powerup = null;
    // Explode the snake into particles for a satisfying death.
    snake.forEach((seg, i) => {
      const intensity = i === 0 ? 18 : 4;
      burst(seg.x, seg.y, i === 0 ? '#F85149' : '#6C63FF', intensity);
    });
    syncPauseButton();

    const overlay = document.getElementById('snake-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
      overlay.innerHTML = `
        <h2>GAME OVER</h2>
        <p>Score: ${score} &nbsp;·&nbsp; Level: ${getLevel()} &nbsp;·&nbsp; ${DIFFICULTIES[difficulty].label}</p>
        <p style="font-size:12px; color: var(--text-dim)">Press SPACE to restart</p>
      `;
    }
  }

  // ---- Particles ----
  function burst(cellX, cellY, color, count) {
    const cx = cellX * GRID + GRID / 2;
    const cy = cellY * GRID + GRID / 2;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 120;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1, decay: 0.6 + Math.random() * 0.8,
        size: 2 + Math.random() * 3,
        color,
      });
    }
  }

  function updateParticles(dt) {
    const s = dt / 1000;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * s;
      p.y += p.vy * s;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life -= p.decay * s;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function updateInfo() {
    const scoreEl = document.getElementById('snake-score');
    const highEl = document.getElementById('snake-high');
    const levelEl = document.getElementById('snake-level');
    if (scoreEl) scoreEl.textContent = score || 0;
    if (highEl) highEl.textContent = highScore;
    if (levelEl) levelEl.textContent = getLevel();

    const status = document.getElementById('snake-powerup-status');
    if (status) {
      const items = [];
      for (const [type, expireAt] of Object.entries(active)) {
        const remain = Math.max(0, expireAt - Date.now());
        if (remain === 0) continue;
        const def = POWERUPS[type];
        const secs = (remain / 1000).toFixed(1);
        items.push(`<span class="snake-power-badge" style="--c:${def.color}">${def.glyph} ${def.label} · ${secs}s</span>`);
      }
      status.innerHTML = items.join('');
      status.style.display = items.length ? 'flex' : 'none';
    }
  }

  function draw() {
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Grid lines (subtle)
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * GRID, 0); ctx.lineTo(x * GRID, HEIGHT); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * GRID); ctx.lineTo(WIDTH, y * GRID); ctx.stroke();
    }

    // Snake (tinted while powerups are active)
    const phaseActive = active.phase && Date.now() < active.phase;
    const multActive  = active.mult  && Date.now() < active.mult;
    const slowActive  = active.slow  && Date.now() < active.slow;
    const headColor = phaseActive ? '#F778BA' : multActive ? '#3FB950' : slowActive ? '#58A6FF' : '#6C63FF';

    snake.forEach((seg, i) => {
      const brightness = 1 - (i / snake.length) * 0.5;
      if (i === 0) {
        ctx.fillStyle = headColor;
        ctx.shadowColor = headColor;
        ctx.shadowBlur = 8;
      } else {
        const rgb = phaseActive ? '247, 120, 186'
                  : multActive ? '63, 185, 80'
                  : slowActive ? '88, 166, 255'
                  : '108, 99, 255';
        const a = phaseActive ? brightness * 0.7 : brightness;
        ctx.fillStyle = `rgba(${rgb}, ${a})`;
        ctx.shadowBlur = 0;
      }
      ctx.fillRect(seg.x * GRID + 1, seg.y * GRID + 1, GRID - 2, GRID - 2);
    });
    ctx.shadowBlur = 0;

    // Regular food
    if (food) {
      ctx.fillStyle = '#F778BA';
      ctx.shadowColor = '#F778BA';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(food.x * GRID + GRID / 2, food.y * GRID + GRID / 2, GRID / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Bonus food — gold, pulsing, fades out in last 1.5s
    if (bonusFood) {
      const timeLeft = bonusFood.expireAt - Date.now();
      const alpha = timeLeft < 1500 ? timeLeft / 1500 : 1;
      const pulse = Math.sin(Date.now() / 120) * 1.5;
      ctx.fillStyle = `rgba(247, 201, 72, ${alpha})`;
      ctx.shadowColor = '#F7C948';
      ctx.shadowBlur = 14 + pulse;
      ctx.beginPath();
      ctx.arc(
        bonusFood.x * GRID + GRID / 2,
        bonusFood.y * GRID + GRID / 2,
        GRID / 2 - 1 + pulse,
        0, Math.PI * 2
      );
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Power-up — themed color + glyph
    if (powerup) {
      const def = POWERUPS[powerup.type];
      const timeLeft = powerup.expireAt - Date.now();
      const alpha = timeLeft < 1500 ? Math.max(0.2, timeLeft / 1500) : 1;
      const pulse = Math.sin(Date.now() / 100) * 2;
      const cx = powerup.x * GRID + GRID / 2;
      const cy = powerup.y * GRID + GRID / 2;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 18 + pulse;
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2;
      // diamond outline
      ctx.beginPath();
      ctx.moveTo(cx, cy - GRID / 2 + 2);
      ctx.lineTo(cx + GRID / 2 - 2, cy);
      ctx.lineTo(cx, cy + GRID / 2 - 2);
      ctx.lineTo(cx - GRID / 2 + 2, cy);
      ctx.closePath();
      ctx.fillStyle = `rgba(13, 17, 23, 0.85)`;
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = def.color;
      ctx.font = `bold ${GRID - 8}px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.glyph, cx, cy + 1);
      ctx.restore();
    }

    // Particles
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Pause overlay
    if (paused) {
      ctx.fillStyle = 'rgba(13, 17, 23, 0.7)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#E6EDF3';
      ctx.font = '22px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', WIDTH / 2, HEIGHT / 2);
      ctx.font = '12px Inter, sans-serif';
      ctx.fillStyle = '#7D8590';
      ctx.fillText('Press P to resume', WIDTH / 2, HEIGHT / 2 + 22);
      ctx.textAlign = 'left';
    }

    // Start prompt
    if (!running && !gameOver) {
      ctx.fillStyle = 'rgba(13, 17, 23, 0.7)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#E6EDF3';
      ctx.font = '20px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Press any arrow key to start', WIDTH / 2, HEIGHT / 2 - 4);
      ctx.font = '12px Inter, sans-serif';
      ctx.fillStyle = '#7D8590';
      ctx.fillText('WASD or Arrow Keys to move · P to pause', WIDTH / 2, HEIGHT / 2 + 22);
      ctx.fillText('Power-ups: ❄ slow · × double points · ⌽ phase through self', WIDTH / 2, HEIGHT / 2 + 42);
      ctx.textAlign = 'left';
    }
  }

  function destroy() {
    cancelAnimationFrame(rafId);
    running = false;
  }

  return { init, start, destroy, toggleWallWrap, togglePause, cycleDifficulty };
})();
