/* ============================================
   BREAKOUT — Classic brick-breaking arcade game
   ============================================ */

const BreakoutGame = (() => {
  const W = 600, H = 460;
  const COLS = 10, ROWS = 6;
  const GAP = 4, MARGIN = 8;
  const BRICK_TOP = 55, BRICK_H = 20;
  const PADDLE_H = 12, PADDLE_BOTTOM = 35;
  const BALL_R = 7;

  const PALETTE = [
    { fill: '#F7C948', pts: 50 },
    { fill: '#F85149', pts: 40 },
    { fill: '#FF8C00', pts: 30 },
    { fill: '#3FB950', pts: 20 },
    { fill: '#58A6FF', pts: 15 },
    { fill: '#8B83FF', pts: 10 },
  ];

  let canvas, ctx;
  let paddle, ball, bricks, particles;
  let score, highScore, lives, level;
  let state; // 'launch' | 'playing' | 'ball-lost' | 'game-over' | 'level-clear'
  let keys = {};
  let animId;
  let onKeyRef;

  function brickW() {
    return (W - MARGIN * 2 - GAP * (COLS - 1)) / COLS;
  }

  function init() {
    canvas = document.getElementById('breakout-canvas');
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;
    ctx = canvas.getContext('2d');

    highScore = parseInt(Utils.store.getRaw('breakout-high') || '0');
    score = 0; lives = 3; level = 1;
    keys = {}; particles = [];

    resetPaddle();
    buildBricks();
    resetBall();
    state = 'launch';
    updateHUD();

    onKeyRef = onKey;
    document.addEventListener('keydown', onKeyRef);
    document.addEventListener('keyup', e => { keys[e.key] = false; });
    canvas.addEventListener('mousemove', onMouse);
    canvas.addEventListener('touchmove', onTouch, { passive: false });
    canvas.addEventListener('click', onClick);

    animId = requestAnimationFrame(loop);
  }

  function resetPaddle() {
    const pw = Math.max(60, 100 - (level - 1) * 5);
    paddle = { x: W / 2 - pw / 2, y: H - PADDLE_BOTTOM - PADDLE_H, w: pw, h: PADDLE_H };
  }

  function resetBall() {
    const spd = 3.5 + (level - 1) * 0.45;
    const side = Math.random() > 0.5 ? 1 : -1;
    const t = 0.3 + Math.random() * 0.3; // angle from vertical (0.3–0.6 rad ≈ 17°–34°)
    ball = {
      x: paddle.x + paddle.w / 2,
      y: paddle.y - BALL_R,
      vx: spd * Math.sin(t) * side,
      vy: -spd * Math.cos(t),
      r: BALL_R,
    };
  }

  function buildBricks() {
    bricks = [];
    const bw = brickW();
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        bricks.push({
          x: MARGIN + col * (bw + GAP),
          y: BRICK_TOP + row * (BRICK_H + GAP),
          w: bw, h: BRICK_H,
          color: PALETTE[row],
          alive: true,
        });
      }
    }
  }

  function onKey(e) {
    keys[e.key] = true;
    if (['ArrowLeft', 'ArrowRight', ' ', 'a', 'A', 'd', 'D'].includes(e.key)) {
      e.preventDefault();
    }
    if (e.key === ' ') {
      if (state === 'launch')      launchBall();
      else if (state === 'ball-lost')  continueAfterLoss();
      else if (state === 'game-over')  fullRestart();
      else if (state === 'level-clear') advanceLevel();
    }
  }

  function onClick() {
    if (state === 'launch')       launchBall();
    else if (state === 'ball-lost')   continueAfterLoss();
    else if (state === 'game-over')   fullRestart();
    else if (state === 'level-clear') advanceLevel();
  }

  function onMouse(e) {
    const r = canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (W / r.width);
    paddle.x = Math.max(0, Math.min(W - paddle.w, mx - paddle.w / 2));
  }

  function onTouch(e) {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const mx = (e.touches[0].clientX - r.left) * (W / r.width);
    paddle.x = Math.max(0, Math.min(W - paddle.w, mx - paddle.w / 2));
    if (state === 'launch') launchBall();
  }

  function launchBall() {
    state = 'playing';
    hideOverlay();
  }

  function continueAfterLoss() {
    state = 'launch';
    resetBall();
    hideOverlay();
  }

  function fullRestart() {
    score = 0; lives = 3; level = 1;
    particles = [];
    resetPaddle(); buildBricks(); resetBall();
    state = 'launch';
    hideOverlay(); updateHUD();
  }

  function advanceLevel() {
    level++;
    particles = [];
    resetPaddle(); buildBricks(); resetBall();
    state = 'launch';
    hideOverlay(); updateHUD();
  }

  function showOverlay(h2, p1, p2) {
    const el = document.getElementById('breakout-overlay');
    if (!el) return;
    el.style.display = 'flex';
    const isWin = h2.includes('CLEAR') || h2.includes('LEVEL');
    el.innerHTML = `
      <h2 style="${isWin ? 'color:#6C63FF;text-shadow:0 0 24px rgba(108,99,255,0.5)' : ''}">${h2}</h2>
      <p>${p1}</p>
      <p style="font-size:12px;color:var(--text-dim)">${p2}</p>
    `;
  }

  function hideOverlay() {
    const el = document.getElementById('breakout-overlay');
    if (el) el.style.display = 'none';
  }

  function updateHUD() {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('breakout-score', score);
    set('breakout-high', highScore);
    set('breakout-lives', lives);
    set('breakout-level', level);
  }

  function burst(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1.5 + Math.random() * 4;
      particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        r: 1.5 + Math.random() * 3,
        alpha: 1,
        color,
      });
    }
  }

  function update() {
    // Keyboard paddle movement
    const ps = 6;
    if (keys['ArrowLeft']  || keys['a'] || keys['A']) paddle.x = Math.max(0, paddle.x - ps);
    if (keys['ArrowRight'] || keys['d'] || keys['D']) paddle.x = Math.min(W - paddle.w, paddle.x + ps);

    // Ball follows paddle in launch state
    if (state === 'launch') {
      ball.x = paddle.x + paddle.w / 2;
      ball.y = paddle.y - ball.r;
      return;
    }

    if (state !== 'playing') return;

    ball.x += ball.vx;
    ball.y += ball.vy;

    // Wall bounces
    if (ball.x - ball.r < 0)  { ball.x = ball.r;      ball.vx =  Math.abs(ball.vx); }
    if (ball.x + ball.r > W)  { ball.x = W - ball.r;  ball.vx = -Math.abs(ball.vx); }
    if (ball.y - ball.r < 0)  { ball.y = ball.r;      ball.vy =  Math.abs(ball.vy); }

    // Ball lost
    if (ball.y - ball.r > H) {
      lives--;
      updateHUD();
      if (lives <= 0) {
        state = 'game-over';
        showOverlay('GAME OVER', `Final Score: ${score}`, 'Click or SPACE to play again');
      } else {
        state = 'ball-lost';
        showOverlay('LIFE LOST', `${lives} ${lives === 1 ? 'life' : 'lives'} remaining`, 'Click or SPACE to continue');
      }
      return;
    }

    // Paddle collision — reflect with angle based on hit position
    if (
      ball.vy > 0 &&
      ball.y + ball.r >= paddle.y &&
      ball.y <= paddle.y + paddle.h + ball.r &&
      ball.x + ball.r >= paddle.x &&
      ball.x - ball.r <= paddle.x + paddle.w
    ) {
      const rel = (ball.x - paddle.x) / paddle.w; // 0–1
      const angle = (rel - 0.5) * (Math.PI * 2 / 3); // ±60° max
      const spd = Math.hypot(ball.vx, ball.vy);
      ball.vx = spd * Math.sin(angle);
      ball.vy = -Math.abs(spd * Math.cos(angle));
      ball.y = paddle.y - ball.r;
    }

    // Brick collisions
    let alive = 0;
    for (const b of bricks) {
      if (!b.alive) continue;
      alive++;

      // Circle–AABB intersection
      const cx = Math.max(b.x, Math.min(ball.x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(ball.y, b.y + b.h));
      if ((ball.x - cx) ** 2 + (ball.y - cy) ** 2 < ball.r ** 2) {
        b.alive = false;
        alive--;

        score += b.color.pts;
        if (score > highScore) {
          highScore = score;
          Utils.store.setRaw('breakout-high', String(highScore));
        }
        updateHUD();
        burst(b.x + b.w / 2, b.y + b.h / 2, b.color.fill);

        // Determine bounce axis using minimum overlap
        const overlapL = (ball.x + ball.r) - b.x;
        const overlapR = (b.x + b.w) - (ball.x - ball.r);
        const overlapT = (ball.y + ball.r) - b.y;
        const overlapB = (b.y + b.h) - (ball.y - ball.r);
        if (Math.min(overlapL, overlapR) < Math.min(overlapT, overlapB)) {
          ball.vx = overlapL < overlapR ? -Math.abs(ball.vx) : Math.abs(ball.vx);
        } else {
          ball.vy = overlapT < overlapB ? -Math.abs(ball.vy) : Math.abs(ball.vy);
        }
        break; // one brick per frame to avoid tunnelling
      }
    }

    if (alive === 0) {
      state = 'level-clear';
      showOverlay('LEVEL CLEAR!', `Score: ${score} · Level ${level} complete`, 'Click or SPACE for next level');
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.1;
      p.alpha -= 0.022;
      if (p.alpha <= 0) particles.splice(i, 1);
    }
  }

  // Manual rounded-rect path (avoids ctx.roundRect browser compat issues)
  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function draw() {
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, W, H);

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Bricks
    for (const b of bricks) {
      if (!b.alive) continue;
      ctx.shadowColor = b.color.fill;
      ctx.shadowBlur = 6;
      ctx.fillStyle = b.color.fill;
      rrect(b.x + 1, b.y + 1, b.w - 2, b.h - 2, 3);
      ctx.fill();
      // Shine highlight
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      rrect(b.x + 3, b.y + 2, b.w - 6, 4, 1);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Paddle
    ctx.shadowColor = '#6C63FF';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#6C63FF';
    rrect(paddle.x, paddle.y, paddle.w, paddle.h, 5);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    rrect(paddle.x + 5, paddle.y + 2, paddle.w - 10, 3, 1);
    ctx.fill();

    // Ball
    ctx.shadowColor = 'rgba(230,237,243,0.9)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#E6EDF3';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Launch hint (only in launch state, no overlay shown)
    if (state === 'launch') {
      ctx.fillStyle = 'rgba(230,237,243,0.4)';
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Move mouse or arrow keys  ·  SPACE or click to launch', W / 2, H - 10);
      ctx.textAlign = 'left';
    }
  }

  function loop() {
    update();
    draw();
    animId = requestAnimationFrame(loop);
  }

  function destroy() {
    cancelAnimationFrame(animId);
    if (onKeyRef) document.removeEventListener('keydown', onKeyRef);
  }

  return { init, destroy, start: fullRestart };
})();
