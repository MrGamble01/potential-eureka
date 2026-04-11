/* ============================================
   EFFECTS — Boot sequence, particles, 3D tilt,
   mouse glow, glitch, Konami code
   ============================================ */

const Effects = (() => {
  // ---- BOOT SEQUENCE ----
  const bootLines = [
    { text: 'BIOS v4.2.0 — POTENTIAL EUREKA SYSTEMS', delay: 100 },
    { text: 'Memory check... 16384 MB OK', delay: 150 },
    { text: 'Loading kernel modules......... OK', delay: 200 },
    { text: 'Mounting filesystem............ OK', delay: 180 },
    { text: 'Neural interface online........ OK', delay: 220 },
    { text: 'Quantum link established....... OK', delay: 200 },
    { text: 'Display matrix calibrated...... OK', delay: 180 },
    { text: 'Dashboard modules loaded....... OK', delay: 200 },
    { text: '', delay: 150 },
    { text: 'ALL SYSTEMS NOMINAL', delay: 250, cls: 'boot-success' },
    { text: '', delay: 150 },
    { text: 'WELCOME, OPERATOR.', delay: 400, cls: 'boot-highlight' },
  ];

  let bootSkipped = false;

  async function bootSequence() {
    if (sessionStorage.getItem('eureka-booted')) {
      staggerWidgets();
      return;
    }

    const overlay = document.getElementById('boot-overlay');
    const terminal = document.getElementById('boot-terminal');
    if (!overlay || !terminal) return;

    overlay.style.display = 'flex';

    const skipHandler = () => { bootSkipped = true; };
    overlay.addEventListener('click', skipHandler);

    for (const line of bootLines) {
      if (bootSkipped) break;
      await delay(line.delay);
      if (bootSkipped) break;

      const el = document.createElement('div');
      el.className = 'boot-line';
      if (line.cls) el.classList.add(line.cls);
      terminal.appendChild(el);
      terminal.scrollTop = terminal.scrollHeight;

      for (let i = 0; i < line.text.length; i++) {
        if (bootSkipped) { el.textContent = line.text; break; }
        el.textContent += line.text[i];
        await delay(Math.random() * 15 + 5);
      }
    }

    overlay.removeEventListener('click', skipHandler);
    sessionStorage.setItem('eureka-booted', '1');

    if (!bootSkipped) await delay(600);
    overlay.classList.add('boot-fade-out');
    await delay(500);
    overlay.style.display = 'none';

    staggerWidgets();
  }

  // ---- PARTICLE NETWORK ----
  let particleCanvas, pCtx;
  let particles = [];
  let mouseX = -1000, mouseY = -1000;

  function initParticles() {
    particleCanvas = document.getElementById('particle-canvas');
    if (!particleCanvas) return;
    pCtx = particleCanvas.getContext('2d');

    function resize() {
      particleCanvas.width = window.innerWidth;
      particleCanvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const count = Math.min(80, Math.floor(window.innerWidth * window.innerHeight / 15000));
    const colors = ['#00ff41', '#00d4ff', '#ff00ff'];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * particleCanvas.width,
        y: Math.random() * particleCanvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.5 + 0.5,
        color: colors[Math.floor(Math.random() * 3)],
      });
    }

    document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
    requestAnimationFrame(tickParticles);
  }

  function tickParticles() {
    const W = particleCanvas.width, H = particleCanvas.height;
    pCtx.clearRect(0, 0, W, H);

    for (const p of particles) {
      const dx = p.x - mouseX, dy = p.y - mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 150) {
        const f = (150 - dist) / 150 * 0.02;
        p.vx += dx * f;
        p.vy += dy * f;
      }
      p.vx *= 0.99; p.vy *= 0.99;
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;

      pCtx.beginPath();
      pCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      pCtx.fillStyle = p.color;
      pCtx.globalAlpha = 0.5;
      pCtx.fill();
    }

    // Connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d = dx * dx + dy * dy;
        if (d < 14400) { // 120^2
          pCtx.beginPath();
          pCtx.moveTo(particles[i].x, particles[i].y);
          pCtx.lineTo(particles[j].x, particles[j].y);
          pCtx.strokeStyle = particles[i].color;
          pCtx.globalAlpha = (1 - Math.sqrt(d) / 120) * 0.12;
          pCtx.lineWidth = 0.5;
          pCtx.stroke();
        }
      }
    }
    pCtx.globalAlpha = 1;
    requestAnimationFrame(tickParticles);
  }

  // ---- 3D CARD TILT ----
  function init3DTilt() {
    document.querySelectorAll('.widget').forEach(w => {
      w.addEventListener('mousemove', e => {
        const r = w.getBoundingClientRect();
        const rx = ((e.clientY - r.top) / r.height - 0.5) * -10;
        const ry = ((e.clientX - r.left) / r.width - 0.5) * 10;
        w.style.transform = `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.02)`;
        w.style.boxShadow = `${-ry * 0.5}px ${rx * 0.5}px 25px rgba(0, 255, 65, 0.12)`;
      });
      w.addEventListener('mouseleave', () => {
        w.style.transform = '';
        w.style.boxShadow = '';
      });
    });
  }

  // ---- MOUSE GLOW ----
  function initMouseGlow() {
    const glow = document.createElement('div');
    glow.id = 'mouse-glow';
    document.body.appendChild(glow);
    document.addEventListener('mousemove', e => {
      glow.style.left = e.clientX + 'px';
      glow.style.top = e.clientY + 'px';
    });
  }

  // ---- STAGGER WIDGET ENTRY ----
  function staggerWidgets() {
    document.querySelectorAll('.widget').forEach((w, i) => {
      w.style.opacity = '0';
      w.style.transform = 'translateY(30px) scale(0.97)';
      setTimeout(() => {
        w.style.transition = 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.22,1,0.36,1)';
        w.style.opacity = '1';
        w.style.transform = 'translateY(0) scale(1)';
        setTimeout(() => { w.style.transition = ''; w.style.transform = ''; }, 700);
      }, i * 80 + 50);
    });
  }

  // ---- KONAMI CODE → MATRIX RAIN ----
  const konamiSeq = [38,38,40,40,37,39,37,39,66,65];
  let kIdx = 0;
  let matrixOn = false;
  let matrixRaf = null;

  function initKonami() {
    document.addEventListener('keydown', e => {
      if (e.keyCode === konamiSeq[kIdx]) {
        kIdx++;
        if (kIdx === konamiSeq.length) { kIdx = 0; toggleMatrix(); }
      } else { kIdx = 0; }
    });
  }

  function toggleMatrix() {
    const c = document.getElementById('matrix-canvas');
    if (!c) return;
    matrixOn = !matrixOn;
    if (matrixOn) {
      c.style.display = 'block';
      const ctx = c.getContext('2d');
      c.width = window.innerWidth;
      c.height = window.innerHeight;
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%ΣΠΩαβγδ潜力発見';
      const sz = 14;
      const cols = Math.floor(c.width / sz);
      const drops = Array(cols).fill(0).map(() => Math.floor(Math.random() * -20));

      function draw() {
        if (!matrixOn) return;
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.font = `${sz}px monospace`;
        for (let i = 0; i < cols; i++) {
          ctx.fillStyle = `rgba(0,255,65,${Math.random()*0.4+0.6})`;
          ctx.fillText(chars[Math.floor(Math.random()*chars.length)], i*sz, drops[i]*sz);
          if (drops[i]*sz > c.height && Math.random() > 0.975) drops[i] = 0;
          drops[i]++;
        }
        matrixRaf = requestAnimationFrame(draw);
      }
      draw();
    } else {
      c.style.display = 'none';
      if (matrixRaf) cancelAnimationFrame(matrixRaf);
    }
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function init() {
    initMouseGlow();
    initParticles();
    initKonami();
    await bootSequence();
    init3DTilt();
  }

  return { init, init3DTilt };
})();
