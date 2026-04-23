/* ============================================
   SNAKE — Classic arcade game with bonus food
   ============================================ */

const SnakeGame = (() => {
  const GRID = 20;
  const COLS = 30;
  const ROWS = 20;
  const WIDTH = COLS * GRID;
  const HEIGHT = ROWS * GRID;

  let canvas, ctx;
  let snake, direction, nextDirection;
  let food, score, highScore, speed;
  let gameLoop, drawFrameId, running, gameOver;
  let bonusFood, bonusTimeout, foodEaten;

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
    bonusFood = null;
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
    speed = 120;
    foodEaten = 0;
    bonusFood = null;
    clearTimeout(bonusTimeout);
    spawnFood();
    updateInfo();

    const overlay = document.getElementById('snake-overlay');
    if (overlay) overlay.style.display = 'none';

    clearInterval(gameLoop);
    gameLoop = setInterval(tick, speed);

    cancelAnimationFrame(drawFrameId);
    drawFrameId = requestAnimationFrame(drawLoop);
  }

  function drawLoop() {
    draw();
    if (running) drawFrameId = requestAnimationFrame(drawLoop);
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
    clearTimeout(bonusTimeout);
    const occupied = new Set(snake.map(s => `${s.x},${s.y}`));
    occupied.add(`${food.x},${food.y}`);
    let pos;
    let attempts = 0;
    do {
      pos = {
        x: Math.floor(Math.random() * COLS),
        y: Math.floor(Math.random() * ROWS),
      };
      attempts++;
    } while (occupied.has(`${pos.x},${pos.y}`) && attempts < 100);

    bonusFood = { ...pos, spawnTime: Date.now(), duration: 5000 };
    bonusTimeout = setTimeout(() => { bonusFood = null; }, 5000);
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
    let ate = false;

    if (head.x === food.x && head.y === food.y) {
      ate = true;
      score += 10;
      foodEaten++;
      if (score > highScore) {
        highScore = score;
        Utils.store.setRaw('snake-high', String(highScore));
      }
      spawnFood();
      // Spawn bonus food every 3rd regular food eaten
      if (foodEaten % 3 === 0) spawnBonusFood();
      if (speed > 60) {
        speed -= 2;
        clearInterval(gameLoop);
        gameLoop = setInterval(tick, speed);
      }
    } else if (bonusFood && head.x === bonusFood.x && head.y === bonusFood.y) {
      ate = true;
      score += 30;
      if (score > highScore) {
        highScore = score;
        Utils.store.setRaw('snake-high', String(highScore));
      }
      clearTimeout(bonusTimeout);
      bonusFood = null;
    }

    if (!ate) snake.pop();
    updateInfo();
  }

  function endGame() {
    running = false;
    gameOver = true;
    clearInterval(gameLoop);
    clearTimeout(bonusTimeout);
    bonusFood = null;
    cancelAnimationFrame(drawFrameId);
    draw();

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

    // Bonus food — gold diamond with pulsing glow and countdown
    if (bonusFood) {
      const now = Date.now();
      const elapsed = now - bonusFood.spawnTime;
      const remaining = bonusFood.duration - elapsed;
      const pulse = 0.5 + 0.5 * Math.sin(elapsed / 180);
      const flicker = remaining < 1500;
      const visible = !flicker || (Math.floor(now / (remaining < 500 ? 80 : 130)) % 2 === 0);

      if (visible) {
        const cx = bonusFood.x * GRID + GRID / 2;
        const cy = bonusFood.y * GRID + GRID / 2;
        const size = (GRID / 2 - 1) * (0.85 + 0.15 * pulse);

        ctx.fillStyle = `rgba(255, 200, 50, ${0.8 + 0.2 * pulse})`;
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 8 + 10 * pulse;
        ctx.beginPath();
        ctx.moveTo(cx, cy - size);
        ctx.lineTo(cx + size * 0.7, cy);
        ctx.lineTo(cx, cy + size);
        ctx.lineTo(cx - size * 0.7, cy);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        // Countdown seconds above the diamond
        const secs = Math.ceil(remaining / 1000);
        ctx.fillStyle = `rgba(255, 215, 0, ${0.6 + 0.4 * pulse})`;
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${secs}s`, cx, bonusFood.y * GRID - 2);
        ctx.textAlign = 'left';
      }
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
      ctx.fillText('WASD or Arrow Keys  ·  +30pts for gold diamond', WIDTH / 2, HEIGHT / 2 + 24);
      ctx.textAlign = 'left';
    }
  }

  function destroy() {
    clearInterval(gameLoop);
    cancelAnimationFrame(drawFrameId);
    clearTimeout(bonusTimeout);
    running = false;
  }

  return { init, start, destroy };
})();
