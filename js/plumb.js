/* Plumb — one bob, one notch.
   Tap, click, or press Space to pinch it.
   Catch the bob in the gold. Pinch early, or let it swing past, and the plumb misses.
   The best run stays in this browser. */

const PlumbGame = (() => {
  const W = 480;
  const H = 280;
  const PIVOT_X = 240;
  const PIVOT_Y = 36;
  const RADIUS = 168;
  const NOTCH = 240;
  const LEFT = 78;

  let canvas, ctx, loop;
  let x, speed, half, plumbs, best, paused, over, flash, verdict;

  function init() {
    canvas = document.getElementById('plumb-canvas');
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = '100%';
    canvas.style.maxWidth = W + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    best = Utils.highScore.load('plumb-best');
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      pinch();
    });
    document.addEventListener('keydown', Utils.whenViewActive('view-plumb', onKey));
    loop = Utils.gameLoop(tick);
    start();
  }

  function start() {
    plumbs = 0;
    paused = false;
    over = false;
    flash = 0;
    verdict = '';
    x = LEFT;
    speed = 100;
    half = 42;
    syncPause();
    const ov = document.getElementById('plumb-overlay');
    if (ov) {
      ov.style.display = 'none';
      ov.onclick = null;
    }
    updateInfo();
    if (loop) loop.start();
    Utils.sfx('start');
    draw();
  }

  function resume() {
    if (loop) loop.start();
    draw();
  }

  function togglePause() {
    if (over) return;
    paused = !paused;
    syncPause();
    updateInfo();
    draw();
  }

  function restart() { start(); }

  function syncPause() {
    const btn = document.getElementById('plumb-pause');
    if (btn) btn.textContent = paused ? 'Resume' : 'Pause';
  }

  function onKey(e) {
    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); togglePause(); return; }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); restart(); return; }
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); pinch(); }
  }

  function pinch() {
    if (over) { start(); return; }
    if (paused) return;
    if (Math.abs(x - NOTCH) <= half) {
      plumbs += 1;
      best = Utils.highScore.save('plumb-best', plumbs, best);
      flash = 16;
      x = LEFT;
      speed = 100 + plumbs * 18;
      half = Math.max(16, 42 - plumbs * 4);
      Utils.sfx('clear');
    } else {
      end(x < NOTCH ? 'EARLY' : 'LATE');
    }
    updateInfo();
    draw();
  }

  function end(word) {
    over = true;
    verdict = word;
    syncPause();
    Utils.sfx('over');
    const ov = document.getElementById('plumb-overlay');
    if (ov) {
      ov.style.display = 'flex';
      ov.innerHTML = '<h2>' + word + '</h2><p>' + plumbs + ' plumb' + (plumbs === 1 ? '' : 's') + '</p><p>Tap or Space tries again</p>';
      ov.onclick = () => start();
    }
    updateInfo();
    draw();
  }

  function tick(dt) {
    if (!paused && !over) {
      x += speed * dt / 60;
      if (x > NOTCH + half + 28) end('LATE');
      if (flash > 0) flash -= dt;
    }
    draw();
  }

  function updateInfo() {
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    set('plumb-score', String(plumbs));
    set('plumb-best', best > 0 ? String(best) : '0');
    set('plumb-state', over ? verdict : paused ? 'Paused' : 'Live');
  }

  function bob() {
    const dx = x - PIVOT_X;
    const hang = Math.sqrt(Math.max(0, RADIUS * RADIUS - dx * dx));
    return { x, y: PIVOT_Y + hang };
  }

  function draw() {
    if (!ctx) return;
    const p = bob();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#12161c';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = flash > 0 ? '#ffe08a' : '#e3b341';
    ctx.fillRect(NOTCH - half, 188, half * 2, 28);
    ctx.strokeStyle = '#8d9aab';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(PIVOT_X, PIVOT_Y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.fillStyle = '#f4efe4';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
    ctx.fill();
    if (flash > 0) {
      ctx.fillStyle = '#ffe08a';
      ctx.font = '700 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PINCH', PIVOT_X, 78);
    }
    if (paused || over) {
      ctx.fillStyle = 'rgba(10, 12, 16, 0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f6efe4';
      ctx.font = '700 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(over ? verdict : 'PAUSED', W / 2, H / 2);
    }
  }

  function destroy() {
    if (loop) loop.stop();
    paused = false;
    over = false;
    const ov = document.getElementById('plumb-overlay');
    if (ov) {
      ov.style.display = 'none';
      ov.onclick = null;
    }
    draw();
  }

  return { init, start, resume, destroy, togglePause, restart };
})();
