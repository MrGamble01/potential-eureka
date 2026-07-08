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
  let gameLoop, running, gameOver;
  let particles = [];
  let animFrame = null;
  let lastRafTime = 0;

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
    wallWrap = false;
    particles = [];
    updateInfo();

    document.addEventListener('keydown', handleKey);

    // Tap the game-over overlay to restart (it covers the canvas)
    const overlayEl = document.getElementById('snake-overlay');
    if (overlayEl) overlayEl.addEventListener('click', () => { if (gameOver) start(); });

    // Mobile swipe support
    let touchStartX, touchStartY;
    canvas.addEventListener('touchstart', e => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    });
    canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    canvas.addEventListener('touchend', e => {
      if (!running && !gameOver) { start(); return; }
      if (gameOver) { start(); return; }
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

    // Start the smooth render loop — replaces one-shot draw() call
    if (animFrame) cancelAnimationFrame(animFrame);
    lastRafTime = performance.now();
    animFrame = requestAnimationFrame(renderLoop);
  }

  // ---- Render loop (runs at display refresh rate, independent of game tick) ----
  function renderLoop(ts) {
    const dt = Math.min((ts - lastRafTime) / 1000, 0.1);
    lastRafTime = ts;

    // Advance particles
    particles = particles.filter(p => p.life > 0);
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.82;
      p.vy *= 0.82;
      p.life -= dt * 2.8;
    }

    draw();
    animFrame = requestAnimationFrame(renderLoop);
  }

  function spawnParticles(gx, gy, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const spd = 1.5 + Math.random() * 2.5;
      particles.push({
        x: gx * GRID + GRID / 2,
        y: gy * GRID + GRID / 2,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color,
        size: 1.5 + Math.random() * 2,
        life: 1,
      });
    }
  }

  function setDir(dx, dy) {
    if (dx === 1 && direction.x !== -1) nextDirection = { x: 1, y: 0 };
    else if (dx === -1 && direction.x !== 1) nextDirection = { x: -1, y: 0 };
    else if (dy === 1 && direction.y !== -1) nextDirection = { x: 0, y: 1 };
    else if (dy === -1 && direction.y !== 1) nextDirection = { x: 0, y: -1 };
  }

  function handleKey(e) {
    // Only respond while the Snake view is actually on screen — the listener
    // is bound to document and never removed, so without this guard arrow/WASD
    // presses on other views would start a hidden game and block typing.
    const view = document.getElementById('view-snake');
    if (!view || !view.classList.contains('active')) return;
    if (!running && !gameOver && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 'W', 'a', 'A', 's', 'S', 'd', 'D'].includes(e.key)) {
      e.preventDefault();
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
    gameOver = false;
    running = true;
    speed = 120;
    particles = [];
    spawnFood();
    updateInfo();

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
    if (bonusFood && Date.now() > bonusFood.expireAt) {
      bonusFood = null;
    }

    let ate = false;

    // Eat regular food
    if (head.x === food.x && head.y === food.y) {
      ate = true;
      score += 10;
      foodCount++;
      if (typeof SFX !== 'undefined') SFX.play('eat');
      if (score > highScore) {
        highScore = score;
        Utils.store.setRaw('snake-high', String(highScore));
      }
      spawnParticles(food.x, food.y, '#F778BA', 8);
      spawnFood();
      // Spawn bonus food every 5 regular foods
      if (foodCount % 5 === 0) spawnBonusFood();
      // Speed up slightly
      if (speed > 60) {
        speed -= 2;
        clearInterval(gameLoop);
        gameLoop = setInterval(tick, speed);
      }
    } else if (bonusFood && head.x === bonusFood.x && head.y === bonusFood.y) {
      // Eat bonus food
      ate = true;
      score += 50;
      spawnParticles(bonusFood.x, bonusFood.y, '#F7C948', 14);
      bonusFood = null;
      if (typeof SFX !== 'undefined') SFX.play('bonus');
      if (score > highScore) {
        highScore = score;
        Utils.store.setRaw('snake-high', String(highScore));
      }
    }

    if (!ate) snake.pop();

    updateInfo();
  }

  function endGame() {
    running = false;
    gameOver = true;
    bonusFood = null;
    if (typeof SFX !== 'undefined') SFX.play('die');
    clearInterval(gameLoop);

    // Death burst from head position
    if (snake.length > 0) {
      spawnParticles(snake[0].x, snake[0].y, '#6C63FF', 20);
    }

    const overlay = document.getElementById('snake-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
      overlay.innerHTML = `
        <h2>GAME OVER</h2>
        <p>Score: ${score} &nbsp;·&nbsp; Level: ${getLevel()}</p>
        <p style="font-size:12px; color: var(--text-dim)">Press SPACE or tap to restart</p>
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

  function drawEyes() {
    if (!snake.length || !running) return;
    const head = snake[0];
    const cx = head.x * GRID + GRID / 2;
    const cy = head.y * GRID + GRID / 2;

    // Perpendicular axis for eye spread
    const px = direction.y;
    const py = -direction.x;
    const fwd = 4;
    const spread = 3.5;

    for (const side of [1, -1]) {
      const ex = cx + direction.x * fwd + px * spread * side;
      const ey = cy + direction.y * fwd + py * spread * side;

      // White sclera
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Pupil, offset toward movement direction
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath();
      ctx.arc(ex + direction.x * 1, ey + direction.y * 1, 1.2, 0, Math.PI * 2);
      ctx.fill();
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

    // Snake body
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

    // Snake eyes (drawn over head segment)
    drawEyes();

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

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Start prompt
    if (!running && !gameOver) {
      ctx.fillStyle = 'rgba(13, 17, 23, 0.7)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#E6EDF3';
      ctx.font = '20px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Press any arrow key or tap to start', WIDTH / 2, HEIGHT / 2);
      ctx.font = '12px Inter, sans-serif';
      ctx.fillStyle = '#7D8590';
      ctx.fillText('WASD / Arrow Keys — or swipe to steer', WIDTH / 2, HEIGHT / 2 + 24);
      ctx.textAlign = 'left';
    }
  }

  function destroy() {
    clearInterval(gameLoop);
    if (animFrame) cancelAnimationFrame(animFrame);
    animFrame = null;
    running = false;
  }

  return { init, start, destroy, toggleWallWrap };
})();
