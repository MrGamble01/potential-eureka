/* ============================================
   SNAKE — Classic arcade game
   ============================================ */

const SnakeGame = (() => {
  const GRID = 20;
  const COLS = 30;
  const ROWS = 20;
  const WIDTH = COLS * GRID;
  const HEIGHT = ROWS * GRID;

  const POWER_UPS = ['slow', 'double', 'trim'];
  const PU_COLOR  = { slow: '#58A6FF', double: '#3FB950', trim: '#F85149' };
  const PU_LABEL  = { slow: 'SLOW',    double: '×2',      trim: 'TRIM'   };

  let canvas, ctx;
  let snake, direction, nextDirection;
  let food, bonusFood, powerUp, activeEffect;
  let score, highScore, speed;
  let foodCount, wallWrap;
  let gameLoop, running, gameOver;
  let skipSlowTick;

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
    foodCount = 0;
    bonusFood = null;
    powerUp = null;
    activeEffect = null;
    wallWrap = false;
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
    if (dx === 1  && direction.x !== -1) nextDirection = { x: 1,  y: 0 };
    else if (dx === -1 && direction.x !== 1)  nextDirection = { x: -1, y: 0 };
    else if (dy === 1  && direction.y !== -1) nextDirection = { x: 0,  y: 1 };
    else if (dy === -1 && direction.y !== 1)  nextDirection = { x: 0, y: -1 };
  }

  function handleKey(e) {
    if (!running && !gameOver && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      start();
      return;
    }
    switch (e.key) {
      case 'ArrowUp':    case 'w': case 'W': setDir(0, -1); e.preventDefault(); break;
      case 'ArrowDown':  case 's': case 'S': setDir(0,  1); e.preventDefault(); break;
      case 'ArrowLeft':  case 'a': case 'A': setDir(-1, 0); e.preventDefault(); break;
      case 'ArrowRight': case 'd': case 'D': setDir(1,  0); e.preventDefault(); break;
      case ' ':
        if (gameOver) start();
        e.preventDefault();
        break;
    }
  }

  function start() {
    snake         = [{ x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) }];
    direction     = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score         = 0;
    foodCount     = 0;
    bonusFood     = null;
    powerUp       = null;
    activeEffect  = null;
    skipSlowTick  = false;
    gameOver      = false;
    running       = true;
    speed         = 120;
    spawnFood();
    updateInfo();

    const overlay = document.getElementById('snake-overlay');
    if (overlay) overlay.style.display = 'none';

    clearInterval(gameLoop);
    gameLoop = setInterval(tick, speed);
  }

  // ── Spawn helpers ──────────────────────────────────────────────

  function freePos(extras = []) {
    let pos, attempts = 0;
    do {
      pos = {
        x: Math.floor(Math.random() * COLS),
        y: Math.floor(Math.random() * ROWS),
      };
      attempts++;
    } while (attempts < 120 && (
      snake.some(s => s.x === pos.x && s.y === pos.y) ||
      extras.some(p => p && p.x === pos.x && p.y === pos.y)
    ));
    return pos;
  }

  function spawnFood() {
    food = freePos([bonusFood, powerUp]);
  }

  function spawnBonusFood() {
    bonusFood = { ...freePos([food, powerUp]), expireAt: Date.now() + 5000 };
  }

  function spawnPowerUp() {
    if (powerUp) return;
    const type = POWER_UPS[Math.floor(Math.random() * POWER_UPS.length)];
    powerUp = { ...freePos([food, bonusFood]), type, expireAt: Date.now() + 6000 };
  }

  // ── Effect management ──────────────────────────────────────────

  function activateEffect(type) {
    clearCurrentEffect();
    if (type === 'trim') {
      snake = snake.slice(0, Math.max(3, Math.ceil(snake.length / 2)));
      activeEffect = { type: 'trim', endsAt: Date.now() + 1500 };
      return;
    }
    activeEffect = { type, endsAt: Date.now() + 6000 };
    if (type === 'slow') {
      clearInterval(gameLoop);
      gameLoop = setInterval(tick, speed * 1.8);
    }
  }

  function clearCurrentEffect() {
    if (!activeEffect) return;
    if (activeEffect.type === 'slow') {
      clearInterval(gameLoop);
      gameLoop = setInterval(tick, speed);
    }
    activeEffect = null;
  }

  function getLevel() {
    return Math.floor(foodCount / 3) + 1;
  }

  function toggleWallWrap() {
    wallWrap = !wallWrap;
    const btn = document.getElementById('snake-wrap-btn');
    if (btn) {
      btn.textContent = `Wrap: ${wallWrap ? 'ON' : 'OFF'}`;
      btn.style.borderColor = wallWrap ? '#3FB950' : '';
      btn.style.color       = wallWrap ? '#3FB950' : '';
    }
  }

  // ── Main tick ──────────────────────────────────────────────────

  function tick() {
    // Check for expired active effect
    if (activeEffect && Date.now() > activeEffect.endsAt) {
      clearCurrentEffect();
    }

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

    if (snake.some(s => s.x === head.x && s.y === head.y)) {
      return endGame();
    }

    snake.unshift(head);

    // Expire timed items
    if (bonusFood && Date.now() > bonusFood.expireAt) bonusFood = null;
    if (powerUp   && Date.now() > powerUp.expireAt)   powerUp   = null;

    const multiplier = (activeEffect && activeEffect.type === 'double') ? 2 : 1;
    let ate = false;

    if (head.x === food.x && head.y === food.y) {
      ate = true;
      score += 10 * multiplier;
      foodCount++;
      if (score > highScore) {
        highScore = score;
        Utils.store.setRaw('snake-high', String(highScore));
      }
      spawnFood();
      if (foodCount % 5 === 0) spawnBonusFood();
      // 30% chance to spawn a power-up when none is present
      if (!powerUp && Math.random() < 0.30) spawnPowerUp();
      if (speed > 60) {
        speed -= 2;
        clearInterval(gameLoop);
        const effectiveSpeed = (activeEffect && activeEffect.type === 'slow') ? speed * 1.8 : speed;
        gameLoop = setInterval(tick, effectiveSpeed);
      }

    } else if (bonusFood && head.x === bonusFood.x && head.y === bonusFood.y) {
      ate = true;
      score += 50 * multiplier;
      bonusFood = null;
      if (score > highScore) {
        highScore = score;
        Utils.store.setRaw('snake-high', String(highScore));
      }

    } else if (powerUp && head.x === powerUp.x && head.y === powerUp.y) {
      ate = true;
      const type = powerUp.type;
      powerUp = null;
      activateEffect(type);
    }

    if (!ate) snake.pop();

    updateInfo();
    draw();
  }

  function endGame() {
    running      = false;
    gameOver     = true;
    bonusFood    = null;
    powerUp      = null;
    activeEffect = null;
    clearInterval(gameLoop);

    const overlay = document.getElementById('snake-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
      overlay.innerHTML = `
        <h2>GAME OVER</h2>
        <p>Score: ${score} &nbsp;·&nbsp; Level: ${getLevel()}</p>
        <p style="font-size:12px; color: var(--text-dim)">Press SPACE to restart</p>
      `;
    }
  }

  function updateInfo() {
    const scoreEl  = document.getElementById('snake-score');
    const highEl   = document.getElementById('snake-high');
    const levelEl  = document.getElementById('snake-level');
    const effectEl = document.getElementById('snake-effect');
    if (scoreEl)  scoreEl.textContent = score || 0;
    if (highEl)   highEl.textContent  = highScore;
    if (levelEl)  levelEl.textContent = getLevel();
    if (effectEl) {
      if (activeEffect && activeEffect.type !== 'trim') {
        const secs = Math.ceil(Math.max(0, activeEffect.endsAt - Date.now()) / 1000);
        effectEl.textContent = `${PU_LABEL[activeEffect.type]} (${secs}s)`;
        effectEl.style.color = PU_COLOR[activeEffect.type];
        effectEl.style.display = 'inline';
      } else {
        effectEl.style.display = 'none';
      }
    }
  }

  // ── Rendering ──────────────────────────────────────────────────

  function draw() {
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * GRID, 0); ctx.lineTo(x * GRID, HEIGHT); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * GRID); ctx.lineTo(WIDTH, y * GRID); ctx.stroke();
    }

    // Snake — tinted green when ×2 is active, blue when SLOW is active
    const isDouble = activeEffect && activeEffect.type === 'double';
    const isSlow   = activeEffect && activeEffect.type === 'slow';
    const headColor = isDouble ? '#3FB950' : isSlow ? '#58A6FF' : '#6C63FF';

    snake.forEach((seg, i) => {
      const brightness = 1 - (i / snake.length) * 0.5;
      if (i === 0) {
        ctx.fillStyle   = headColor;
        ctx.shadowColor = headColor;
        ctx.shadowBlur  = 8;
      } else {
        const [r, g, b] = hexToRgb(headColor);
        ctx.fillStyle   = `rgba(${r},${g},${b},${brightness})`;
        ctx.shadowBlur  = 0;
      }
      ctx.fillRect(seg.x * GRID + 1, seg.y * GRID + 1, GRID - 2, GRID - 2);
    });
    ctx.shadowBlur = 0;

    // Regular food
    if (food) {
      ctx.fillStyle   = '#F778BA';
      ctx.shadowColor = '#F778BA';
      ctx.shadowBlur  = 10;
      ctx.beginPath();
      ctx.arc(food.x * GRID + GRID / 2, food.y * GRID + GRID / 2, GRID / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Bonus food — gold, pulsing
    if (bonusFood) {
      const timeLeft = bonusFood.expireAt - Date.now();
      const alpha    = timeLeft < 1500 ? timeLeft / 1500 : 1;
      const pulse    = Math.sin(Date.now() / 120) * 1.5;
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = '#F7C948';
      ctx.shadowColor = '#F7C948';
      ctx.shadowBlur  = 14 + pulse;
      ctx.beginPath();
      ctx.arc(
        bonusFood.x * GRID + GRID / 2,
        bonusFood.y * GRID + GRID / 2,
        GRID / 2 - 1 + pulse,
        0, Math.PI * 2
      );
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur  = 0;
    }

    // Power-up — diamond shape with label
    if (powerUp) {
      const timeLeft = powerUp.expireAt - Date.now();
      const alpha    = timeLeft < 1500 ? timeLeft / 1500 : 1;
      const pulse    = Math.sin(Date.now() / 150) * 1.2;
      const color    = PU_COLOR[powerUp.type];
      const cx       = powerUp.x * GRID + GRID / 2;
      const cy       = powerUp.y * GRID + GRID / 2;
      const size     = GRID / 2 - 1 + pulse;

      ctx.globalAlpha = alpha;
      ctx.fillStyle   = color;
      ctx.shadowColor = color;
      ctx.shadowBlur  = 14 + pulse;

      ctx.beginPath();
      ctx.moveTo(cx, cy - size);
      ctx.lineTo(cx + size, cy);
      ctx.lineTo(cx, cy + size);
      ctx.lineTo(cx - size, cy);
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur      = 0;
      ctx.fillStyle       = '#fff';
      ctx.font            = `bold ${Math.round(GRID * 0.4)}px Inter, sans-serif`;
      ctx.textAlign       = 'center';
      ctx.textBaseline    = 'middle';
      ctx.fillText(PU_LABEL[powerUp.type], cx, cy);
      ctx.textBaseline    = 'alphabetic';
      ctx.textAlign       = 'left';
      ctx.globalAlpha     = 1;
    }

    // Active effect HUD bar (top-right corner of canvas)
    if (activeEffect && activeEffect.type !== 'trim') {
      const timeLeft = Math.max(0, activeEffect.endsAt - Date.now());
      const pct      = timeLeft / 6000;
      const color    = PU_COLOR[activeEffect.type];
      const barW     = 80;
      const barH     = 18;
      const bx       = WIDTH - barW - 8;
      const by       = 8;

      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);

      ctx.fillStyle   = color;
      ctx.shadowColor = color;
      ctx.shadowBlur  = 6;
      ctx.fillRect(bx, by, barW * pct, barH);
      ctx.shadowBlur  = 0;

      ctx.fillStyle    = '#fff';
      ctx.font         = `bold 10px Inter, sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(PU_LABEL[activeEffect.type], bx + barW / 2, by + barH / 2);
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign    = 'left';
    }

    // Start prompt
    if (!running && !gameOver) {
      ctx.fillStyle = 'rgba(13, 17, 23, 0.7)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle    = '#E6EDF3';
      ctx.font         = '20px Inter, sans-serif';
      ctx.textAlign    = 'center';
      ctx.fillText('Press any arrow key to start', WIDTH / 2, HEIGHT / 2);
      ctx.font         = '12px Inter, sans-serif';
      ctx.fillStyle    = '#7D8590';
      ctx.fillText('WASD or Arrow Keys to move', WIDTH / 2, HEIGHT / 2 + 24);
      ctx.textAlign    = 'left';
    }
  }

  // ── Helpers ────────────────────────────────────────────────────

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function destroy() {
    clearInterval(gameLoop);
    running = false;
  }

  return { init, start, destroy, toggleWallWrap };
})();
