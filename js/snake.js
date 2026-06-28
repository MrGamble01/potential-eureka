/* ============================================
   SNAKE — Classic arcade game
   ============================================ */

const SnakeGame = (() => {
  const GRID = 20;
  const COLS = 30;
  const ROWS = 20;
  const WIDTH = COLS * GRID;
  const HEIGHT = ROWS * GRID;

  // Power-up definitions
  const PUPS = {
    SLOW:   { color: '#56D4F5', glow: '#56D4F5', label: 'SLOW',   sym: 'S', duration: 7000 },
    SHIELD: { color: '#3FB950', glow: '#3FB950', label: 'SHIELD', sym: 'H', duration: 0    },
    DOUBLE: { color: '#FF9F1C', glow: '#FF9F1C', label: '×2',     sym: '2', duration: 8000 },
  };
  const PUP_KEYS = Object.keys(PUPS);

  let canvas, ctx;
  let snake, direction, nextDirection;
  let food, bonusFood, powerUp, score, highScore, speed;
  let foodCount, wallWrap;
  let gameLoop, running, gameOver;
  let slowUntil, shieldActive, doubleUntil;

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
    slowUntil = 0;
    shieldActive = false;
    doubleUntil = 0;
    wallWrap = false;
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
    foodCount = 0;
    bonusFood = null;
    powerUp = null;
    slowUntil = 0;
    shieldActive = false;
    doubleUntil = 0;
    gameOver = false;
    running = true;
    speed = 120;
    spawnFood();
    updateInfo();
    updateEffectsUI();

    const overlay = document.getElementById('snake-overlay');
    if (overlay) overlay.style.display = 'none';

    clearInterval(gameLoop);
    gameLoop = setInterval(tick, speed);
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
    let pos, attempts = 0;
    do {
      pos = {
        x: Math.floor(Math.random() * COLS),
        y: Math.floor(Math.random() * ROWS),
      };
      attempts++;
    } while (attempts < 100 && (
      snake.some(s => s.x === pos.x && s.y === pos.y) ||
      (food && food.x === pos.x && food.y === pos.y)
    ));
    bonusFood = { ...pos, expireAt: Date.now() + 5000 };
  }

  function spawnPowerUp() {
    let pos, attempts = 0;
    do {
      pos = {
        x: Math.floor(Math.random() * COLS),
        y: Math.floor(Math.random() * ROWS),
      };
      attempts++;
    } while (attempts < 100 && (
      snake.some(s => s.x === pos.x && s.y === pos.y) ||
      (food && food.x === pos.x && food.y === pos.y) ||
      (bonusFood && bonusFood.x === pos.x && bonusFood.y === pos.y)
    ));
    const type = PUP_KEYS[Math.floor(Math.random() * PUP_KEYS.length)];
    powerUp = { ...pos, type, expireAt: Date.now() + 9000 };
  }

  function applyPowerUp(type) {
    const now = Date.now();
    if (type === 'SLOW') {
      slowUntil = now + PUPS.SLOW.duration;
      clearInterval(gameLoop);
      gameLoop = setInterval(tick, Math.round(speed * 1.8));
    } else if (type === 'SHIELD') {
      shieldActive = true;
    } else if (type === 'DOUBLE') {
      doubleUntil = now + PUPS.DOUBLE.duration;
    }
    updateEffectsUI();
  }

  function getLevel() {
    return Math.floor(foodCount / 3) + 1;
  }

  function getMultiplier() {
    return (doubleUntil && Date.now() < doubleUntil) ? 2 : 1;
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

  function tick() {
    const now = Date.now();

    // Check SLOW expiry — restore normal tick speed
    if (slowUntil && now > slowUntil) {
      slowUntil = 0;
      clearInterval(gameLoop);
      gameLoop = setInterval(tick, speed);
      updateEffectsUI();
    }
    // Check DOUBLE expiry
    if (doubleUntil && now > doubleUntil) {
      doubleUntil = 0;
      updateEffectsUI();
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
      if (shieldActive) {
        // Shield absorbs wall hit — snake freezes for this tick
        shieldActive = false;
        updateEffectsUI();
        draw();
        return;
      }
      return endGame();
    }

    // Self collision
    if (snake.some(s => s.x === head.x && s.y === head.y)) {
      if (shieldActive) {
        // Shield absorbs self collision
        shieldActive = false;
        updateEffectsUI();
        draw();
        return;
      }
      return endGame();
    }

    snake.unshift(head);

    // Expire bonus food and power-up
    if (bonusFood && now > bonusFood.expireAt) bonusFood = null;
    if (powerUp && now > powerUp.expireAt) powerUp = null;

    let ate = false;

    // Eat regular food
    if (head.x === food.x && head.y === food.y) {
      ate = true;
      score += 10 * getMultiplier();
      foodCount++;
      if (score > highScore) {
        highScore = score;
        Utils.store.setRaw('snake-high', String(highScore));
      }
      spawnFood();
      if (foodCount % 5 === 0) spawnBonusFood();
      if (foodCount % 8 === 0) spawnPowerUp();
      // Speed up slightly (only update interval when SLOW is not active)
      if (speed > 60) {
        speed -= 2;
        if (!slowUntil) {
          clearInterval(gameLoop);
          gameLoop = setInterval(tick, speed);
        }
      }
    } else if (bonusFood && head.x === bonusFood.x && head.y === bonusFood.y) {
      ate = true;
      score += 50 * getMultiplier();
      bonusFood = null;
      if (score > highScore) {
        highScore = score;
        Utils.store.setRaw('snake-high', String(highScore));
      }
    } else if (powerUp && head.x === powerUp.x && head.y === powerUp.y) {
      // Power-ups don't grow the snake
      applyPowerUp(powerUp.type);
      powerUp = null;
    }

    if (!ate) snake.pop();

    updateInfo();
    updateEffectsUI();
    draw();
  }

  function endGame() {
    running = false;
    gameOver = true;
    bonusFood = null;
    powerUp = null;
    slowUntil = 0;
    shieldActive = false;
    doubleUntil = 0;
    clearInterval(gameLoop);
    updateEffectsUI();

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
    const scoreEl = document.getElementById('snake-score');
    const highEl = document.getElementById('snake-high');
    const levelEl = document.getElementById('snake-level');
    if (scoreEl) scoreEl.textContent = score || 0;
    if (highEl) highEl.textContent = highScore;
    if (levelEl) levelEl.textContent = getLevel();
  }

  function updateEffectsUI() {
    const el = document.getElementById('snake-effects');
    if (!el) return;
    const now = Date.now();
    const pills = [];
    if (slowUntil && now < slowUntil) {
      const secs = Math.ceil((slowUntil - now) / 1000);
      pills.push(`<span class="snake-effect-pill" style="border-color:#56D4F5;color:#56D4F5;background:rgba(86,212,245,0.12)">SLOW ${secs}s</span>`);
    }
    if (shieldActive) {
      pills.push(`<span class="snake-effect-pill" style="border-color:#3FB950;color:#3FB950;background:rgba(63,185,80,0.12)">SHIELD</span>`);
    }
    if (doubleUntil && now < doubleUntil) {
      const secs = Math.ceil((doubleUntil - now) / 1000);
      pills.push(`<span class="snake-effect-pill" style="border-color:#FF9F1C;color:#FF9F1C;background:rgba(255,159,28,0.12)">×2 ${secs}s</span>`);
    }
    el.innerHTML = pills.join('');
  }

  // ---- Canvas helpers ----

  function drawDiamond(cx, cy, r) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
  }

  function drawHexagon(cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawStar(cx, cy, outerR, innerR) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
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

    // Snake — tinted green when SHIELD is active
    const headColor = shieldActive ? '#3FB950' : '#6C63FF';
    snake.forEach((seg, i) => {
      const brightness = 1 - (i / snake.length) * 0.5;
      if (i === 0) {
        ctx.fillStyle = headColor;
        ctx.shadowColor = headColor;
        ctx.shadowBlur = 8;
      } else {
        const c = shieldActive ? '63, 185, 80' : '108, 99, 255';
        ctx.fillStyle = `rgba(${c}, ${brightness})`;
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

    // Power-up — distinct shape per type, fades in last 2s
    if (powerUp) {
      const cfg = PUPS[powerUp.type];
      const timeLeft = powerUp.expireAt - Date.now();
      const alpha = timeLeft < 2000 ? timeLeft / 2000 : 1;
      const pulse = Math.sin(Date.now() / 150) * 1;
      const cx = powerUp.x * GRID + GRID / 2;
      const cy = powerUp.y * GRID + GRID / 2;
      const r = GRID / 2 - 1 + pulse * 0.5;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = cfg.glow;
      ctx.shadowBlur = 12 + pulse * 2;
      ctx.fillStyle = cfg.color;

      if (powerUp.type === 'SLOW') {
        drawDiamond(cx, cy, r);
      } else if (powerUp.type === 'SHIELD') {
        drawHexagon(cx, cy, r);
      } else {
        drawStar(cx, cy, r, r * 0.45);
      }
      ctx.fill();

      // Inset symbol
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0d1117';
      ctx.font = `bold ${Math.floor(GRID * 0.42)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cfg.sym, cx, cy + 1);
      ctx.restore();
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
    running = false;
  }

  return { init, start, destroy, toggleWallWrap };
})();
