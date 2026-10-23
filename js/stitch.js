/* Stitch — one thread, one seam.
   Tap, click, or press Space to sew it.
   Catch the thread in the gold. Sew early, or let it run past, and the stitch misses.
   The best run stays in this browser. */

const StitchGame = (() => {
  const W = 480;
  const H = 280;
  const LEFT = 28;
  const SEAM = 240;
  const ROW = 140;

  let canvas, ctx, loop;
  let x, speed, half, stitches, best, paused, over, flash, verdict;

  function init() {
    canvas = document.getElementById('stitch-canvas');
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = '100%';
    canvas.style.maxWidth = W + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    best = Utils.highScore.load('stitch-best');
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sew();
    });
    document.addEventListener('keydown', Utils.whenViewActive('view-stitch', onKey));
    loop = Utils.gameLoop(tick);
    start();
  }

  function start() {
    stitches = 0;
    paused = false;
    over = false;
    flash = 0;
    verdict = '';
    x = LEFT;
    speed = 78;
    half = 42;
    syncPause();
    const ov = document.getElementById('stitch-overlay');
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
    const btn = document.getElementById('stitch-pause');
    if (btn) btn.textContent = paused ? 'Resume' : 'Pause';
  }

  function onKey(e) {
    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); togglePause(); return; }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); restart(); return; }
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); sew(); }
  }

  function sew() {
    if (over) { start(); return; }
    if (paused) return;
    if (Math.abs(x - SEAM) <= half) {
      stitches += 1;
      best = Utils.highScore.save('stitch-best', stitches, best);
      flash = 16;
      x = LEFT;
      speed = 96 + stitches * 18;
      half = Math.max(16, 42 - stitches * 4);
      Utils.sfx('clear');
    } else {
      end(x < SEAM ? 'EARLY' : 'LATE');
    }
    updateInfo();
    draw();
  }

  function end(word) {
    over = true;
    verdict = word;
    syncPause();
    Utils.sfx('over');
    const ov = document.getElementById('stitch-overlay');
    if (ov) {
      ov.style.display = 'flex';
      ov.innerHTML = '<h2>' + word + '</h2><p>' + stitches + ' stitch' + (stitches === 1 ? '' : 'es') + '</p><p>Tap or Space tries again</p>';
      ov.onclick = () => start();
    }
    updateInfo();
    draw();
  }

  function tick(dt) {
    if (!paused && !over) {
      x += speed * dt / 60;
      if (x > SEAM + half + 24) end('LATE');
      if (flash > 0) flash -= dt;
    }
    draw();
  }

  function updateInfo() {
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    set('stitch-score', String(stitches));
    set('stitch-best', best > 0 ? String(best) : '0');
    set('stitch-state', over ? verdict : paused ? 'Paused' : 'Live');
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#1a1418';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#3a2a32';
    ctx.fillRect(0, 36, SEAM - half - 8, 208);
    ctx.fillRect(SEAM + half + 8, 36, W - (SEAM + half + 8), 208);
    ctx.fillStyle = flash > 0 ? '#ffe08a' : '#e3b341';
    ctx.fillRect(SEAM - half, 48, half * 2, 184);
    ctx.strokeStyle = '#8a4058';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(LEFT, ROW);
    ctx.lineTo(Math.max(LEFT, x - 16), ROW);
    ctx.stroke();
    ctx.fillStyle = '#ff7a9a';
    ctx.fillRect(x - 11, ROW - 14, 22, 28);
    ctx.fillStyle = '#f4efe6';
    ctx.fillRect(x - 3, ROW - 6, 6, 12);
    if (flash > 0) {
      ctx.fillStyle = '#ffe08a';
      ctx.font = '700 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SEW', W / 2, 28);
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
    const ov = document.getElementById('stitch-overlay');
    if (ov) {
      ov.style.display = 'none';
      ov.onclick = null;
    }
    draw();
  }

  return { init, start, resume, destroy, togglePause, restart };
})();
