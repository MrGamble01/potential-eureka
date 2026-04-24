/* ============================================
   SNAKE — Classic arcade game with power-ups
   ============================================ */

const SnakeGame = (() => {
  const GRID = 20;
  const COLS = 30;
  const ROWS = 20;
  const WIDTH = COLS * GRID;
  const HEIGHT = ROWS * GRID;

  // Power-up definitions
  const POWERUP_TYPES = [
    { id: 'speed',  color: '#00E5FF', glow: '#00E5FF', symbol: '>>', label: 'SPEED BOOST', duration: 5000 },
    { id: 'slow',   color: '#FFD700', glow: '#FFD700', symbol: '~~', label: 'SLOW-MO',     duration: 5000 },
    { id: 'shrink', color: '#FF6B35', glow: '#FF6B35', symbol: '<<', label: 'SHRINK',      duration: 0    },
    { id: 'double', color: '#A8FF3E', glow: '#A8FF3E', symbol: 'x2', label: '2X SCORE',   duration: 8000 },
  ];

  let canvas, ctx;
  let snake, direction, nextDirection;
  let food, score, highScore;
  let baseSpeed, speedMultiplier, scoreMultiplier;
  let gameLoop, running, gameOver;

  // Power-up state
  let powerUp = null;
  let powerUpDespawnTimer = null;
  let activeEffect = null;
  let activeEffectTimer = null;
  let activeEffectEnd = 0;

  function init() {
    canvas = document.getElementById('snake-canvas');
    if (!canvas) return;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    ctx = canvas.getContext('2d');
    highScore = parseInt(Utils.store.getRaw('snake-high') || '0');
    snake = [];
    running = false;
    gameOver = false;
    updateInfo();
    draw();

    document.addEventListener('keydown', handleKey);

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
  }

  function setDir(dx, dy) {
    if (dx === 1 && direction.x !== -1) nextDirection = { x: 1, y: 0 };
    else if (dx === -1 && direction.x !== 1) nextDirection = { x: -1, y: 0 };
    else if (dy === 1 && direction.y !== -1) nextDirection = { x: 0, y: 1 };
    else if (dy === -1 && direction.y !== 1) nextDirection = { x: 0, y: -1 };
  }

  function handleKey(e) {
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
    gameOver = false;
    running = true;
    baseSpeed = 120;
    speedMultiplier = 1;
    scoreMultiplier = 1;

    clearPowerUpOnGrid();
    clearActiveEffect();
    spawnFood();
    updateInfo();

    const overlay = document.getElementById('snake-overlay');
    if (overlay) overlay.style.display = 'none';

    restartLoop();
  }

  function restartLoop() {
    clearInterval(gameLoop);
    gameLoop = setInterval(tick, Math.round(baseSpeed * speedMultiplier));
  }

  function spawnFood() {
    const occupied = new Set(snake.map(s => `${s.x},${s.y}`));
    if (powerUp) occupied.add(`${powerUp.x},${powerUp.y}`);
    do {
      food = {
        x: Math.floor(Math.random() * COLS),
        y: Math.floor(Math.random() * ROWS),
      };
    } while (occupied.has(`${food.x},${food.y}`));
  }

  function spawnPowerUp() {
    clearPowerUpOnGrid();
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    const occupied = new Set(snake.map(s => `${s.x},${s.y}`));
    occupied.add(`${food.x},${food.y}`);
    let pos;
    do {
      pos = {
        x: Math.floor(Math.random() * COLS),
        y: Math.floor(Math.random() * ROWS),
      };
    } while (occupied.has(`${pos.x},${pos.y}`));

    powerUp = { ...pos, type };
    powerUpDespawnTimer = setTimeout(() => { powerUp = null; }, 8000);
  }

  function clearPowerUpOnGrid() {
    clearTimeout(powerUpDespawnTimer);
    powerUpDespawnTimer = null;
    powerUp = null;
  }

  function clearActiveEffect() {
    clearTimeout(activeEffectTimer);
    activeEffectTimer = null;
    activeEffect = null;
    activeEffectEnd = 0;
  }

  function applyPowerUp(type) {
    clearActiveEffect();

    if (type.id === 'speed') {
      speedMultiplier = 0.5;
      restartLoop();
      activeEffect = type;
      activeEffectEnd = Date.now() + type.duration;
      activeEffectTimer = setTimeout(() => {
        speedMultiplier = 1;
        restartLoop();
        clearActiveEffect();
      }, type.duration);
    } else if (type.id === 'slow') {
      speedMultiplier = 2;
      restartLoop();
      activeEffect = type;
      activeEffectEnd = Date.now() + type.duration;
      activeEffectTimer = setTimeout(() => {
        speedMultiplier = 1;
        restartLoop();
        clearActiveEffect();
      }, type.duration);
    } else if (type.id === 'shrink') {
      // Instant effect: remove up to 3 tail segments
      const removeCount = Math.min(3, snake.length - 1);
      snake.splice(snake.length - removeCount, removeCount);
    } else if (type.id === 'double') {
      scoreMultiplier = 2;
      activeEffect = type;
      activeEffectEnd = Date.now() + type.duration;
      activeEffectTimer = setTimeout(() => {
        scoreMultiplier = 1;
        clearActiveEffect();
      }, type.duration);
    }
  }

  function tick() {
    direction = { ...nextDirection };
    const head = {
      x: snake[0].x + direction.x,
      y: snake[0].y + direction.y,
    };

    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      return endGame();
    }

    if (snake.some(s => s.x === head.x && s.y === head.y)) {
      return endGame();
    }

    snake.unshift(head);

    // Collect power-up
    if (powerUp && head.x === powerUp.x && head.y === powerUp.y) {
      const type = powerUp.type;
      clearPowerUpOnGrid();
      applyPowerUp(type);
    }

    // Eat food
    if (head.x === food.x && head.y === food.y) {
      score += 10 * scoreMultiplier;
      if (score > highScore) {
        highScore = score;
        Utils.store.setRaw('snake-high', String(highScore));
      }
      spawnFood();
      if (baseSpeed > 60) {
        baseSpeed -= 2;
        restartLoop();
      }
      // 30% chance to spawn a power-up
      if (!powerUp && Math.random() < 0.3) {
        spawnPowerUp();
      }
    } else {
      snake.pop();
    }

    updateInfo();
    draw();
  }

  function endGame() {
    running = false;
    gameOver = true;
    clearInterval(gameLoop);
    clearPowerUpOnGrid();
    clearActiveEffect();
    scoreMultiplier = 1;
    speedMultiplier = 1;

    const overlay = document.getElementById('snake-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
      overlay.innerHTML = `
        <h2>GAME OVER</h2>
        <p>Score: ${score}</p>
        <p style="font-size:12px; color: var(--text-dim)">Press SPACE to restart</p>
      `;
    }
  }

  function updateInfo() {
    const scoreEl = document.getElementById('snake-score');
    const highEl = document.getElementById('snake-high');
    if (scoreEl) scoreEl.textContent = score || 0;
    if (highEl) highEl.textContent = highScore;
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

    // Snake
    snake.forEach((seg, i) => {
      const brightness = 1 - (i / snake.length) * 0.5;
      if (i === 0) {
        ctx.fillStyle = '#6C63FF';
        ctx.shadowColor = '#6C63FF';
        ctx.shadowBlur = 8;
      } else {
        ctx.fillStyle = `rgba(108, 99, 255, ${brightness})`;
        ctx.shadowBlur = 0;
      }
      ctx.fillRect(seg.x * GRID + 1, seg.y * GRID + 1, GRID - 2, GRID - 2);
    });
    ctx.shadowBlur = 0;

    // Food
    if (food) {
      ctx.fillStyle = '#F778BA';
      ctx.shadowColor = '#F778BA';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(food.x * GRID + GRID / 2, food.y * GRID + GRID / 2, GRID / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Power-up on grid (diamond shape)
    if (powerUp) {
      const t = powerUp.type;
      const cx = powerUp.x * GRID + GRID / 2;
      const cy = powerUp.y * GRID + GRID / 2;
      const r = GRID / 2 - 1;

      ctx.fillStyle = t.color;
      ctx.shadowColor = t.glow;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(cx,     cy - r);
      ctx.lineTo(cx + r, cy    );
      ctx.lineTo(cx,     cy + r);
      ctx.lineTo(cx - r, cy    );
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#0d1117';
      ctx.font = `bold 7px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.symbol, cx, cy);
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
    }

    // Active effect HUD (top-left)
    if (activeEffect && activeEffect.duration > 0) {
      const remaining = Math.max(0, activeEffectEnd - Date.now());
      const frac = remaining / activeEffect.duration;
      const barW = 130;
      const barH = 5;
      const px = 10, py = 10;

      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(px - 4, py - 4, barW + 8, 30);

      ctx.fillStyle = activeEffect.color;
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`${activeEffect.symbol} ${activeEffect.label}`, px, py);

      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(px, py + 13, barW, barH);

      ctx.fillStyle = activeEffect.color;
      ctx.shadowColor = activeEffect.glow;
      ctx.shadowBlur = 4;
      ctx.fillRect(px, py + 13, barW * frac, barH);
      ctx.shadowBlur = 0;
      ctx.textBaseline = 'alphabetic';
    }

    // Start prompt
    if (!running && !gameOver) {
      ctx.fillStyle = 'rgba(13, 17, 23, 0.7)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#E6EDF3';
      ctx.font = '20px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Press any arrow key to start', WIDTH / 2, HEIGHT / 2);
      ctx.font = '12px Inter, sans-serif';
      ctx.fillStyle = '#7D8590';
      ctx.fillText('WASD or Arrow Keys to move', WIDTH / 2, HEIGHT / 2 + 24);
      ctx.textAlign = 'left';
    }
  }

  function destroy() {
    clearInterval(gameLoop);
    clearPowerUpOnGrid();
    clearActiveEffect();
    running = false;
  }

  return { init, start, destroy };
})();
