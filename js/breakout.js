/* ============================================
   NEON BREAKER — a brick-breaker with juice.
   Paddle (mouse/touch), ball with trail, multi-hit
   neon bricks, particles, combos, lives, levels,
   and power-ups (multiball / wide paddle / slow).
   Follows the arcade module pattern.
   ============================================ */

const BreakoutGame = (() => {
  const WIDTH = 720, HEIGHT = 520;
  const COLS = 11, ROWS = 6;
  const BRICK_W = 56, BRICK_H = 22, BRICK_GAP = 6;
  const GRID_TOP = 60, GRID_LEFT = (WIDTH - (COLS * (BRICK_W + BRICK_GAP) - BRICK_GAP)) / 2;
  const PADDLE_W = 108, PADDLE_H = 12, PADDLE_Y = HEIGHT - 34;
  const BALL_R = 7;
  // Hard cap on ball speed (px per 16.667ms frame) — without this, high
  // levels (speed = 4.4 + level*0.35) combined with the dt clamp (up to
  // 2.2) can move the ball farther per frame than the paddle/brick
  // thickness, tunneling straight through them.
  const BALL_SPEED_MAX = 11;
  const ROW_COLORS = ['#F778BA', '#F85149', '#F0883E', '#D29922', '#3FB950', '#58A6FF'];

  let canvas, ctx;
  let paddleX, paddleW;
  let balls, bricks, particles, powerups;
  let score, high, lives, level, combo;
  let running, launched, gameOver;
  let slowUntil, wideUntil;
  let pointerX = null;

  const loop = Utils.gameLoop(dt => {
    if (running && !gameOver) update(dt);
    draw();
  });

  function init() {
    canvas = document.getElementById('breakout-canvas');
    if (!canvas) return;
    // Size the backing store to CSS px * devicePixelRatio for crisp HiDPI
    // rendering; game logic keeps using WIDTH/HEIGHT (CSS/logical) coords.
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = WIDTH * dpr; canvas.height = HEIGHT * dpr;
    canvas.style.width = WIDTH + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    high = Utils.highScore.load('breakout-high');
    resetGame(false);

    canvas.addEventListener('mousemove', e => { pointerX = relX(e.clientX); });
    canvas.addEventListener('mousedown', () => launch());
    canvas.addEventListener('touchstart', e => { pointerX = relX(e.touches[0].clientX); launch(); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchmove', e => { pointerX = relX(e.touches[0].clientX); e.preventDefault(); }, { passive: false });
    document.addEventListener('keydown', Utils.whenViewActive('view-breakout', onKey));
    updateInfo();
    draw();
  }

  function relX(clientX) {
    const r = canvas.getBoundingClientRect();
    return (clientX - r.left) * (WIDTH / r.width);
  }

  function onKey(e) {
    if (e.key === ' ' || e.key === 'ArrowUp') { launch(); e.preventDefault(); }
    else if (e.key === 'ArrowLeft')  { pointerX = (paddleX + paddleW / 2) - 44; }
    else if (e.key === 'ArrowRight') { pointerX = (paddleX + paddleW / 2) + 44; }
  }

  function resetGame(startRun) {
    paddleW = PADDLE_W;
    paddleX = (WIDTH - paddleW) / 2;
    score = 0; lives = 3; level = 1; combo = 0;
    slowUntil = 0; wideUntil = 0;
    particles = []; powerups = [];
    buildLevel();
    resetBall();
    gameOver = false;
    running = !!startRun;
    launched = false;
    updateInfo();
  }

  function buildLevel() {
    bricks = [];
    const rows = Math.min(ROWS, 3 + level);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        // Sparser, tougher bricks as levels climb; some gaps for variety.
        if (level > 1 && Math.random() < 0.08) continue;
        const hp = r < 2 && level >= 2 ? 2 : (Math.random() < 0.12 + level * 0.03 ? 2 : 1);
        bricks.push({
          x: GRID_LEFT + c * (BRICK_W + BRICK_GAP),
          y: GRID_TOP + r * (BRICK_H + BRICK_GAP),
          hp, maxHp: hp,
          color: ROW_COLORS[r % ROW_COLORS.length],
        });
      }
    }
  }

  function resetBall() {
    launched = false;
    const speed = Math.min(BALL_SPEED_MAX, 4.4 + level * 0.35);
    balls = [{
      x: WIDTH / 2, y: PADDLE_Y - BALL_R - 1,
      vx: 0, vy: 0, speed, trail: [],
    }];
  }

  function start() {
    resetGame(true);
    const ov = document.getElementById('breakout-overlay');
    if (ov) ov.style.display = 'none';
    loop.start();
  }

  function launch() {
    if (gameOver) { start(); return; }
    if (!running) { start(); return; }
    if (launched) return;
    launched = true;
    const b = balls[0];
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;
    b.vx = Math.cos(angle) * b.speed;
    b.vy = Math.sin(angle) * b.speed;
    sfx('start');
  }

  function update(dt) {
    // Paddle follows pointer (smoothed). Scaled by dt so the easing
    // reaches the same real-time speed regardless of frame rate.
    const targetW = now() < wideUntil ? PADDLE_W * 1.6 : PADDLE_W;
    paddleW += (targetW - paddleW) * Math.min(1, 0.2 * dt);
    if (pointerX != null) {
      const want = pointerX - paddleW / 2;
      paddleX += (want - paddleX) * Math.min(1, 0.4 * dt);
    }
    paddleX = Math.max(0, Math.min(WIDTH - paddleW, paddleX));

    const slow = now() < slowUntil ? 0.62 : 1;

    if (!launched) {
      balls[0].x = paddleX + paddleW / 2;
      balls[0].y = PADDLE_Y - BALL_R - 1;
    }

    for (let bi = balls.length - 1; bi >= 0; bi--) {
      const b = balls[bi];
      if (!launched) break;
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 10) b.trail.shift();
      b.x += b.vx * dt * slow;
      b.y += b.vy * dt * slow;

      // Walls
      if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx); sfx('move'); }
      if (b.x > WIDTH - BALL_R) { b.x = WIDTH - BALL_R; b.vx = -Math.abs(b.vx); sfx('move'); }
      if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy); sfx('move'); }

      // Paddle
      if (b.vy > 0 && b.y + BALL_R >= PADDLE_Y && b.y - BALL_R <= PADDLE_Y + PADDLE_H &&
          b.x >= paddleX - BALL_R && b.x <= paddleX + paddleW + BALL_R) {
        const hit = (b.x - (paddleX + paddleW / 2)) / (paddleW / 2); // -1..1
        const ang = -Math.PI / 2 + hit * (Math.PI / 3);
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(ang) * sp;
        b.vy = Math.sin(ang) * sp;
        b.y = PADDLE_Y - BALL_R - 1;
        combo = 0;
        sfx('bounce');
      }

      // Bricks
      for (let i = bricks.length - 1; i >= 0; i--) {
        const br = bricks[i];
        if (b.x + BALL_R > br.x && b.x - BALL_R < br.x + BRICK_W &&
            b.y + BALL_R > br.y && b.y - BALL_R < br.y + BRICK_H) {
          // Reflect on the shallower penetration axis
          const overlapX = Math.min(b.x + BALL_R - br.x, br.x + BRICK_W - (b.x - BALL_R));
          const overlapY = Math.min(b.y + BALL_R - br.y, br.y + BRICK_H - (b.y - BALL_R));
          // Reflect AND push the ball out of the brick, so shallow-angle hits
          // don't stay overlapping and double-hit / tunnel next frame.
          if (overlapX < overlapY) {
            b.vx = -b.vx;
            b.x += (b.x < br.x + BRICK_W / 2) ? -overlapX : overlapX;
          } else {
            b.vy = -b.vy;
            b.y += (b.y < br.y + BRICK_H / 2) ? -overlapY : overlapY;
          }
          br.hp--;
          if (br.hp <= 0) {
            combo++;
            const gain = 10 * Math.min(combo, 8);
            score += gain;
            spawnShards(br);
            maybeDropPowerup(br);
            bricks.splice(i, 1);
            sfx('eat');
            Effects.shakeCanvas(canvas, 2 + Math.min(combo, 8) * 0.5, 120);
            if (combo > 1 && combo % 4 === 0) sfx('bonus');
          } else {
            sfx('move');
          }
          high = Utils.highScore.save('breakout-high', score, high);
          updateInfo();
          break;
        }
      }

      // Fell off the bottom
      if (b.y > HEIGHT + BALL_R) {
        balls.splice(bi, 1);
        if (balls.length === 0) loseLife();
      }
    }

    // Power-ups fall
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.y += 2.4 * dt;
      p.spin += 0.1 * dt;
      if (p.y > PADDLE_Y - 4 && p.y < PADDLE_Y + PADDLE_H + 10 &&
          p.x > paddleX - 10 && p.x < paddleX + paddleW + 10) {
        applyPowerup(p.kind);
        powerups.splice(i, 1);
        sfx('bonus');
      } else if (p.y > HEIGHT + 12) {
        powerups.splice(i, 1);
      }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const s = particles[i];
      s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 0.12 * dt; s.life -= dt;
      if (s.life <= 0) particles.splice(i, 1);
    }

    // Level clear
    if (bricks.length === 0 && !gameOver) {
      level++;
      sfx('clear');
      buildLevel();
      resetBall();
      updateInfo(); // reflect the new level immediately, not on next brick
    }
  }

  function loseLife() {
    lives--;
    combo = 0;
    sfx('die');
    Effects.shakeCanvas(canvas, 10, 350);
    if (lives <= 0) { endGame(); return; }
    resetBall();
    updateInfo();
  }

  function endGame() {
    running = false; gameOver = true;
    sfx('over');
    high = Utils.highScore.save('breakout-high', score, high);
    Utils.showGameOver('breakout-overlay', {
      lines: ['Score: ' + score + ' &nbsp;·&nbsp; Level: ' + level],
      hint: 'Click or tap to play again',
    });
    updateInfo();
  }

  function spawnShards(br) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 3;
      particles.push({
        x: br.x + BRICK_W / 2, y: br.y + BRICK_H / 2,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1,
        life: 18 + Math.random() * 14, color: br.color,
      });
    }
  }

  function maybeDropPowerup(br) {
    if (Math.random() < 0.12) {
      const kinds = ['multi', 'wide', 'slow'];
      powerups.push({
        x: br.x + BRICK_W / 2, y: br.y + BRICK_H / 2,
        kind: kinds[Math.floor(Math.random() * kinds.length)], spin: 0,
      });
    }
  }

  function applyPowerup(kind) {
    if (kind === 'wide') wideUntil = now() + 9000;
    else if (kind === 'slow') slowUntil = now() + 7000;
    else if (kind === 'multi') {
      const src = balls.find(b => true) || balls[0];
      if (src && launched) {
        for (let k = 0; k < 2; k++) {
          const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
          const sp = Math.hypot(src.vx, src.vy) || src.speed;
          balls.push({ x: src.x, y: src.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, speed: src.speed, trail: [] });
        }
      }
    }
  }

  const POWER_META = { multi: { c: '#58A6FF', t: '×3' }, wide: { c: '#3FB950', t: '↔' }, slow: { c: '#D29922', t: '⏱' } };

  function now() { return performance.now(); }
  const sfx = Utils.sfx;

  function updateInfo() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('breakout-score', score);
    set('breakout-high', high);
    set('breakout-level', level);
    set('breakout-lives', '♥'.repeat(Math.max(0, lives)) || '—');
  }

  function draw() {
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // subtle grid glow
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 1;
    for (let x = 0; x < WIDTH; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke(); }

    // bricks
    for (const br of bricks) {
      const alpha = br.hp < br.maxHp ? 0.55 : 1;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = br.color;
      ctx.shadowColor = br.color; ctx.shadowBlur = 12;
      roundRect(br.x, br.y, BRICK_W, BRICK_H, 4); ctx.fill();
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      if (br.maxHp > 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(br.x + 3, br.y + 3, 4, 4);
      }
    }

    // particles
    for (const s of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, s.life / 20));
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;

    // power-ups
    for (const p of powerups) {
      const m = POWER_META[p.kind];
      ctx.fillStyle = m.c; ctx.shadowColor = m.c; ctx.shadowBlur = 12;
      roundRect(p.x - 12, p.y - 9, 24, 18, 5); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0d1117'; ctx.font = 'bold 12px JetBrains Mono, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(m.t, p.x, p.y + 1);
    }
    ctx.textBaseline = 'alphabetic';

    // balls + trails
    for (const b of balls) {
      for (let i = 0; i < b.trail.length; i++) {
        ctx.globalAlpha = (i / b.trail.length) * 0.4;
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath(); ctx.arc(b.trail[i].x, b.trail[i].y, BALL_R * (i / b.trail.length), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#22d3ee'; ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    // paddle
    ctx.fillStyle = '#22d3ee'; ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 14;
    roundRect(paddleX, PADDLE_Y, paddleW, PADDLE_H, 6); ctx.fill();
    ctx.shadowBlur = 0;

    // combo flash
    if (combo > 1 && launched) {
      ctx.fillStyle = 'rgba(34,211,238,' + Math.min(0.9, combo / 10) + ')';
      ctx.font = 'bold 20px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('COMBO ×' + combo, WIDTH / 2, 40);
    }

    // idle / launch prompt
    if (running && !launched && !gameOver) {
      ctx.fillStyle = '#E6EDF3';
      ctx.font = '16px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Move to aim · Click, tap or Space to launch', WIDTH / 2, HEIGHT - 70);
    }
    if (!running && !gameOver) {
      ctx.fillStyle = 'rgba(13,17,23,0.72)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#E6EDF3';
      ctx.font = 'bold 22px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('NEON BREAKER', WIDTH / 2, HEIGHT / 2 - 14);
      ctx.font = '13px Inter, sans-serif';
      ctx.fillStyle = '#7D8590';
      ctx.fillText('Move the paddle · catch power-ups · clear the bricks', WIDTH / 2, HEIGHT / 2 + 14);
      ctx.fillText('Click or tap to start', WIDTH / 2, HEIGHT / 2 + 36);
    }
    ctx.textAlign = 'left';
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function destroy() {
    loop.stop();
    // Shell re-inits a view only once and won't redraw on return — paint the
    // idle start screen now so returning doesn't show a frozen frame.
    running = false; gameOver = false;
    const ov = document.getElementById('breakout-overlay'); if (ov) ov.style.display = 'none';
    draw();
  }

  return { init, start, destroy };
})();
