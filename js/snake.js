/* ============================================
   SNAKE — Classic arcade game with power-ups
   ============================================ */

const SnakeGame = (() => {
  const GRID = 20;
  const COLS = 30;
  const ROWS = 20;
  const WIDTH = COLS * GRID;
  const HEIGHT = ROWS * GRID;

  const POWERUP_TYPES = ['bonus', 'slow', 'multiplier'];
  const POWERUP_CONFIG = {
    bonus:      { color: '#F0C040', label: 'BONUS +30',  duration: 0 },
    slow:       { color: '#58A6FF', label: 'SLOW-MO',    duration: 5000 },
    multiplier: { color: '#FF6BE8', label: '2x SCORE',   duration: 5000 },
  };

  let canvas, ctx;
  let snake, direction, nextDirection;
  let food, powerUp, powerUpExpiry;
  let activeBuff, buffExpiry;
  let score, highScore, speed;
  let scoreMultiplier;
  let gameLoop, running, gameOver;
  let animFrame;

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
    scoreMultiplier = 1;
    activeBuff = null;
    buffExpiry = 0;
    powerUp = null;
    powerUpExpiry = 0;
    gameOver = false;
    running = true;

    const diff = document.getElementById('snake-difficulty')?.value || 'normal';
    speed = diff === 'easy' ? 160 : diff === 'hard' ? 80 : 120;

    spawnFood();
    updateInfo();

    const overlay = document.getElementById('snake-overlay');
    if (overlay) overlay.style.display = 'none';

    clearInterval(gameLoop);
    gameLoop = setInterval(tick, speed);

    cancelAnimationFrame(animFrame);
    renderLoop();
  }

  function getEmptyCell() {
    let cell;
    do {
      cell = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    } while (
      snake.some(s => s.x === cell.x && s.y === cell.y) ||
      (food && food.x === cell.x && food.y === cell.y) ||
      (powerUp && powerUp.x === cell.x && powerUp.y === cell.y)
    );
    return cell;
  }

  function spawnFood() {
    food = getEmptyCell();
    if (!powerUp && Math.random() < 0.25) {
      const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
      powerUp = { ...getEmptyCell(), type };
      powerUpExpiry = Date.now() + 7000;
    }
  }

  function tick() {
    const now = Date.now();

    if (powerUp && now > powerUpExpiry) powerUp = null;

    if (activeBuff && now > buffExpiry) {
      if (activeBuff === 'multiplier') scoreMultiplier = 1;
      if (activeBuff === 'slow') {
        clearInterval(gameLoop);
        gameLoop = setInterval(tick, speed);
      }
      activeBuff = null;
    }

    direction = { ...nextDirection };
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) return endGame();
    if (snake.some(s => s.x === head.x && s.y === head.y)) return endGame();

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      score += 10 * scoreMultiplier;
      if (score > highScore) {
        highScore = score;
        Utils.store.setRaw('snake-high', String(highScore));
      }
      spawnFood();
      if (speed > 60) {
        speed -= 2;
        if (activeBuff !== 'slow') {
          clearInterval(gameLoop);
          gameLoop = setInterval(tick, speed);
        }
      }
    } else if (powerUp && head.x === powerUp.x && head.y === powerUp.y) {
      const type = powerUp.type;
      if (type === 'bonus') {
        score += 30;
        if (score > highScore) {
          highScore = score;
          Utils.store.setRaw('snake-high', String(highScore));
        }
      } else {
        activeBuff = type;
        buffExpiry = now + POWERUP_CONFIG[type].duration;
        if (type === 'multiplier') {
          scoreMultiplier = 2;
        } else if (type === 'slow') {
          clearInterval(gameLoop);
          gameLoop = setInterval(tick, speed * 2);
        }
      }
      powerUp = null;
      snake.pop();
    } else {
      snake.pop();
    }

    updateInfo();
  }

  function endGame() {
    running = false;
    gameOver = true;
    clearInterval(gameLoop);
    cancelAnimationFrame(animFrame);

    const overlay = document.getElementById('snake-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
      overlay.innerHTML = `
        <h2>GAME OVER</h2>
        <p>Score: ${score}</p>
        <p style="font-size:12px; color: var(--text-dim)">Press SPACE to restart</p>
      `;
    }
    draw();
  }

  function updateInfo() {
    const scoreEl = document.getElementById('snake-score');
    const highEl = document.getElementById('snake-high');
    const buffEl = document.getElementById('snake-buff');
    if (scoreEl) scoreEl.textContent = score || 0;
    if (highEl) highEl.textContent = highScore;
    if (buffEl) {
      if (activeBuff) {
        const remaining = Math.ceil((buffExpiry - Date.now()) / 1000);
        const cfg = POWERUP_CONFIG[activeBuff];
        buffEl.innerHTML = `<span style="color:${cfg.color}">${cfg.label} (${remaining}s)</span>`;
      } else {
        buffEl.innerHTML = '';
      }
    }
  }

  function renderLoop() {
    if (!running) return;
    draw();
    updateInfo();
    animFrame = requestAnimationFrame(renderLoop);
  }

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

    // Snake
    const isMultiplier = activeBuff === 'multiplier';
    const headColor = isMultiplier ? '#FF6BE8' : '#6C63FF';
    snake.forEach((seg, i) => {
      const brightness = 1 - (i / snake.length) * 0.5;
      if (i === 0) {
        ctx.fillStyle = headColor;
        ctx.shadowColor = headColor;
        ctx.shadowBlur = 10;
      } else {
        ctx.fillStyle = isMultiplier
          ? `rgba(255, 107, 232, ${brightness})`
          : `rgba(108, 99, 255, ${brightness})`;
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

    // Power-up (pulsing diamond)
    if (powerUp) {
      const cfg = POWERUP_CONFIG[powerUp.type];
      const pulse = 0.75 + 0.25 * Math.sin(Date.now() / 180);
      const cx = powerUp.x * GRID + GRID / 2;
      const cy = powerUp.y * GRID + GRID / 2;
      const r = (GRID / 2 - 1) * pulse;

      ctx.fillStyle = cfg.color;
      ctx.shadowColor = cfg.color;
      ctx.shadowBlur = 14 * pulse;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // Countdown arc around power-up
      const timeLeft = Math.max(0, powerUpExpiry - Date.now());
      const angle = (timeLeft / 7000) * Math.PI * 2;
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(cx, cy, GRID / 2 - 0.5, -Math.PI / 2, -Math.PI / 2 + angle);
      ctx.stroke();
      ctx.globalAlpha = 1;
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
    cancelAnimationFrame(animFrame);
    running = false;
  }

  return { init, start, destroy };
})();
