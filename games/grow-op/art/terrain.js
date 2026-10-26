// World facade. The landmass itself is baked in map-draw.js. This module
// hangs those tiles on the scene and veils locked valley districts along
// their organic edges.

import { DISTRICT_EDGE, HARBOR_PTS, RIVER_PTS } from '../map-layout.js';
import { paintTerrainTiles } from '../map-draw.js';

export const WORLD_W = 2520;
export const WORLD_H = 1360;
export const RIVER = RIVER_PTS;
export const HARBOR = HARBOR_PTS;

export function drawWorld(g, roads) {
  const scene = g.scene;
  if (!scene || !scene.textures) return;
  if (!scene.textures.exists('go-world-0-0')) {
    const tiles = paintTerrainTiles(roads || []);
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      scene.textures.addCanvas(tile.key, tile.canvas);
      scene.add.image(tile.x, tile.y, tile.key).setOrigin(0, 0).setDepth(-2).setName(tile.key);
    }
  }
  g.clear();
  g.setVisible(false);
}

function veil(g, poly, alpha) {
  g.fillStyle(0x1c2420, 0.34 * alpha);
  g.beginPath();
  g.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) g.lineTo(poly[i][0], poly[i][1]);
  g.closePath();
  g.fillPath();
  g.lineStyle(22, 0x121816, 0.28 * alpha);
  g.strokePath();
  g.lineStyle(4, 0xe7f0e4, 0.22 * alpha);
  g.strokePath();
}

export function drawFog(g, regions, simState) {
  g.clear();
  if (!regions) return;
  for (let i = 0; i < regions.length; i++) {
    const reg = regions[i];
    if (!reg.unlockCostClean) continue;
    const row = simState && simState.regions && simState.regions[reg.id];
    if (row && row.unlocked) continue;
    const poly = DISTRICT_EDGE[reg.id];
    if (poly) veil(g, poly, 1);
    const b = reg.bounds;
    const x = b.x + b.w * 0.5;
    const y = b.y + 78;
    g.fillStyle(0xf7f1e4, 0.94);
    g.fillCircle(x, y, 16);
    g.lineStyle(3, 0x8a3224, 1);
    g.strokeCircle(x, y, 16);
    g.fillStyle(0x8a3224, 1);
    g.fillRoundedRect(x - 7, y - 1, 14, 10, 2);
    g.lineStyle(2, 0x8a3224, 1);
    g.beginPath();
    g.arc(x, y - 1, 5, Math.PI, 0, false);
    g.strokePath();
  }
}
