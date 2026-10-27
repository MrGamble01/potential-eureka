// Small scene-facing juice. The map calls these; it does not own the motion.

const DIRTY = '#7dcea0';
const CLEAN = '#8ec5ff';

function pointOf(scene, target) {
  if (!target) return null;
  if (typeof target === 'string') {
    const node = scene.slots && scene.slots[target];
    if (!node || !node.def) return null;
    return { x: node.def.x, y: node.def.y };
  }
  if (typeof target.x === 'number' && typeof target.y === 'number') return { x: target.x, y: target.y };
  return null;
}

export function createJuice(scene) {
  const floaters = [];
  const parts = [];
  const sweeps = [];
  let graphics = null;
  if (scene.add && scene.add.graphics) {
    graphics = scene.add.graphics();
    if (graphics.setDepth) graphics.setDepth(32);
  }

  function cashPop(slotId, amount, kind) {
    const node = scene.slots && scene.slots[slotId];
    if (!node || !node.def || !scene.add || !scene.add.text) return null;
    const stack = floaters.filter((f) => f.slotId === slotId).length;
    const x = node.def.x;
    const y = node.def.y - 22 - stack * 16;
    const clean = kind === 'clean';
    const n = Math.floor(Number(amount) || 0);
    const sign = n < 0 ? '-' : '+';
    const text = scene.add.text(x, y, `${sign}$${Math.abs(n)}${clean ? ' clean' : ''}`, {
      fontFamily: 'Outfit, sans-serif',
      fontSize: '16px',
      fontStyle: '700',
      color: n < 0 ? '#ffb4ae' : (clean ? CLEAN : DIRTY)
    });
    if (text.setOrigin) text.setOrigin(0.5);
    if (text.setDepth) text.setDepth(33);
    const floater = { node: text, slotId, x, y, life: 1.15, vy: 32 };
    floaters.push(floater);
    while (floaters.length > 24) {
      const old = floaters.shift();
      if (old && old.node && old.node.destroy) old.node.destroy();
    }
    return floater;
  }

  function shake(ms, intensity) {
    const cam = scene.cameras && scene.cameras.main;
    if (cam && cam.shake) cam.shake(ms || 280, intensity == null ? 0.005 : intensity);
  }

  function pulseBuilding(slotId) {
    const node = scene.slots && scene.slots[slotId];
    if (!node || !node.root || node._pulsing || !scene.tweens) return;
    node._pulsing = true;
    scene.tweens.add({
      targets: node.root,
      scaleX: 1.07,
      scaleY: 1.07,
      duration: 120,
      yoyo: true,
      ease: 'Sine.easeOut',
      onComplete: () => {
        if (node.root.setScale) node.root.setScale(1);
        node._pulsing = false;
      }
    });
  }

  function burst(target, color) {
    const p = pointOf(scene, target);
    if (!p || !graphics) return;
    const tint = color == null ? 0xe7d3a1 : color;
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8 + Math.random() * 0.2;
      const speed = 36 + Math.random() * 28;
      parts.push({
        x: p.x,
        y: p.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed * 0.7 - 16,
        life: 0.55 + Math.random() * 0.2,
        r: 2 + Math.random() * 2,
        color: tint
      });
    }
    while (parts.length > 80) parts.shift();
  }

  function demolishDust(target) {
    const p = pointOf(scene, target);
    if (!p) return;
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI * 2 * i) / 16 + Math.random() * 0.3;
      const speed = 20 + Math.random() * 50;
      parts.push({
        x: p.x + (Math.random() - 0.5) * 20,
        y: p.y,
        vx: Math.cos(a) * speed,
        vy: -20 - Math.random() * 40,
        life: 0.85 + Math.random() * 0.4,
        r: 3 + Math.random() * 3,
        color: i % 2 ? 0xc4b6a2 : 0x8d8376
      });
    }
    while (parts.length > 80) parts.shift();
  }

  function unlockSweep(target, label) {
    const p = pointOf(scene, target) || { x: 480, y: 640 };
    sweeps.push({ kind: 'fog', x: p.x, y: p.y, life: 1.35, r: 70 });
    if (label && scene.add && scene.add.text) {
      const text = scene.add.text(p.x, p.y - 30, label, {
        fontFamily: 'Outfit, sans-serif',
        fontSize: '18px',
        fontStyle: '700',
        color: '#e7f6ff'
      });
      if (text.setOrigin) text.setOrigin(0.5);
      if (text.setDepth) text.setDepth(33);
      floaters.push({ node: text, slotId: label, x: p.x, y: p.y - 30, life: 1.35, vy: 22 });
    }
  }

  function controlFlash(target) {
    const p = pointOf(scene, target) || { x: 480, y: 640 };
    sweeps.push({ kind: 'flash', x: p.x, y: p.y, life: 0.7, r: 36 });
  }

  function step(dt) {
    const stepDt = Math.max(0, Number(dt) || 0);
    if (graphics && graphics.clear) graphics.clear();
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= stepDt;
      if (p.life <= 0) {
        parts.splice(i, 1);
        continue;
      }
      p.x += p.vx * stepDt;
      p.y += p.vy * stepDt;
      p.vy += 40 * stepDt;
      if (!graphics) continue;
      if (graphics.fillStyle) graphics.fillStyle(p.color, Math.max(0, p.life));
      if (graphics.fillCircle) graphics.fillCircle(p.x, p.y, p.r);
    }
    for (let i = sweeps.length - 1; i >= 0; i--) {
      const s = sweeps[i];
      s.life -= stepDt;
      if (s.life <= 0) {
        sweeps.splice(i, 1);
        continue;
      }
      const grow = s.kind === 'fog' ? (1.35 - s.life) * 180 : (0.7 - s.life) * 220;
      const alpha = Math.max(0, s.life) * (s.kind === 'fog' ? 0.22 : 0.4);
      if (!graphics) continue;
      if (graphics.fillStyle) graphics.fillStyle(s.kind === 'fog' ? 0xd5e4ee : 0x8ec5ff, alpha);
      if (graphics.fillCircle) graphics.fillCircle(s.x, s.y - (s.kind === 'fog' ? (1.35 - s.life) * 40 : 0), s.r + grow);
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.life -= stepDt;
      f.y -= f.vy * stepDt;
      if (f.node.setPosition) f.node.setPosition(f.x, f.y);
      if (f.node.setAlpha) f.node.setAlpha(Math.max(0, f.life));
      if (f.life <= 0) {
        if (f.node.destroy) f.node.destroy();
        floaters.splice(i, 1);
      }
    }
  }

  return { cashPop, shake, pulseBuilding, burst, demolishDust, unlockSweep, controlFlash, step, floaters, parts, sweeps };
}
