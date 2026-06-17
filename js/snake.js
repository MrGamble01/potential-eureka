/* ============================================
   SNAKE — Classic arcade game
   ============================================ */

const SnakeGame = (() => {
  const GRID = 20;          // grid cell size in pixels
  const COLS = 30;
  const ROWS = 20;
  const WIDTH = COLS * GRID;
  const HEIGHT = ROWS * GRID;

  let canvas, ctx;
  let snake, direction, nextDirection;
  let food, bonusFood, score, highScore, speed;
  let foodCount, wallWrap;
  let gameLoop, running, gameOver, paused;

  // Power-ups
  let slowPowerup, shrinkPowerup;
  let slowActive, slowEndTime, preSlowSpeed;

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
    paused = false;
    foodCount = 0;
    bonusFood = null;
    slowPowerup = null;
    shrinkPowerup = null;
    slowActive = false;
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
    // Pause toggle
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      if (running && !gameOver) { togglePause(); e.preventDefault(); }
      return;
    }
    switch (e.key) {
      case 'ArrowUp':    case 'w': case 'W': if (!paused) setDir(0, -1); e.preventDefault(); break;
      case 'ArrowDown':  case 's': case 'S': if (!paused) setDir(0, 1);  e.preventDefault(); break;
      case 'ArrowLeft':  case 'a': case 'A': if (!paused) setDir(-1, 0); e.preventDefault(); break;
      case 'ArrowRight': case 'd': case 'D': if (!paused) setDir(1, 0);  e.preventDefault(); break;
      case ' ':
        if (gameOver) start();
        e.preventDefault();
        break;
    }
  }

  function togglePause() {
    paused = !paused;
    if (paused) {
      clearInterval(gameLoop);
      draw();
      // Draw pause overlay on top of current frame
      ctx.fillStyle = 'rgba(13, 17, 23, 0.62)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#E6EDF3';
      ctx.font = 'bold 22px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', WIDTH / 2, HEIGHT / 2);
      ctx.font = '12px Inter, sans-serif';
      ctx.fillStyle = '#7D8590';
      ctx.fillText('Press P or Escape to resume', WIDTH / 2, HEIGHT / 2 + 24);
      ctx.textAlign = 'left';
      updatePauseBtn(true);
    } else {
      updatePauseBtn(false);
      gameLoop = setInterval(tick, speed);
    }
  }

  function updatePauseBtn(isPaused) {
    const btn = document.getElementById('snake-pause-btn');
    if (btn) btn.textContent = isPaused ? 'Resume' : 'Pause';
  }

  function start() {
    snake = [{ x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) }];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    foodCount = 0;
    bonusFood = null;
    slowPowerup = null;
    shrinkPowerup = null;
    slowActive = false;
    gameOver = false;
    paused = false;
    running = true;
    speed = 120;
    spawnFood();
    updateInfo();
    updatePauseBtn(false);

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

  function spawnPowerup(type) {
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
    const obj = { ...pos, expireAt: Date.now() + 6000 };
    if (type === 'slow') slowPowerup = obj;
    else shrinkPowerup = obj;
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
      btn.style.color = wallWrap ? '#3FB950' : '';
    }
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

    // Self collision
    if (snake.some(s => s.x === head.x && s.y === head.y)) {
      return endGame();
    }

    snake.unshift(head);

    // Expire bonus food
    if (bonusFood && Date.now() > bonusFood.expireAt) bonusFood = null;

    // Expire power-ups
    if (slowPowerup  && Date.now() > slowPowerup.expireAt)  slowPowerup  = null;
    if (shrinkPowerup && Date.now() > shrinkPowerup.expireAt) shrinkPowerup = null;

    // Expire slow effect
    if (slowActive && Date.now() > slowEndTime) {
      slowActive = false;
      speed = preSlowSpeed;
      clearInterval(gameLoop);
      gameLoop = setInterval(tick, speed);
    }

    let ate = false;

    // Eat regular food
    if (head.x === food.x && head.y === food.y) {
      ate = true;
      score += 10;
      foodCount++;
      if (score > highScore) {
        highScore = score;
        Utils.store.setRaw('snake-high', String(highScore));
      }
      spawnFood();
      // Spawn bonus food every 5 regular foods
      if (foodCount % 5 === 0) spawnBonusFood();
      // Spawn slow power-up every 7 regular foods
      if (foodCount % 7 === 0) spawnPowerup('slow');
      // 20% chance to spawn shrink power-up
      if (!shrinkPowerup && Math.random() < 0.20) spawnPowerup('shrink');
      // Speed up slightly (only if slow effect isn't active)
      if (!slowActive && speed > 60) {
        speed -= 2;
        clearInterval(gameLoop);
        gameLoop = setInterval(tick, speed);
      } else if (slowActive) {
        // Track real speed without slow
        preSlowSpeed = Math.max(60, preSlowSpeed - 2);
      }
    } else if (bonusFood && head.x === bonusFood.x && head.y === bonusFood.y) {
      ate = true;
      score += 50;
      bonusFood = null;
      if (score > highScore) {
        highScore = score;
        Utils.store.setRaw('snake-high', String(highScore));
      }
    } else if (slowPowerup && head.x === slowPowerup.x && head.y === slowPowerup.y) {
      ate = true;
      slowPowerup = null;
      score += 20;
      if (score > highScore) {
        highScore = score;
        Utils.store.setRaw('snake-high', String(highScore));
      }
      // Apply slow: halve current speed (larger interval = slower)
      if (!slowActive) preSlowSpeed = speed;
      slowActive = true;
      slowEndTime = Date.now() + 8000;
      speed = Math.min(220, preSlowSpeed * 2.2);
      clearInterval(gameLoop);
      gameLoop = setInterval(tick, speed);
    } else if (shrinkPowerup && head.x === shrinkPowerup.x && head.y === shrinkPowerup.y) {
      ate = true;
      shrinkPowerup = null;
      score += 30;
      if (score > highScore) {
        highScore = score;
        Utils.store.setRaw('snake-high', String(highScore));
      }
      // Remove 5 tail segments (keep at least head + 1)
      if (snake.length > 2) {
        snake = snake.slice(0, Math.max(2, snake.length - 5));
      }
    }

    if (!ate) snake.pop();

    updateInfo();
    draw();
  }

  function endGame() {
    running = false;
    gameOver = false;
    paused = false;
    bonusFood = null;
    slowPowerup = null;
    shrinkPowerup = null;
    slowActive = false;
    clearInterval(gameLoop);
    gameOver = true;
    updatePauseBtn(false);

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
    const highEl  = document.getElementById('snake-high');
    const levelEl = document.getElementById('snake-level');
    const slowEl  = document.getElementById('snake-slow-indicator');
    if (scoreEl) scoreEl.textContent = score || 0;
    if (highEl)  highEl.textContent  = highScore;
    if (levelEl) levelEl.textContent = getLevel();
    if (slowEl)  slowEl.style.display = slowActive ? 'inline' : 'none';
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
      // Draw eyes on the head
      if (i === 0) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        const ex = seg.x * GRID + GRID / 2;
        const ey = seg.y * GRID + GRID / 2;
        const eyeOff = 4;
        const pupOff = 1.5;
        // Left eye
        ctx.beginPath();
        ctx.arc(ex - eyeOff + direction.x * pupOff, ey - eyeOff + direction.y * pupOff, 2.5, 0, Math.PI * 2);
        ctx.fill();
        // Right eye
        ctx.beginPath();
        ctx.arc(ex + eyeOff + direction.x * pupOff, ey + eyeOff + direction.y * pupOff, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(ex - eyeOff + direction.x * (pupOff + 0.8), ey - eyeOff + direction.y * (pupOff + 0.8), 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex + eyeOff + direction.x * (pupOff + 0.8), ey + eyeOff + direction.y * (pupOff + 0.8), 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
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

    // Slow power-up — cyan diamond, fades in last 1.5s
    if (slowPowerup) {
      const timeLeft = slowPowerup.expireAt - Date.now();
      const alpha = timeLeft < 1500 ? timeLeft / 1500 : 1;
      const pulse = Math.sin(Date.now() / 100) * 1.2;
      const cx = slowPowerup.x * GRID + GRID / 2;
      const cy = slowPowerup.y * GRID + GRID / 2;
      const r = GRID / 2 - 1 + pulse;
      ctx.fillStyle = `rgba(88, 210, 255, ${alpha})`;
      ctx.shadowColor = '#58D2FF';
      ctx.shadowBlur = 12 + pulse;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Shrink power-up — lime star/square, fades in last 1.5s
    if (shrinkPowerup) {
      const timeLeft = shrinkPowerup.expireAt - Date.now();
      const alpha = timeLeft < 1500 ? timeLeft / 1500 : 1;
      const pulse = Math.sin(Date.now() / 90) * 1.0;
      const sz = GRID - 4 + pulse;
      ctx.fillStyle = `rgba(63, 185, 80, ${alpha})`;
      ctx.shadowColor = '#3FB950';
      ctx.shadowBlur = 12 + pulse;
      // Rounded square
      const rx = shrinkPowerup.x * GRID + (GRID - sz) / 2;
      const ry = shrinkPowerup.y * GRID + (GRID - sz) / 2;
      ctx.beginPath();
      ctx.roundRect(rx, ry, sz, sz, 3);
      ctx.fill();
      // "−" minus sign to suggest shrink
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.shadowBlur = 0;
      ctx.fillRect(rx + sz * 0.25, ry + sz * 0.44, sz * 0.5, sz * 0.12);
    }

    ctx.shadowBlur = 0;

    // Slow active indicator bar (bottom of canvas)
    if (slowActive) {
      const remaining = Math.max(0, slowEndTime - Date.now()) / 8000;
      ctx.fillStyle = 'rgba(88, 210, 255, 0.18)';
      ctx.fillRect(0, HEIGHT - 4, WIDTH, 4);
      ctx.fillStyle = '#58D2FF';
      ctx.fillRect(0, HEIGHT - 4, WIDTH * remaining, 4);
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
      ctx.fillText('WASD or Arrow Keys · P to pause', WIDTH / 2, HEIGHT / 2 + 24);
      ctx.textAlign = 'left';
    }
  }

  function destroy() {
    clearInterval(gameLoop);
    running = false;
  }

  return { init, start, destroy, toggleWallWrap, togglePause };
})();
