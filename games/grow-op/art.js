// Texture-key facade. The map scene asks for a key, then we bake a canvas
// into a Phaser texture and hang it on the lot. Submodules own the drawing.

import { renderStructure, renderCleared, renderPlot, spriteKind, LOT_PRESET } from './art/buildings.js';
import { renderFoundation, renderScaffold, renderCrane, renderCrumble, renderPop } from './art/construction.js';
import { renderCard, renderIcon, CARD_IDS } from './art/cards.js';
import { drawWorld, drawFog, WORLD_W, WORLD_H, RIVER, HARBOR } from './art/terrain.js';
import { drawMiniTruck, paintAmbient } from './art/vehicles.js';

export { drawWorld, drawFog, WORLD_W, WORLD_H, RIVER, HARBOR, drawMiniTruck, paintAmbient, LOT_PRESET };

export function coversExtendedMap() {
  return true;
}

export const CONSTRUCTION_KEYS = {
  cleared: ['go-s-cleared-d', 'go-s-cleared-n'],
  foundation: ['go-fx-foundation-d', 'go-fx-foundation-n'],
  scaffold: ['go-fx-scaffold-0', 'go-fx-scaffold-1'],
  crane: ['go-fx-crane-0', 'go-fx-crane-1'],
  crumble: ['go-fx-crumble-0', 'go-fx-crumble-1', 'go-fx-crumble-2', 'go-fx-crumble-3'],
  pop: ['go-fx-pop-0', 'go-fx-pop-1', 'go-fx-pop-2']
};

export const CARD_KEYS = CARD_IDS.map((id) => `go-card-${id}`);
export const ICON_KEYS = CARD_IDS.map((id) => `go-icon-${id}`);

export const TEXTURE_KEYS = {
  construction: CONSTRUCTION_KEYS,
  cards: CARD_KEYS,
  icons: ICON_KEYS
};

const mem = new Map();

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function fxFrame(now, kind) {
  const period = kind === 'crumble' || kind === 'dust' ? 160 : 180;
  const count = kind === 'crumble' || kind === 'dust' ? 4 : 2;
  return Math.floor(now / period) % count;
}

function stageKey(ctx) {
  const stage = ctx.stage || ctx.buildStage;
  if (!stage) return null;
  const frame = ctx.frame || 0;
  const n = ctx.night ? 'n' : 'd';
  if (stage === 'cleared') return `go-s-cleared-${n}`;
  if (stage === 'foundation') return `go-fx-foundation-${n}`;
  if (stage === 'scaffold') return `go-fx-scaffold-${frame % 2}`;
  if (stage === 'crane') return `go-fx-crane-${frame % 2}`;
  if (stage === 'crumble' || stage === 'dust') return `go-fx-crumble-${frame % 4}`;
  if (stage === 'pop') return `go-fx-pop-${Math.min(2, frame)}`;
  return null;
}

function buildKey(ctx, m, now) {
  const left = ctx.constructLeft || 0;
  if (!m.buildMax || left > m.buildMax) m.buildMax = Math.max(left, 0.01);
  const t = 1 - left / m.buildMax;
  const n = ctx.night ? 'n' : 'd';
  if (t < 0.28) return `go-fx-foundation-${n}`;
  if (t < 0.66) return `go-fx-scaffold-${fxFrame(now, 'scaffold')}`;
  return `go-fx-crane-${fxFrame(now, 'crane')}`;
}

function crumbleKey(ctx, m, now) {
  const left = ctx.demolishLeft || 0;
  if (left > 0) {
    if (!m.demoMax || left > m.demoMax) m.demoMax = left;
    const t = 1 - left / m.demoMax;
    return `go-fx-crumble-${Math.min(3, Math.floor(t * 4))}`;
  }
  return `go-fx-crumble-${fxFrame(now, 'crumble')}`;
}

export function textureKey(ctx = {}) {
  const phase = ctx.phase || '';
  const current = ctx.rival ? 'rival' : (ctx.buildingId || null);
  const id = ctx.slotId || current || 'lot';
  const now = nowMs();
  let m = mem.get(id);
  if (!m) {
    m = { b: current, cleared: phase === 'cleared', fx: null, until: 0, phase, popStart: 0, buildMax: 0, demoMax: 0 };
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
  if (m.phase === 'building' && phase === 'operating') {
    m.fx = 'pop';
    m.popStart = now;
    m.until = now + 900;
  }
  m.phase = phase;
  if (phase !== 'building' && !(ctx.constructLeft > 0)) m.buildMax = 0;
  if (phase !== 'demolishing') m.demoMax = 0;
  const forced = stageKey(ctx);
  if (forced) return forced;
  const n = ctx.night ? 'n' : 'd';
  if (phase === 'demolishing') return crumbleKey(ctx, m, now);
  if (phase === 'building' || (ctx.constructLeft > 0 && phase !== 'operating')) return buildKey(ctx, m, now);
  if (m.fx === 'pop' && now < m.until) return `go-fx-pop-${Math.min(2, Math.floor((now - m.popStart) / 300))}`;
  if (m.fx === 'dust' && now < m.until && !current) return crumbleKey(ctx, m, now);
  if (m.fx === 'scaffold' && now < m.until && phase !== 'operating') return `go-fx-scaffold-${fxFrame(now, 'scaffold')}`;
  if (m.fx !== 'pop' || now >= m.until) m.fx = null;
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

export function bakeCanvas(key) {
  if (!key) return null;
  if (key.startsWith('go-fx-dust-') || key.startsWith('go-fx-crumble-')) return renderCrumble(Number(key.slice(-1)));
  if (key.startsWith('go-fx-scaffold-')) return renderScaffold(Number(key.slice(-1)));
  if (key.startsWith('go-fx-foundation-')) return renderFoundation(key.endsWith('-n'));
  if (key.startsWith('go-fx-crane-')) return renderCrane(Number(key.slice(-1)));
  if (key.startsWith('go-fx-pop-')) return renderPop(Number(key.slice(-1)));
  if (key.startsWith('go-s-cleared-')) return renderCleared(key.endsWith('-n'));
  if (key.startsWith('go-s-plot-')) return renderPlot(key.endsWith('-n'));
  if (key.startsWith('go-card-')) return renderCard(key.slice('go-card-'.length));
  if (key.startsWith('go-icon-')) return renderIcon(key.slice('go-icon-'.length));
  const m = /^go-s-(.+)-(sale|owned|held)-(d|n)-l(\d)$/.exec(key);
  if (!m) return null;
  return renderStructure(m[1], m[2], m[3] === 'n', Number(m[4]));
}

export function warmTexture(scene, key) {
  if (!scene || !scene.textures || scene.textures.exists(key)) return key;
  const c = bakeCanvas(key);
  if (c) scene.textures.addCanvas(key, c);
  return key;
}

function ensureTexture(scene, key) {
  warmTexture(scene, key);
}

function presentedKey(key, ctx) {
  if (typeof key === 'string' && /^go-(s|fx|card|icon)-/.test(key)) return key;
  const next = Object.assign({}, ctx);
  if (typeof key === 'string' && key && next.buildingId === key) {
    next.propertyType = next.propertyType || key;
    next.buildingId = null;
    next.slotId = next.slotId || key;
  }
  return textureKey(next);
}

export function drawKeyed(g, key, ctx) {
  const scene = g && g.scene;
  if (!scene) return;
  key = presentedKey(key, ctx || {});
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
