/* Gutterlight — nine holes of table golf.
   Drag from the ball, or aim with the arrows and putt with Space.
   The best completed round stays in this browser. */

const GutterlightGame = (() => {
  const W = 640;
  const H = 360;
  const HOLES = [
    { tee: [78, 180], cup: [560, 180], walls: [], water: [] },
    { tee: [70, 70], cup: [560, 290], walls: [[250, 40, 28, 200]], water: [] },
    { tee: [80, 280], cup: [540, 80], walls: [[180, 0, 220, 28], [300, 160, 28, 200]], water: [] },
    { tee: [80, 180], cup: [500, 180], walls: [], water: [[250, 120, 140, 120]] },
    { tee: [70, 180], cup: [570, 180], walls: [[160, 40, 28, 110], [160, 210, 28, 110], [360, 40, 28, 110], [360, 210, 28, 110]], water: [] },
    { tee: [90, 90], cup: [520, 270], walls: [[200, 80, 240, 22]], water: [], sand: [[140, 200, 160, 70]] },
    { tee: [80, 180], cup: [470, 180], walls: [], water: [[390, 110, 160, 140]], sand: [] },
    { tee: [70, 60], cup: [500, 300], walls: [[120, 140, 400, 22], [120, 220, 22, 140]], water: [] },
    { tee: [90, 180], cup: [520, 180], walls: [[230, 70, 26, 90], [380, 200, 26, 90]], water: [[300, 150, 50, 60]], sand: [[160, 250, 90, 40]] },
  ];

  let canvas, ctx, loop;
  let hole, ball, angle, power, strokes, total, best, moving, paused, over, pulse;
  let drag = null;

  function init() {
    canvas = document.getElementById('gutter-canvas');
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = '100%';
    canvas.style.maxWidth = W + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    best = Utils.highScore.load('gutter-best');
    resetRound(false);
    updateInfo();
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.addEventListener('keydown', Utils.whenViewActive('view-gutterlight', onKey));
    loop = Utils.gameLoop(tick);
    loop.start();
    draw();
  }

  function course() { return HOLES[hole]; }

  function resetRound(run) {
    hole = 0;
    total = 0;
    paused = false;
    over = false;
    pulse = 0;
    layBall();
    syncPause();
    const ov = document.getElementById('gutter-overlay');
    if (ov) ov.style.display = 'none';
    if (run) Utils.sfx('start');
  }

  function layBall() {
    const tee = course().tee;
    ball = { x: tee[0], y: tee[1], vx: 0, vy: 0 };
    angle = Math.atan2(course().cup[1] - tee[1], course().cup[0] - tee[0]);
    power = 0.55;
    strokes = 0;
    moving = false;
  }

  function start() {
    resetRound(true);
    updateInfo();
    if (loop) loop.start();
    draw();
  }

  function resume() {
    if (loop) loop.start();
    draw();
  }

  function restart() {
    if (over) { start(); return; }
    total = Math.max(0, total - strokes);
    layBall();
    paused = false;
    syncPause();
    updateInfo();
    Utils.sfx('start');
    draw();
  }

  function togglePause() {
    if (over) return;
    paused = !paused;
    syncPause();
    draw();
  }

  function syncPause() {
    const btn = document.getElementById('gutter-pause');
    if (btn) btn.textContent = paused ? 'Resume' : 'Pause';
  }

  function onKey(e) {
    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); togglePause(); return; }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); restart(); return; }
    if (paused || over || moving) return;
    if (e.key === 'ArrowLeft') { angle -= 0.08; e.preventDefault(); }
    else if (e.key === 'ArrowRight') { angle += 0.08; e.preventDefault(); }
    else if (e.key === 'ArrowUp') { power = Math.min(1, power + 0.06); e.preventDefault(); }
    else if (e.key === 'ArrowDown') { power = Math.max(0.15, power - 0.06); e.preventDefault(); }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); putt(angle, power); }
    draw();
  }

  function localPoint(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width * W,
      y: (e.clientY - r.top) / r.height * H,
    };
  }

  function onDown(e) {
    if (paused || over || moving) return;
    drag = localPoint(e);
    canvas.setPointerCapture?.(e.pointerId);
  }

  function onMove(e) {
    if (!drag || paused || moving) return;
    const p = localPoint(e);
    const dx = p.x - ball.x;
    const dy = p.y - ball.y;
    const len = Math.hypot(dx, dy);
    if (len < 8) return;
    angle = Math.atan2(dy, dx);
    power = Math.max(0.15, Math.min(1, len / 160));
    draw();
  }

  function onUp() {
    if (!drag || paused || over || moving) { drag = null; return; }
    drag = null;
    putt(angle, power);
  }

  function putt(aim, force) {
    ball.vx = Math.cos(aim) * (2.4 + force * 7.2);
    ball.vy = Math.sin(aim) * (2.4 + force * 7.2);
    moving = true;
    strokes += 1;
    total += 1;
    Utils.sfx('lock');
    updateInfo();
  }

  function hitRect(rect) {
    const [x, y, w, h] = rect;
    const nx = Math.max(x, Math.min(ball.x, x + w));
    const ny = Math.max(y, Math.min(ball.y, y + h));
    const dx = ball.x - nx;
    const dy = ball.y - ny;
    if (dx * dx + dy * dy > 49) return false;
    if (Math.abs(dx) > Math.abs(dy)) {
      ball.x = dx >= 0 ? x + w + 8 : x - 8;
      ball.vx *= -0.72;
    } else {
      ball.y = dy >= 0 ? y + h + 8 : y - 8;
      ball.vy *= -0.72;
    }
    Utils.sfx('bounce');
    return true;
  }

  function inRect(rect) {
    const [x, y, w, h] = rect;
    return ball.x > x && ball.x < x + w && ball.y > y && ball.y < y + h;
  }

  function tick() {
    pulse += 0.08;
    if (!paused && moving && !over) {
      const layout = course();
      ball.x += ball.vx;
      ball.y += ball.vy;
      ball.vx *= 0.985;
      ball.vy *= 0.985;
      for (const sand of layout.sand || []) {
        if (inRect(sand)) { ball.vx *= 0.9; ball.vy *= 0.9; }
      }
      for (const wall of layout.walls) hitRect(wall);
      const wet = (layout.water || []).some(inRect);
      const off = ball.x < 12 || ball.y < 12 || ball.x > W - 12 || ball.y > H - 12;
      if (wet || off) {
        Utils.sfx('die');
        strokes += 1;
        total += 1;
        updateInfo();
        const tee = layout.tee;
        ball.x = tee[0];
        ball.y = tee[1];
        ball.vx = 0;
        ball.vy = 0;
        moving = false;
      }
      const cup = layout.cup;
      const dist = Math.hypot(ball.x - cup[0], ball.y - cup[1]);
      const speed = Math.hypot(ball.vx, ball.vy);
      if (dist < 16 && speed < 2.4) sink();
      else if (speed < 0.08) {
        ball.vx = 0;
        ball.vy = 0;
        moving = false;
        if (strokes >= 8) sink(true);
      }
    }
    draw();
  }

  function sink(mercy) {
    moving = false;
    ball.vx = 0;
    ball.vy = 0;
    ball.x = course().cup[0];
    ball.y = course().cup[1];
    Utils.sfx(mercy ? 'over' : 'clear');
    if (hole >= HOLES.length - 1) finish();
    else {
      hole += 1;
      layBall();
      updateInfo();
    }
  }

  function finish() {
    over = true;
    if (!best || total < best) best = total;
    try { localStorage.setItem('gutter-best', String(best)); } catch {}
    Utils.sfx('reveal');
    Utils.showGameOver('gutter-overlay', {
      lines: ['Round in ' + total + ' strokes', best ? 'Best round: ' + best : ''],
      hint: 'New round deals the nine again',
    });
    updateInfo();
  }

  function updateInfo() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('gutter-hole', over ? String(HOLES.length) : String(hole + 1));
    set('gutter-strokes', String(strokes));
    set('gutter-total', String(total));
    set('gutter-best', best ? String(best) : '—');
  }

  function draw() {
    if (!ctx) return;
    const layout = course();
    ctx.fillStyle = '#102018';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1c3d2c';
    roundRect(18, 18, W - 36, H - 36, 18);
    ctx.fill();
    for (const sand of layout.sand || []) {
      ctx.fillStyle = '#c4a15a';
      ctx.fillRect(sand[0], sand[1], sand[2], sand[3]);
    }
    for (const water of layout.water || []) {
      ctx.fillStyle = '#1a4c68';
      ctx.fillRect(water[0], water[1], water[2], water[3]);
    }
    for (const wall of layout.walls) {
      ctx.fillStyle = '#d7dde6';
      ctx.fillRect(wall[0], wall[1], wall[2], wall[3]);
    }
    ctx.fillStyle = '#07080d';
    ctx.beginPath();
    ctx.arc(layout.cup[0], layout.cup[1], 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e3b341';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (!moving && !over) {
      ctx.save();
      ctx.translate(ball.x, ball.y);
      ctx.rotate(angle);
      ctx.strokeStyle = 'rgba(227,179,65,' + (0.45 + Math.sin(pulse) * 0.25) + ')';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(28 + power * 120, 0);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    ctx.fillStyle = '#f4efe4';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e6edf3';
    ctx.font = '600 13px Outfit, Inter, sans-serif';
    ctx.fillText('Hole ' + (hole + 1) + ' / ' + HOLES.length, 28, 40);
    if (paused) {
      ctx.fillStyle = 'rgba(7,8,13,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#e6edf3';
      ctx.font = '600 28px Outfit, Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Paused', W / 2, H / 2);
      ctx.textAlign = 'left';
    }
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
    if (loop) loop.stop();
    paused = false;
    over = false;
    const ov = document.getElementById('gutter-overlay');
    if (ov) ov.style.display = 'none';
    resetRound(false);
    updateInfo();
    draw();
  }

  return { init, start, resume, destroy, togglePause, restart };
})();
