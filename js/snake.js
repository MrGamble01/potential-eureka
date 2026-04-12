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
  let food, score, highScore, speed;
  let gameLoop, running, gameOver;

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

  function tick() {
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

    // Eat food
    if (head.x === food.x && head.y === food.y) {
      score += 10;
      if (score > highScore) {
        highScore = score;
        Utils.store.setRaw('snake-high', String(highScore));
      }
      spawnFood();
      // Speed up slightly
      if (speed > 60) {
        speed -= 2;
        clearInterval(gameLoop);
        gameLoop = setInterval(tick, speed);
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

  return { init, start };
})();
