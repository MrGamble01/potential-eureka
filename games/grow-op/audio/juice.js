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
    const text = scene.add.text(x, y, `+$${Math.floor(Number(amount) || 0)}${clean ? ' clean' : ''}`, {
      fontFamily: 'Outfit, sans-serif',
      fontSize: '16px',
      fontStyle: '700',
      color: clean ? CLEAN : DIRTY
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
      if (graphics.fillStyle) graphics.fillStyle(p.color, Math.max(0, p.life));
      if (graphics.fillCircle) graphics.fillCircle(p.x, p.y, p.r);
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

  return { cashPop, shake, pulseBuilding, burst, step, floaters, parts };
}
