/* ============================================
   PONG++ — the old table, new tricks.
   First to 7. Power-ups drift onto the field:
   🟩 grows the last hitter's paddle for 8s,
   ⚡ turbo-charges the ball until the next hit,
   ✦ splits the ball (up to three live at once).
   VS a rubber-banding AI, or 2P on one keyboard
   (P1 W/S · P2 arrows).
   ============================================ */

const PongGame = (() => {
  const WIDTH = 760, HEIGHT = 480;
  const PAD_W = 12, PAD_H = 86, PAD_X = 26;
  const BALL_R = 7, WIN_SCORE = 7;
  const POWER_EVERY = 380;      // frames between power-up spawns (~6s)
  const GROW_FRAMES = 480;      // 8s of big paddle
  const MAX_BALLS = 3;

  let canvas, ctx, loop;
  let paddles, balls, powers, scores, particles;
  let running, matchOver, serveTimer, powerTimer, frameCount;
  let twoPlayer = false;
  let wins = 0, losses = 0, streak = 0, best = 0;
  const keys = {};
  const sfx = Utils.sfx;

  const POWER_TYPES = [
    { id: 'grow',  glyph: '▮', color: '#3FB950', label: 'PADDLE+' },
    { id: 'fast',  glyph: '⚡', color: '#F7C948', label: 'TURBO' },
    { id: 'multi', glyph: '✦', color: '#F778BA', label: 'SPLIT' },
  ];

  function init() {
    canvas = document.getElementById('pong-canvas');
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    canvas.style.width = '100%';
    canvas.style.maxWidth = WIDTH + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    best = Utils.highScore.load('pong-streak');
    resetMatch(false);
    updateInfo();

    document.addEventListener('keydown', Utils.whenViewActive('view-pong', e => {
      if ([' ', 'ArrowUp', 'ArrowDown', 'w', 's', 'W', 'S'].includes(e.key)) e.preventDefault();
      if (e.key === ' ' && (!running || matchOver)) { start(); return; }
      keys[e.key.toLowerCase()] = true;
      if (e.key === 'ArrowUp') keys.up = true;
      if (e.key === 'ArrowDown') keys.down = true;
    }));
    document.addEventListener('keyup', Utils.whenViewActive('view-pong', e => {
      keys[e.key.toLowerCase()] = false;
      if (e.key === 'ArrowUp') keys.up = false;
      if (e.key === 'ArrowDown') keys.down = false;
    }));
    // Touch/pointer: drag on your half moves that paddle (both in 2P).
    canvas.addEventListener('pointermove', e => {
      if (!running) return;
      const r = canvas.getBoundingClientRect();
      const y = (e.clientY - r.top) / r.height * HEIGHT;
      const x = (e.clientX - r.left) / r.width * WIDTH;
      if (x < WIDTH / 2) paddles[0].y = y - paddles[0].h / 2;
      else if (twoPlayer) paddles[1].y = y - paddles[1].h / 2;
    });
    canvas.addEventListener('click', () => { if (!running || matchOver) start(); });

    const ov = document.getElementById('pong-overlay');
    if (ov) ov.addEventListener('click', () => { if (!running || matchOver) start(); });

    loop = Utils.gameLoop(tick);
    draw();
  }

  function resetMatch(run) {
    paddles = [
      { y: HEIGHT / 2 - PAD_H / 2, h: PAD_H, grow: 0 },   // left: P1
      { y: HEIGHT / 2 - PAD_H / 2, h: PAD_H, grow: 0 },   // right: AI / P2
    ];
    balls = [];
    powers = [];
    particles = [];
    scores = [0, 0];
    matchOver = false;
    serveTimer = 40;
    powerTimer = POWER_EVERY;
    frameCount = 0;
    running = !!run;
  }

  function start() {
    resetMatch(true);
    sfx('start');
    const ov = document.getElementById('pong-overlay');
    if (ov) ov.style.display = 'none';
    updateInfo();
    loop.start();
  }

  function serve() {
    const dir = Math.random() < 0.5 ? -1 : 1;
    const ang = (Math.random() * 0.6 - 0.3) * Math.PI;
    const sp = 4.6;
    balls.push({
      x: WIDTH / 2, y: HEIGHT / 2,
      vx: Math.cos(ang) * sp * dir, vy: Math.sin(ang) * sp,
      turbo: false, lastHit: -1,
    });
  }

  function paddleRect(i) {
    const p = paddles[i];
    return { x: i === 0 ? PAD_X : WIDTH - PAD_X - PAD_W, y: p.y, w: PAD_W, h: p.h };
  }

  function tick(dt) {
    if (!running) return;
    frameCount += dt;

    // Serve pause between points
    if (serveTimer > 0) {
      serveTimer -= dt;
      if (serveTimer <= 0 && balls.length === 0 && !matchOver) serve();
    }

    movePaddles(dt);

    // Power-up spawns drift in mid-field
    powerTimer -= dt;
    if (powerTimer <= 0 && powers.length < 2 && !matchOver) {
      powerTimer = POWER_EVERY;
      const t = POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)];
      powers.push({
        type: t,
        x: WIDTH * 0.3 + Math.random() * WIDTH * 0.4,
        y: 40 + Math.random() * (HEIGHT - 80),
        wob: Math.random() * 9, r: 15,
      });
    }
    for (const pw of powers) pw.wob += 0.04 * dt;

    // Paddle grow timers
    for (const p of paddles) {
      if (p.grow > 0) {
        p.grow -= dt;
        if (p.grow <= 0) p.h = PAD_H;
      }
    }

    // Balls
    for (let bi = balls.length - 1; bi >= 0; bi--) {
      const b = balls[bi];
      const speed = b.turbo ? 1.45 : 1;
      b.x += b.vx * speed * dt;
      b.y += b.vy * speed * dt;

      if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy); blip(660); }
      if (b.y > HEIGHT - BALL_R) { b.y = HEIGHT - BALL_R; b.vy = -Math.abs(b.vy); blip(660); }

      // Paddle collisions
      for (let i = 0; i < 2; i++) {
        const r = paddleRect(i);
        const towards = i === 0 ? b.vx < 0 : b.vx > 0;
        if (!towards) continue;
        if (b.x + BALL_R > r.x && b.x - BALL_R < r.x + r.w &&
            b.y + BALL_R > r.y && b.y - BALL_R < r.y + r.h) {
          const rel = ((b.y - r.y) / r.h) * 2 - 1;    // -1 top … 1 bottom
          const sp = Math.min(11, Math.hypot(b.vx, b.vy) * 1.045 + 0.12);
          const ang = rel * 0.72;
          b.vx = Math.cos(ang) * sp * (i === 0 ? 1 : -1);
          b.vy = Math.sin(ang) * sp;
          b.x = i === 0 ? r.x + r.w + BALL_R : r.x - BALL_R;
          b.turbo = false;                              // turbo dies at the paddle
          b.lastHit = i;
          blip(440 + Math.abs(rel) * 220);
        }
      }

      // Power-up pickup — credited to whoever hit the ball last
      for (let pi = powers.length - 1; pi >= 0; pi--) {
        const pw = powers[pi];
        if (Math.hypot(b.x - pw.x, b.y - pw.y) < pw.r + BALL_R) {
          powers.splice(pi, 1);
          applyPower(pw.type, b);
          burst(pw.x, pw.y, pw.type.color);
        }
      }

      // Point scored — every ball that exits pays its own point (SPLIT can
      // have up to 3 in flight at once); only the *next serve* waits for the
      // field to clear.
      if (b.x < -BALL_R * 2 || b.x > WIDTH + BALL_R * 2) {
        const scorer = b.x < 0 ? 1 : 0;
        balls.splice(bi, 1);
        scores[scorer]++;
        sfx(scorer === 0 ? 'bonus' : 'die');
        updateInfo();
        if (!matchOver) {
          if (scores[scorer] >= WIN_SCORE) endMatch(scorer);
          else if (balls.length === 0) serveTimer = 55;
        }
      }
    }

    // Particles (cosmetic)
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    draw();
  }

  function movePaddles(dt) {
    const PSPEED = 6.4 * dt;
    // P1: W/S always; arrows too when solo (some folks just reach for arrows)
    let d1 = 0;
    if (keys.w) d1 -= 1;
    if (keys.s) d1 += 1;
    if (!twoPlayer) { if (keys.up) d1 -= 1; if (keys.down) d1 += 1; }
    paddles[0].y += d1 * PSPEED;

    if (twoPlayer) {
      let d2 = 0;
      if (keys.up) d2 -= 1;
      if (keys.down) d2 += 1;
      paddles[1].y += d2 * PSPEED;
    } else {
      aiMove(dt);
    }
    for (const p of paddles) p.y = Math.max(6, Math.min(HEIGHT - p.h - 6, p.y));
  }

  // AI: chase the nearest ball heading its way; top speed rubber-bands with
  // the score so a blowout self-corrects in both directions.
  function aiMove(dt) {
    const p = paddles[1];
    let target = HEIGHT / 2 - p.h / 2, bestEta = Infinity;
    for (const b of balls) {
      if (b.vx <= 0) continue;
      const eta = (WIDTH - PAD_X - b.x) / (b.vx * (b.turbo ? 1.45 : 1));
      if (eta < bestEta) { bestEta = eta; target = b.y - p.h / 2; }
    }
    const lead = scores[1] - scores[0];
    const top = (4.6 - Math.max(-1.2, Math.min(1.2, lead * 0.35))) * dt;
    const diff = target - p.y;
    p.y += Math.max(-top, Math.min(top, diff * 0.18));
  }

  function applyPower(type, ball) {
    if (type.id === 'grow' && ball.lastHit >= 0) {
      const p = paddles[ball.lastHit];
      p.h = Math.round(PAD_H * 1.45);
      p.grow = GROW_FRAMES;
      sfx('bonus');
    } else if (type.id === 'fast') {
      ball.turbo = true;
      sfx('bounce');
    } else if (type.id === 'multi' && balls.length < MAX_BALLS) {
      const n = Math.min(MAX_BALLS - balls.length, 1);
      for (let i = 0; i < n; i++) {
        const a = Math.atan2(ball.vy, ball.vx) + (i ? -0.5 : 0.5);
        const sp = Math.hypot(ball.vx, ball.vy);
        balls.push({
          x: ball.x, y: ball.y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          turbo: false, lastHit: ball.lastHit,
        });
      }
      sfx('start');
    }
  }

  function blip(freq) { if (typeof SFX !== 'undefined' && SFX.note) SFX.note(freq, 0.06); }

  function burst(x, y, color) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 14 + Math.random() * 12, color });
    }
  }

  function endMatch(winner) {
    matchOver = true;
    running = false;
    loop.stop();
    const p1Won = winner === 0;
    let headline;
    if (twoPlayer) {
      headline = p1Won ? '🏆 PLAYER 1 WINS' : '🏆 PLAYER 2 WINS';
    } else if (p1Won) {
      wins++; streak++;
      best = Utils.highScore.save('pong-streak', streak, best);
      headline = '🏆 YOU WIN';
      sfx('clear');
    } else {
      losses++; streak = 0;
      headline = 'AI TAKES IT';
      sfx('over');
    }
    updateInfo();
    draw();
    Utils.showGameOver('pong-overlay', {
      lines: [`<strong>${headline}</strong>`,
              `${scores[0]} — ${scores[1]}` +
              (twoPlayer ? '' : ` &nbsp;·&nbsp; Streak: ${streak} &nbsp;·&nbsp; Best: ${best}`)],
      hint: 'Press SPACE or tap to play again',
    });
  }

  function toggleMode() {
    twoPlayer = !twoPlayer;
    const btn = document.getElementById('pong-mode-btn');
    if (btn) btn.textContent = twoPlayer ? 'Mode: 2 PLAYERS' : 'Mode: VS AI';
    // Mode switches mid-match reset the table — mixing tallies would lie.
    loop.stop();
    resetMatch(false);
    updateInfo();
    const ov = document.getElementById('pong-overlay');
    if (ov) ov.style.display = 'none';
    draw();
  }

  function updateInfo() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('pong-p1', scores ? scores[0] : 0);
    set('pong-p2', scores ? scores[1] : 0);
    set('pong-streak', streak);
    set('pong-best', best);
  }

  function draw(){
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Center line
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.setLineDash([8, 10]);
    ctx.beginPath(); ctx.moveTo(WIDTH / 2, 0); ctx.lineTo(WIDTH / 2, HEIGHT); ctx.stroke();
    ctx.setLineDash([]);

    // Scores
    ctx.fillStyle = 'rgba(230,237,243,0.16)';
    ctx.font = '900 64px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(scores[0], WIDTH / 2 - 70, 74);
    ctx.fillText(scores[1], WIDTH / 2 + 70, 74);
    ctx.textAlign = 'left';

    // Power-ups
    for (const pw of powers) {
      const y = pw.y + Math.sin(pw.wob) * 5;
      ctx.fillStyle = pw.type.color;
      ctx.shadowColor = pw.type.color; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(pw.x, y, pw.r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0d1117';
      ctx.font = 'bold 15px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pw.type.glyph, pw.x, y + 5);
      ctx.textAlign = 'left';
    }

    // Paddles
    for (let i = 0; i < 2; i++) {
      const r = paddleRect(i);
      const growing = paddles[i].grow > 0;
      ctx.fillStyle = growing ? '#3FB950' : (i === 0 ? '#58A6FF' : '#F778BA');
      if (growing) { ctx.shadowColor = '#3FB950'; ctx.shadowBlur = 14; }
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.shadowBlur = 0;
    }

    // Balls
    for (const b of balls) {
      ctx.fillStyle = b.turbo ? '#F7C948' : '#E6EDF3';
      if (b.turbo) { ctx.shadowColor = '#F7C948'; ctx.shadowBlur = 18; }
      ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / 26);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    if (!running && !matchOver) {
      ctx.fillStyle = 'rgba(13,17,23,0.72)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#E6EDF3';
      ctx.font = '20px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Press SPACE or tap to serve', WIDTH / 2, HEIGHT / 2 - 12);
      ctx.font = '12px Inter, sans-serif';
      ctx.fillStyle = '#7D8590';
      ctx.fillText(twoPlayer ? 'P1: W/S · P2: ↑/↓ · first to 7' : 'W/S or ↑/↓ · first to 7 · catch the power-ups with the ball',
        WIDTH / 2, HEIGHT / 2 + 14);
      ctx.textAlign = 'left';
    }
  }

  function destroy() {
    if (loop) loop.stop();
    running = false; matchOver = false;
    for (const k of Object.keys(keys)) keys[k] = false;
    const ov = document.getElementById('pong-overlay'); if (ov) ov.style.display = 'none';
    resetMatch(false);
    draw();
  }

  return { init, start, destroy, toggleMode };
})();
