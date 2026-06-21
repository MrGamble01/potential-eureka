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
    foodCount = 0;
    bonusFood = null;
    particles = [];
    wallWrap = false;
    updateInfo();
    startDrawLoop();

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
    particles = [];
    gameOver = false;
    running = true;
    speed = 120;
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

  function spawnParticle(gridX, gridY, text, color) {
    particles.push({
      x: gridX * GRID + GRID / 2,
      y: gridY * GRID,
      text,
      color,
      startTime: Date.now(),
      duration: 900,
    });
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
      if (score > highScore) {
        highScore = score;
        Utils.store.setRaw('snake-high', String(highScore));
      }
      spawnParticle(head.x, head.y, '+10', '#F778BA');
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
      // Eat bonus food (snake also grows)
      ate = true;
      score += 50;
      spawnParticle(head.x, head.y, '+50', '#F7C948');
      bonusFood = null;
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
    const scoreEl = document.getElementById('snake-score');
    const highEl = document.getElementById('snake-high');
    const levelEl = document.getElementById('snake-level');
    if (scoreEl) scoreEl.textContent = score || 0;
    if (highEl) highEl.textContent = highScore;
    if (levelEl) levelEl.textContent = getLevel();
  }

  function startDrawLoop() {
    cancelAnimationFrame(animFrame);
    function loop() {
      draw();
      animFrame = requestAnimationFrame(loop);
    }
    animFrame = requestAnimationFrame(loop);
  }

  function drawEyes() {
    if (!snake.length || !running) return;
    const head = snake[0];
    const hx = head.x * GRID;
    const hy = head.y * GRID;
    const near = 5;
    const far = GRID - 5;

    let e1x, e1y, e2x, e2y;
    if (direction.x === 1) {
      e1x = hx + far;  e1y = hy + near;
      e2x = hx + far;  e2y = hy + far;
    } else if (direction.x === -1) {
      e1x = hx + near; e1y = hy + near;
      e2x = hx + near; e2y = hy + far;
    } else if (direction.y === -1) {
      e1x = hx + near; e1y = hy + near;
      e2x = hx + far;  e2y = hy + near;
    } else {
      e1x = hx + near; e1y = hy + far;
      e2x = hx + far;  e2y = hy + far;
    }

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(e1x, e1y, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(e2x, e2y, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(e1x, e1y, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(e2x, e2y, 1.2, 0, Math.PI * 2); ctx.fill();
  }

  function drawParticles() {
    const now = Date.now();
    particles = particles.filter(p => now - p.startTime < p.duration);
    if (!particles.length) return;

    ctx.save();
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.textAlign = 'center';
    particles.forEach(p => {
      const progress = (now - p.startTime) / p.duration;
      const alpha = 1 - progress;
      const dy = progress * 36;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.fillText(p.text, p.x, p.y - dy);
    });
    ctx.restore();
  }

  function draw() {
    if (!ctx) return;
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

    // Eyes on the head
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

      // Countdown bar below the bonus food
      if (timeLeft > 0) {
        const barW = GRID + 6;
        const barH = 3;
        const bx = bonusFood.x * GRID + GRID / 2 - barW / 2;
        const by = bonusFood.y * GRID + GRID + 2;
        const fill = (timeLeft / 5000) * barW;
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(bx, by, barW, barH);
        const fillAlpha = timeLeft < 1500 ? timeLeft / 1500 : 1;
        ctx.fillStyle = `rgba(247, 201, 72, ${fillAlpha})`;
        ctx.fillRect(bx, by, fill, barH);
      }
    }

    // Floating score popups
    drawParticles();

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

  return { init, start, destroy, toggleWallWrap };
})();
