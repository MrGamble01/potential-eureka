// Texture-key facade. The map scene asks for a key, then we bake a canvas
// into a Phaser texture and hang it on the lot. Submodules own the drawing.

import { renderStructure, renderScaffold, renderDust, renderCleared, LOT_PRESET } from './art/buildings.js';
import { drawWorld, drawFog, WORLD_W, WORLD_H, RIVER, HARBOR } from './art/terrain.js';
import { drawMiniTruck, paintAmbient } from './art/vehicles.js';

export { drawWorld, drawFog, WORLD_W, WORLD_H, RIVER, HARBOR, drawMiniTruck, paintAmbient, LOT_PRESET };

const mem = new Map();

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function textureKey(ctx = {}) {
  const current = ctx.rival ? 'rival' : (ctx.buildingId || null);
  const id = ctx.slotId || current || 'lot';
  const now = nowMs();
  let m = mem.get(id);
  if (!m) {
    m = { b: current, cleared: false, fx: null, until: 0 };
    mem.set(id, m);
  } else if (m.b && !current) {
    m.fx = 'dust';
    m.until = now + 1100;
    m.b = null;
    m.cleared = true;
  } else if (!m.b && current) {
    m.fx = 'scaffold';
    m.until = now + 1300;
    m.b = current;
    m.cleared = false;
  }
  if (m.fx && now < m.until) {
    const span = m.fx === 'dust' ? 4 : 2;
    const frame = Math.floor(now / 140) % span;
    return m.fx === 'dust' ? `go-fx-dust-${frame}` : `go-fx-scaffold-${frame}`;
  }
  m.fx = null;
  const n = ctx.night ? 'n' : 'd';
  if (ctx.rival) return `go-s-rival-owned-${n}-l1`;
  if (!ctx.buildingId) {
    if (m.cleared) return `go-s-cleared-${n}`;
    const preset = LOT_PRESET[ctx.slotId] || 'cleared';
    if (preset === 'cleared') return `go-s-cleared-${n}`;
    return `go-s-${preset}-sale-${n}-l1`;
  }
  const lv = (ctx.level || 1) >= 2 ? 2 : 1;
  return `go-s-${ctx.buildingId}-owned-${n}-l${lv}`;
}

function ensureTexture(scene, key) {
  if (!scene || !scene.textures || scene.textures.exists(key)) return;
  let c = null;
  if (key.startsWith('go-fx-dust-')) c = renderDust(Number(key.slice(-1)));
  else if (key.startsWith('go-fx-scaffold-')) c = renderScaffold(Number(key.slice(-1)));
  else if (key.startsWith('go-s-cleared-')) c = renderCleared(key.endsWith('-n'));
  else {
    const m = /^go-s-(.+)-(sale|owned)-(d|n)-l(\d)$/.exec(key);
    if (!m) return;
    c = renderStructure(m[1], m[2], m[3] === 'n', Number(m[4]));
  }
  if (c) scene.textures.addCanvas(key, c);
}

export function drawKeyed(g, key, ctx) {
  const scene = g && g.scene;
  if (!scene) return;
  ensureTexture(scene, key);
  if (!scene.textures.exists(key)) return;
  g.setVisible(false);
  const parent = g.parentContainer;
  let img = g.getData && g.getData('sprite');
  if (!img || !img.scene) {
    img = scene.add.image(0, 20, key);
    img.setOrigin(0.5, 0.84);
    img.setScale(0.7);
    if (parent) parent.add(img);
    if (g.setData) g.setData('sprite', img);
  } else if (img.texture && img.texture.key !== key) {
    img.setTexture(key);
  }
}

export function paintStructure(g, buildingId, rival) {
  const ctx = {
    buildingId: buildingId || null,
    rival: !!rival,
    level: 1,
    night: false,
    progress: 0,
    slotId: `legacy-${buildingId || 'plot'}-${rival ? 'r' : 'p'}`
  };
  drawKeyed(g, textureKey(ctx), ctx);
}
