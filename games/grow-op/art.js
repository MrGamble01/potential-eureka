// Texture-key facade. The map scene asks for a key, then we bake a canvas
// into a Phaser texture and hang it on the lot. Submodules own the drawing.

import { renderStructure, renderScaffold, renderDust, renderCleared, renderPlot, spriteKind, LOT_PRESET } from './art/buildings.js';
import { drawWorld, drawFog, WORLD_W, WORLD_H, RIVER, HARBOR } from './art/terrain.js';
import { drawMiniTruck, paintAmbient } from './art/vehicles.js';

export { drawWorld, drawFog, WORLD_W, WORLD_H, RIVER, HARBOR, drawMiniTruck, paintAmbient, LOT_PRESET };

const mem = new Map();

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function fxFrame(now, kind) {
  return Math.floor(now / (kind === 'dust' ? 140 : 160)) % (kind === 'dust' ? 4 : 2);
}

export function textureKey(ctx = {}) {
  const phase = ctx.phase || '';
  const current = ctx.rival ? 'rival' : (ctx.buildingId || null);
  const id = ctx.slotId || current || 'lot';
  const now = nowMs();
  let m = mem.get(id);
  if (!m) {
    m = { b: current, cleared: phase === 'cleared', fx: null, until: 0 };
    mem.set(id, m);
  } else if (m.b !== current) {
    if (m.b && !current && phase !== 'demolishing' && phase !== 'building') {
      m.fx = 'dust';
      m.until = now + 1100;
      m.cleared = true;
    } else if (!m.b && current && phase !== 'building' && !(ctx.constructLeft > 0)) {
      m.fx = 'scaffold';
      m.until = now + 1300;
      m.cleared = false;
    }
    m.b = current;
  }
  const n = ctx.night ? 'n' : 'd';
  if (phase === 'demolishing') return `go-fx-dust-${fxFrame(now, 'dust')}`;
  if (phase === 'building' || ctx.constructLeft > 0) return `go-fx-scaffold-${fxFrame(now, 'scaffold')}`;
  if (m.fx === 'dust' && now < m.until && !current) return `go-fx-dust-${fxFrame(now, 'dust')}`;
  if (m.fx === 'scaffold' && now < m.until && phase !== 'operating') return `go-fx-scaffold-${fxFrame(now, 'scaffold')}`;
  m.fx = null;
  if (phase === 'cleared' || (m.cleared && !current && !ctx.propertyType)) return `go-s-cleared-${n}`;
  if (ctx.rival || (ctx.propertyType === 'outpost' && !ctx.buildingId)) return `go-s-rival-owned-${n}-l1`;
  if (ctx.buildingId) {
    const lv = (ctx.level || 1) >= 2 ? 2 : 1;
    return `go-s-${ctx.buildingId}-owned-${n}-l${lv}`;
  }
  if (ctx.propertyType) {
    const kind = spriteKind(ctx.propertyType, ctx.size);
    const lv = (ctx.level || 1) >= 2 ? 2 : 1;
    if (!ctx.owned) return `go-s-${kind}-sale-${n}-l1`;
    if (phase === 'encumbered') return `go-s-${kind}-held-${n}-l1`;
    return `go-s-${kind}-owned-${n}-l${lv}`;
  }
  if (phase === 'wild') return `go-s-plot-${n}`;
  const preset = LOT_PRESET[ctx.slotId];
  if (preset) return `go-s-${preset}-sale-${n}-l1`;
  return `go-s-plot-${n}`;
}

function ensureTexture(scene, key) {
  if (!scene || !scene.textures || scene.textures.exists(key)) return;
  let c = null;
  if (key.startsWith('go-fx-dust-')) c = renderDust(Number(key.slice(-1)));
  else if (key.startsWith('go-fx-scaffold-')) c = renderScaffold(Number(key.slice(-1)));
  else if (key.startsWith('go-s-cleared-')) c = renderCleared(key.endsWith('-n'));
  else if (key.startsWith('go-s-plot-')) c = renderPlot(key.endsWith('-n'));
  else {
    const m = /^go-s-(.+)-(sale|owned|held)-(d|n)-l(\d)$/.exec(key);
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
