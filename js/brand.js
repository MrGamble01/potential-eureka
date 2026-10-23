/* Brand — one iron, one hide.
   Tap, click, or press Space to sear it.
   Catch the iron in the gold. Sear early, or let it fall past, and the brand misses.
   The best run stays in this browser. */

const BrandGame = (() => {
  const W = 480;
  const H = 280;
  const RAIL_X = 240;
  const TOP = 36;
  const BAND = 200;

  let canvas, ctx, loop;
  let y, speed, half, brands, best, paused, over, flash, verdict;

  function init() {
    canvas = document.getElementById('brand-canvas');
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = '100%';
    canvas.style.maxWidth = W + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    best = Utils.highScore.load('brand-best');
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sear();
    });
    document.addEventListener('keydown', Utils.whenViewActive('view-brand', onKey));
    loop = Utils.gameLoop(tick);
    start();
  }

  function start() {
    brands = 0;
    paused = false;
    over = false;
    flash = 0;
    verdict = '';
    y = TOP;
    speed = 100;
    half = 42;
    syncPause();
    const ov = document.getElementById('brand-overlay');
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
    const btn = document.getElementById('brand-pause');
    if (btn) btn.textContent = paused ? 'Resume' : 'Pause';
  }

  function onKey(e) {
    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); togglePause(); return; }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); restart(); return; }
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); sear(); }
  }

  function sear() {
    if (over) { start(); return; }
    if (paused) return;
    if (Math.abs(y - BAND) <= half) {
      brands += 1;
      best = Utils.highScore.save('brand-best', brands, best);
      flash = 16;
      y = TOP;
      speed = 100 + brands * 20;
      half = Math.max(16, 42 - brands * 4);
      Utils.sfx('clear');
    } else {
      end(y < BAND ? 'EARLY' : 'LATE');
    }
    updateInfo();
    draw();
  }

  function end(word) {
    over = true;
    verdict = word;
    syncPause();
    Utils.sfx('over');
    const ov = document.getElementById('brand-overlay');
    if (ov) {
      ov.style.display = 'flex';
      ov.innerHTML = '<h2>' + word + '</h2><p>' + brands + ' brand' + (brands === 1 ? '' : 's') + '</p><p>Tap or Space tries again</p>';
      ov.onclick = () => start();
    }
    updateInfo();
    draw();
  }

  function tick(dt) {
    if (!paused && !over) {
      y += speed * dt / 60;
      if (y > BAND + half + 24) end('LATE');
      if (flash > 0) flash -= dt;
    }
    draw();
  }

  function updateInfo() {
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    set('brand-score', String(brands));
    set('brand-best', best > 0 ? String(best) : '0');
    set('brand-state', over ? verdict : paused ? 'Paused' : 'Live');
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#1a1210';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#3a241c';
    ctx.fillRect(36, 150, 408, 110);
    ctx.fillStyle = flash > 0 ? '#ffe08a' : '#e3b341';
    ctx.fillRect(RAIL_X - 86, BAND - half, 172, half * 2);
    ctx.fillStyle = '#6e6258';
    ctx.fillRect(RAIL_X - 5, y - 46, 10, 34);
    ctx.fillStyle = '#ff5a36';
    ctx.fillRect(RAIL_X - 16, y - 8, 32, 14);
    if (flash > 0) {
      ctx.fillStyle = '#ffe08a';
      ctx.font = '700 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SEAR', RAIL_X, 72);
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
    const ov = document.getElementById('brand-overlay');
    if (ov) {
      ov.style.display = 'none';
      ov.onclick = null;
    }
    draw();
  }

  return { init, start, resume, destroy, togglePause, restart };
})();
