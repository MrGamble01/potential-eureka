/* ============================================
   SNAKE — Classic arcade game with power-ups
   ============================================ */

const SnakeGame = (() => {
  const GRID = 20;
  const COLS = 30;
  const ROWS = 20;
  const WIDTH = COLS * GRID;
  const HEIGHT = ROWS * GRID;

  const POWERUP_TYPES = {
    bonus: { color: '#FFD700', glow: '#FFD700', label: 'BONUS', points: 30 },
    slow:  { color: '#00CED1', glow: '#00CED1', label: 'SLOW',  points: 10 },
  };

  let canvas, ctx;
  let snake, direction, nextDirection;
  let food, powerUp, powerUpExpiry;
  let effect, effectExpiry;
  let score, highScore, speed, baseSpeed;
  let foodEaten;
  let gameLoop, running, gameOver;
  let floatTexts;

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
    floatTexts = [];
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
    speed = 120;
    foodEaten = 0;
    powerUp = null;
    powerUpExpiry = 0;
    effect = null;
    effectExpiry = 0;
    floatTexts = [];
    spawnFood();
    updateInfo();

    const overlay = document.getElementById('snake-overlay');
    if (overlay) overlay.style.display = 'none';

    clearInterval(gameLoop);
    gameLoop = setInterval(tick, speed);
  }

  function spawnFood() {
    const occupied = new Set(snake.map(s => `${s.x},${s.y}`));
    if (powerUp) occupied.add(`${powerUp.x},${powerUp.y}`);
    let pos;
    do {
      pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    } while (occupied.has(`${pos.x},${pos.y}`));
    food = pos;
  }

  function spawnPowerUp() {
    const occupied = new Set(snake.map(s => `${s.x},${s.y}`));
    occupied.add(`${food.x},${food.y}`);
    let pos;
    do {
      pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    } while (occupied.has(`${pos.x},${pos.y}`));
    const types = Object.keys(POWERUP_TYPES);
    const type = types[Math.floor(Math.random() * types.length)];
    powerUp = { ...pos, type };
    powerUpExpiry = Date.now() + 7000;
  }

  function applySpeed(newBase) {
    baseSpeed = newBase;
    speed = effect === 'slow' ? Math.min(baseSpeed + 50, 200) : baseSpeed;
    clearInterval(gameLoop);
    gameLoop = setInterval(tick, speed);
  }

  function tick() {
    const now = Date.now();

    // Expire power-up on the board
    if (powerUp && now > powerUpExpiry) {
      powerUp = null;
    }

    // Expire active effect
    if (effect && now > effectExpiry) {
      effect = null;
      speed = baseSpeed;
      clearInterval(gameLoop);
      gameLoop = setInterval(tick, speed);
    }

    direction = { ...nextDirection };
    const head = {
      x: snake[0].x + direction.x,
      y: snake[0].y + direction.y,
    };

    // Wall collision
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      return endGame();
    }

    // Self collision
    if (snake.some(s => s.x === head.x && s.y === head.y)) {
      return endGame();
    }

    snake.unshift(head);

    let grew = false;

    if (head.x === food.x && head.y === food.y) {
      // Eat regular food
      grew = true;
      score += 10;
      foodEaten++;
      addFloat(head.x, head.y, '+10', '#F778BA');

      if (score > highScore) {
        highScore = score;
        Utils.store.setRaw('snake-high', String(highScore));
      }

      spawnFood();

      // Occasionally spawn a power-up
      if (!powerUp && foodEaten % 4 === 0 && Math.random() < 0.75) {
        spawnPowerUp();
      }

      // Speed up
      if (baseSpeed > 60) {
        applySpeed(baseSpeed - 2);
      }

    } else if (powerUp && head.x === powerUp.x && head.y === powerUp.y) {
      // Eat power-up
      grew = true;
      const def = POWERUP_TYPES[powerUp.type];
      score += def.points;
      addFloat(head.x, head.y, `+${def.points} ${def.label}!`, def.color);

      if (score > highScore) {
        highScore = score;
        Utils.store.setRaw('snake-high', String(highScore));
      }

      if (powerUp.type === 'slow') {
        effect = 'slow';
        effectExpiry = now + 5000;
        speed = Math.min(baseSpeed + 50, 200);
        clearInterval(gameLoop);
        gameLoop = setInterval(tick, speed);
      }

      powerUp = null;
    }

    if (!grew) snake.pop();

    // Animate floating texts
    floatTexts = floatTexts.filter(f => f.alpha > 0);
    floatTexts.forEach(f => {
      f.y -= 0.5;
      f.alpha -= 0.02;
    });

    updateInfo();
    draw();
  }

  function addFloat(gx, gy, text, color) {
    floatTexts.push({ x: gx * GRID + GRID / 2, y: gy * GRID, text, color, alpha: 1 });
  }

  function endGame() {
    running = false;
    gameOver = true;
    clearInterval(gameLoop);
    effect = null;
    powerUp = null;

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
    const highEl  = document.getElementById('snake-high');
    const effEl   = document.getElementById('snake-effect');
    if (scoreEl) scoreEl.textContent = score || 0;
    if (highEl)  highEl.textContent  = highScore;
    if (effEl) {
      if (effect === 'slow') {
        const secs = Math.max(0, Math.ceil((effectExpiry - Date.now()) / 1000));
        effEl.textContent = `SLOW ${secs}s`;
        effEl.style.color = '#00CED1';
      } else {
        effEl.textContent = '';
      }
    }
  }

  function draw() {
    const now = Date.now();
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

    // Snake (cyan tint when slow is active)
    const headColor = effect === 'slow' ? '#00CED1' : '#6C63FF';
    snake.forEach((seg, i) => {
      const brightness = 1 - (i / snake.length) * 0.5;
      if (i === 0) {
        ctx.fillStyle = headColor;
        ctx.shadowColor = headColor;
        ctx.shadowBlur = 8;
      } else {
        ctx.fillStyle = effect === 'slow'
          ? `rgba(0, 206, 209, ${brightness})`
          : `rgba(108, 99, 255, ${brightness})`;
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

    // Power-up (pulsing glow)
    if (powerUp) {
      const def = POWERUP_TYPES[powerUp.type];
      const pulse = 0.7 + 0.3 * Math.sin(now / 200);
      ctx.fillStyle = def.color;
      ctx.shadowColor = def.glow;
      ctx.shadowBlur = 14 * pulse;
      ctx.beginPath();
      ctx.arc(
        powerUp.x * GRID + GRID / 2,
        powerUp.y * GRID + GRID / 2,
        (GRID / 2 - 2) * pulse,
        0, Math.PI * 2
      );
      ctx.fill();
      ctx.shadowBlur = 0;
      // Single letter label inside
      ctx.fillStyle = '#0d1117';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.label[0], powerUp.x * GRID + GRID / 2, powerUp.y * GRID + GRID / 2);
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
    }

    // Floating score texts
    floatTexts.forEach(f => {
      ctx.globalAlpha = f.alpha;
      ctx.fillStyle = f.color;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';

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

  return { init, start, destroy };
})();
