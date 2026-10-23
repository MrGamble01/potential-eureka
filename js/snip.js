/* Snip — one spark, one cut.
   Tap or press Space while the spark is in the gold window.
   Miss, or let it reach the end, and the fuse wins.
   The best run stays in this browser. */

const SnipGame = (() => {
  const W = 480;
  const H = 280;

  let canvas, ctx, loop;
  let spark, speed, bandL, bandR, snips, best, paused, over, flash;

  function init() {
    canvas = document.getElementById('snip-canvas');
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = '100%';
    canvas.style.maxWidth = W + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    best = Utils.highScore.load('snip-best');
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      snip();
    });
    document.addEventListener('keydown', Utils.whenViewActive('view-snip', onKey));
    loop = Utils.gameLoop(tick);
    start();
  }

  function placeBand() {
    const width = Math.max(40, 84 - snips * 8);
    bandL = 176;
    bandR = bandL + width;
  }

  function start() {
    snips = 0;
    paused = false;
    over = false;
    flash = 0;
    spark = 36;
    speed = 130;
    placeBand();
    syncPause();
    const ov = document.getElementById('snip-overlay');
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
    const btn = document.getElementById('snip-pause');
    if (btn) btn.textContent = paused ? 'Resume' : 'Pause';
  }

  function onKey(e) {
    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); togglePause(); return; }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); restart(); return; }
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); snip(); }
  }

  function snip() {
    if (over) { start(); return; }
    if (paused) return;
    if (spark >= bandL && spark <= bandR) {
      snips += 1;
      best = Utils.highScore.save('snip-best', snips, best);
      spark = 36;
      speed = 130 + snips * 22;
      placeBand();
      flash = 16;
      Utils.sfx('clear');
    } else {
      end();
    }
    updateInfo();
    draw();
  }

  function end() {
    over = true;
    syncPause();
    Utils.sfx('over');
    const ov = document.getElementById('snip-overlay');
    if (ov) {
      ov.style.display = 'flex';
      ov.innerHTML = '<h2>FUSE</h2><p>' + snips + ' snip' + (snips === 1 ? '' : 's') + '</p><p>Tap or Space tries again</p>';
      ov.onclick = () => start();
    }
    updateInfo();
    draw();
  }

  function tick(dt) {
    if (!paused && !over) {
      spark += speed * dt / 60;
      if (flash > 0) flash -= dt;
      if (spark >= W - 28) end();
    }
    draw();
  }

  function updateInfo() {
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    set('snip-score', String(snips));
    set('snip-best', best > 0 ? String(best) : '0');
    set('snip-state', over ? 'Fuse' : paused ? 'Paused' : 'Live');
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#14110e';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#5c3b22';
    ctx.fillRect(24, H / 2 - 4, W - 48, 8);
    ctx.fillStyle = flash > 0 ? '#ffe08a' : '#e3b341';
    ctx.fillRect(bandL, H / 2 - 28, bandR - bandL, 56);
    ctx.fillStyle = '#1a140c';
    ctx.font = '700 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CUT', (bandL + bandR) / 2, H / 2 + 5);
    ctx.beginPath();
    ctx.fillStyle = '#ffb020';
    ctx.arc(spark, H / 2, 12, 0, Math.PI * 2);
    ctx.fill();
    if (flash > 0) {
      ctx.fillStyle = '#ffe08a';
      ctx.font = '700 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CUT', (bandL + bandR) / 2, H / 2 - 48);
    }
    if (paused || over) {
      ctx.fillStyle = 'rgba(12, 10, 8, 0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f6efe4';
      ctx.font = '700 28px sans-serif';
      ctx.fillText(over ? 'FUSE' : 'PAUSED', W / 2, H / 2);
    }
  }

  function destroy() {
    if (loop) loop.stop();
    paused = false;
    over = false;
    const ov = document.getElementById('snip-overlay');
    if (ov) {
      ov.style.display = 'none';
      ov.onclick = null;
    }
    draw();
  }

  return { init, start, resume, destroy, togglePause, restart };
})();
