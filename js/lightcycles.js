/* ============================================
   LIGHT CYCLES — Tron-style trail duel
   Solo vs an AI rider, or local 2-player on one
   keyboard. Every cell you cross becomes wall;
   last rider alive takes the round.
   ============================================ */

const LightCyclesGame = (() => {
  const GRID = 15;
  const COLS = 40;
  const ROWS = 27;
  const WIDTH = COLS * GRID;   // 600
  const HEIGHT = ROWS * GRID;  // 405

  const P1_COLOR = '#22d3ee';
  const P2_COLOR = '#F778BA';
  const DIRS = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]; // U R D L

  let canvas, ctx;
  let board;                 // COLS*ROWS ints: 0 empty, 1 p1 trail, 2 p2 trail
  let riders;                // [{x,y,dir,nextDir,alive,color}, ...] index 0 = P1, 1 = P2/AI
  let twoPlayer = false;
  let running, gameOver, roundMsg;
  let gameLoop, speed;
  let survivedTicks;
  let wins, losses;          // this-session round tally (both modes)
  let streak, bestStreak;    // consecutive vs-AI round wins, persisted
  let particles = [];
  const sfx = Utils.sfx;

  function idx(x, y) { return y * COLS + x; }
  function inBounds(x, y) { return x >= 0 && x < COLS && y >= 0 && y < ROWS; }

  function init() {
    canvas = document.getElementById('cycles-canvas');
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    canvas.style.width = WIDTH + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    bestStreak = Utils.highScore.load('cycles-streak');
    streak = 0; wins = 0; losses = 0;
    running = false; gameOver = false; roundMsg = null;
    updateInfo();
    draw();

    document.addEventListener('keydown', Utils.whenViewActive('view-lightcycles', handleKey));

    const overlayEl = document.getElementById('cycles-overlay');
    if (overlayEl) overlayEl.addEventListener('click', () => { if (gameOver) start(); });

    // Mobile swipe steers P1 (solo mode is the touch experience; 2P shares
    // one keyboard by design and the mode button says so).
    let touchStartX, touchStartY;
    canvas.addEventListener('touchstart', e => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    });
    canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    canvas.addEventListener('touchend', e => {
      if (!running) { start(); return; }
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > Math.abs(dy)) steer(0, dx > 30 ? 1 : dx < -30 ? 3 : -1);
      else steer(0, dy > 30 ? 2 : dy < -30 ? 0 : -1);
    });
  }

  function toggleMode() {
    twoPlayer = !twoPlayer;
    const btn = document.getElementById('cycles-mode-btn');
    if (btn) {
      btn.textContent = twoPlayer ? 'Mode: 2 PLAYERS' : 'Mode: VS AI';
      btn.style.borderColor = twoPlayer ? '#F778BA' : '';
      btn.style.color = twoPlayer ? '#F778BA' : '';
    }
    // A mode switch ends any round in progress — the streak only means
    // something if every round in it was played against the AI.
    clearInterval(gameLoop);
    running = false; gameOver = false; roundMsg = null;
    wins = 0; losses = 0; streak = 0;
    updateInfo();
    draw();
  }

  function start() {
    board = new Int8Array(COLS * ROWS);
    riders = [
      { x: 6, y: Math.floor(ROWS / 2), dir: 1, nextDir: 1, alive: true, color: P1_COLOR },
      { x: COLS - 7, y: Math.floor(ROWS / 2), dir: 3, nextDir: 3, alive: true, color: P2_COLOR },
    ];
    board[idx(riders[0].x, riders[0].y)] = 1;
    board[idx(riders[1].x, riders[1].y)] = 2;
    particles = [];
    survivedTicks = 0;
    speed = 95;
    running = true; gameOver = false; roundMsg = null;
    sfx('start');
    const overlay = document.getElementById('cycles-overlay');
    if (overlay) overlay.style.display = 'none';
    updateInfo();
    clearInterval(gameLoop);
    gameLoop = setInterval(tick, speed);
  }

  // Steering: absolute directions, 180° turns ignored (that's instant
  // death into your own trail and always a misclick).
  function steer(who, dir) {
    if (dir < 0 || !riders || !riders[who] || !riders[who].alive) return;
    if ((dir + 2) % 4 === riders[who].dir) return;
    riders[who].nextDir = dir;
  }

  function handleKey(e) {
    const startKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 'W', 'a', 'A', 's', 'S', 'd', 'D'];
    if (!running && startKeys.includes(e.key)) { e.preventDefault(); start(); return; }
    if (!running) return;

    // In solo mode both control schemes steer the one human. In 2P, WASD
    // is Player 1 (cyan, left start) and arrows are Player 2 (pink, right).
    const arrowsWho = twoPlayer ? 1 : 0;
    switch (e.key) {
      case 'ArrowUp':    steer(arrowsWho, 0); break;
      case 'ArrowRight': steer(arrowsWho, 1); break;
      case 'ArrowDown':  steer(arrowsWho, 2); break;
      case 'ArrowLeft':  steer(arrowsWho, 3); break;
      case 'w': case 'W': steer(0, 0); break;
      case 'd': case 'D': steer(0, 1); break;
      case 's': case 'S': steer(0, 2); break;
      case 'a': case 'A': steer(0, 3); break;
      default: return;
    }
    e.preventDefault();
  }

  // ---- AI ----
  // Ray length in each candidate direction, then a bounded flood-fill to
  // tell an open corridor from a dead-end pocket when rays are close.
  function rayLen(x, y, dir) {
    let d = 0;
    let cx = x + DIRS[dir].x, cy = y + DIRS[dir].y;
    while (inBounds(cx, cy) && board[idx(cx, cy)] === 0 && d < 24) {
      d++; cx += DIRS[dir].x; cy += DIRS[dir].y;
    }
    return d;
  }

  function pocketSize(x, y, dir, cap) {
    const sx = x + DIRS[dir].x, sy = y + DIRS[dir].y;
    if (!inBounds(sx, sy) || board[idx(sx, sy)] !== 0) return 0;
    const seen = new Set([idx(sx, sy)]);
    const queue = [[sx, sy]];
    let count = 0;
    while (queue.length && count < cap) {
      const [cx, cy] = queue.shift();
      count++;
      for (const d of DIRS) {
        const nx = cx + d.x, ny = cy + d.y;
        const i = idx(nx, ny);
        if (inBounds(nx, ny) && board[i] === 0 && !seen.has(i)) { seen.add(i); queue.push([nx, ny]); }
      }
    }
    return count;
  }

  function aiSteer() {
    const ai = riders[1];
    const options = [ai.dir, (ai.dir + 3) % 4, (ai.dir + 1) % 4]; // straight, left, right
    const rays = options.map(d => rayLen(ai.x, ai.y, d));

    // Comfortable road ahead: usually keep going (with a rare feint so the
    // rider doesn't draw sterile straight lines all round).
    if (rays[0] > 4 && Math.random() > 0.06) { ai.nextDir = ai.dir; return; }

    // Cornered or feinting: prefer the turn with the most reachable space,
    // not just the longest ray — a long ray into a sealed pocket is a trap.
    let best = -1, bestScore = -1;
    for (let i = 0; i < 3; i++) {
      if (rays[i] === 0) continue;
      const score = pocketSize(ai.x, ai.y, options[i], 90) + rays[i] * 0.25;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    if (best >= 0) ai.nextDir = options[best];
    // No option survives: ride straight into the wall with dignity.
  }

  function tick() {
    if (!twoPlayer) aiSteer();
    survivedTicks++;

    // Move both riders simultaneously: claim first, then judge, so
    // head-to-head collisions kill both instead of whoever moved second.
    const targets = riders.map(r => {
      r.dir = r.nextDir;
      return { x: r.x + DIRS[r.dir].x, y: r.y + DIRS[r.dir].y };
    });

    const crashed = [false, false];
    for (let i = 0; i < 2; i++) {
      const t = targets[i];
      if (!inBounds(t.x, t.y) || board[idx(t.x, t.y)] !== 0) crashed[i] = true;
    }
    if (targets[0].x === targets[1].x && targets[0].y === targets[1].y) {
      crashed[0] = crashed[1] = true;   // head-on into the same cell
    }

    for (let i = 0; i < 2; i++) {
      if (crashed[i]) {
        riders[i].alive = false;
        spawnBurst(riders[i].x, riders[i].y, riders[i].color);
      } else {
        riders[i].x = targets[i].x;
        riders[i].y = targets[i].y;
        board[idx(targets[i].x, targets[i].y)] = i + 1;
      }
    }

    // Ramp the pace every ~4 seconds so long duels tighten.
    if (survivedTicks % 40 === 0 && speed > 55) {
      speed -= 5;
      clearInterval(gameLoop);
      gameLoop = setInterval(tick, speed);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.life -= 1;
      if (p.life <= 0) particles.splice(i, 1);
    }

    if (crashed[0] || crashed[1]) return endRound(crashed);
    draw();
  }

  function endRound(crashed) {
    running = false;
    gameOver = true;
    clearInterval(gameLoop);
    Effects.shakeCanvas(canvas, 8, 300);

    const p1Name = twoPlayer ? 'PLAYER 1' : 'You';
    const p2Name = twoPlayer ? 'PLAYER 2' : 'The AI';
    let title;
    if (crashed[0] && crashed[1]) {
      title = 'DOUBLE CRASH — draw';
      sfx('die');
    } else if (crashed[1]) {
      wins++;
      title = `${p2Name} crashed — ${twoPlayer ? 'Player 1 takes the round!' : 'you take the round!'}`;
      sfx('bonus');
      if (!twoPlayer) {
        streak++;
        bestStreak = Utils.highScore.save('cycles-streak', streak, bestStreak);
      }
    } else {
      losses++;
      title = `${p1Name} crashed — ${twoPlayer ? 'Player 2 takes the round!' : 'the AI takes the round.'}`;
      sfx('die');
      if (!twoPlayer) streak = 0;
    }
    roundMsg = title;
    updateInfo();
    draw();

    const lines = twoPlayer
      ? [`P1 ${wins} &nbsp;·&nbsp; P2 ${losses}`]
      : [`Streak: ${streak} &nbsp;·&nbsp; Best: ${bestStreak}`];
    Utils.showGameOver('cycles-overlay', {
      lines: [title, ...lines],
      hint: 'Press SPACE or tap for the next round',
    });
  }

  function spawnBurst(cx, cy, color) {
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 5;
      particles.push({
        x: cx * GRID + GRID / 2, y: cy * GRID + GRID / 2,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 5 + Math.random() * 5, color,
      });
    }
  }

  function updateInfo() {
    const winsEl = document.getElementById('cycles-wins');
    const lossEl = document.getElementById('cycles-losses');
    const streakEl = document.getElementById('cycles-streak');
    const bestEl = document.getElementById('cycles-best');
    if (winsEl) winsEl.textContent = wins;
    if (lossEl) lossEl.textContent = losses;
    if (streakEl) streakEl.textContent = twoPlayer ? '—' : streak;
    if (bestEl) bestEl.textContent = bestStreak;
  }

  function draw() {
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * GRID, 0); ctx.lineTo(x * GRID, HEIGHT); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * GRID); ctx.lineTo(WIDTH, y * GRID); ctx.stroke();
    }

    // Trails
    if (board) {
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const v = board[idx(x, y)];
          if (!v) continue;
          ctx.fillStyle = v === 1 ? 'rgba(34,211,238,0.55)' : 'rgba(247,120,186,0.55)';
          ctx.fillRect(x * GRID + 1, y * GRID + 1, GRID - 2, GRID - 2);
        }
      }
    }

    // Rider heads, glowing
    if (riders) {
      for (const r of riders) {
        if (!r.alive) continue;
        ctx.fillStyle = r.color;
        ctx.shadowColor = r.color;
        ctx.shadowBlur = 12;
        ctx.fillRect(r.x * GRID, r.y * GRID, GRID, GRID);
        ctx.shadowBlur = 0;
      }
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 6));
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    if (!running && !gameOver) {
      ctx.fillStyle = 'rgba(13, 17, 23, 0.7)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#E6EDF3';
      ctx.font = '20px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Press any key or tap to ride', WIDTH / 2, HEIGHT / 2);
      ctx.font = '12px Inter, sans-serif';
      ctx.fillStyle = '#7D8590';
      ctx.fillText(twoPlayer
        ? 'P1: WASD (cyan) · P2: Arrow keys (pink) — one keyboard'
        : 'Arrows / WASD / swipe · trap the AI in your trail', WIDTH / 2, HEIGHT / 2 + 24);
      ctx.textAlign = 'left';
    }
  }

  function destroy() {
    clearInterval(gameLoop);
    // Shell re-inits a view only once and won't redraw on return — paint the
    // idle start screen now so returning doesn't show a frozen frame.
    running = false; gameOver = false; roundMsg = null;
    const ov = document.getElementById('cycles-overlay'); if (ov) ov.style.display = 'none';
    draw();
  }

  return { init, start, destroy, toggleMode };
})();
