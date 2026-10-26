// Grow Op: San Verde '84 — top-down regional world.
// Terrain, 3/4 buildings, road-following trucks, weather, and label LOD.

import { GOODS } from './data/goods.js';
import { BUILDINGS } from './data/buildings.js';
import { REGIONS, BUILD_SLOTS, ROAD_NETWORK, LIEUTENANTS } from './data/missions.js';

export const WORLD_W = 2400;
export const WORLD_H = 1280;

const RIVER = [
  [150, 180], [210, 340], [250, 520], [280, 700], [310, 860], [360, 1040], [470, 1180]
];
const HARBOR = [
  [310, 860], [520, 930], [780, 900], [1040, 940], [1215, 980], [1320, 1100]
];

const PLATES = {
  rio_plata: { x: 470, y: 990, title: 'RÍO PLATA VALLEY', sub: 'Puerto Plata' },
  san_marco: { x: 1180, y: 1020, title: 'SAN MARCO DISTRICT', sub: 'Ciudad San Marco' },
  sierra_alta: { x: 1900, y: 990, title: 'SIERRA ALTA', sub: 'Villa Dorada' }
};

export class MapScene extends window.Phaser.Scene {
  constructor() {
    super({ key: 'MapScene' });
    this.slots = {};
    this.trucks = {};
    this.badges = {};
    this.smoke = [];
    this.floaters = [];
    this.boats = [];
    this.plane = null;
    this.drag = false;
    this.dragMoved = false;
    this.pinch = null;
    this.userPanned = false;
    this.phase = 0;
  }

  create() {
    this.sim = this.registry.get('sim');
    this.onSlotSelected = this.registry.get('onSlotSelected') || (() => {});
    this.onRegionSelected = this.registry.get('onRegionSelected') || (() => {});
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setBackgroundColor('#2c3824');

    this.terrain = this.add.graphics();
    this.water = this.add.graphics();
    this.hatch = this.add.graphics();
    this.life = this.add.graphics();
    this.flow = this.add.graphics();
    this.sky = this.add.graphics().setDepth(30);
    this.drawTerrain();
    this.drawHatch();
    this.createPlates();
    this.createSlots();
    this.createBadges();
    this.spawnAmbientCraft();
    this.bindCamera();
    this.frameValley(true);
    this.scale.on('resize', () => {
      if (!this.userPanned) this.frameValley(true);
    });
  }

  drawTerrain() {
    const g = this.terrain;
    g.clear();
    g.fillStyle(0x3e4c32, 1);
    g.fillRect(0, 0, WORLD_W, WORLD_H);

    // Valley fields
    const fields = [
      [430, 520, 220, 120, 0x6a8a45],
      [640, 500, 160, 90, 0x7d9a4e],
      [390, 700, 180, 100, 0x5f7d3c],
      [620, 690, 150, 80, 0x87a656]
    ];
    for (const [x, y, w, h, color] of fields) {
      g.fillStyle(color, 0.85);
      g.fillEllipse(x, y, w, h);
      g.lineStyle(1, 0x3d5228, 0.35);
      for (let row = -h / 2 + 10; row < h / 2; row += 12) {
        g.lineBetween(x - w / 2 + 16, y + row, x + w / 2 - 16, y + row);
      }
    }

    // Jungle masses
    const groves = [
      [180, 260], [320, 200], [520, 230], [760, 280], [900, 220],
      [160, 480], [200, 640], [760, 430], [820, 760], [1600, 300],
      [1500, 700], [2140, 280], [2200, 520], [2080, 900], [600, 1100],
      [900, 1140], [1500, 1080], [1900, 1120]
    ];
    for (const [x, y] of groves) this.grove(g, x, y);

    // Sierra hills
    const hills = [
      [1760, 420, 280, 160, 0x5c6a48],
      [1980, 390, 320, 180, 0x6d6248],
      [1880, 560, 360, 150, 0x546246],
      [2100, 640, 240, 120, 0x7a6a4c],
      [1720, 760, 220, 100, 0x4e5c40]
    ];
    for (const [x, y, w, h, color] of hills) {
      g.fillStyle(0x2a2418, 0.25);
      g.fillEllipse(x + 10, y + 18, w, h * 0.7);
      g.fillStyle(color, 0.95);
      g.fillEllipse(x, y, w, h);
      g.fillStyle(0x8d9a6e, 0.35);
      g.fillEllipse(x - w * 0.12, y - h * 0.18, w * 0.45, h * 0.28);
    }

    // San Marco town blocks and port sheds (scenery, not build sites)
    this.townBlock(g, 1060, 360, 5, 2);
    this.townBlock(g, 1340, 340, 4, 2);
    this.townBlock(g, 1480, 520, 3, 3);
    this.townBlock(g, 1000, 780, 3, 2);
    this.portSheds(g, 1280, 900);

    // Puerto Plata lane
    this.townBlock(g, 700, 900, 3, 2);

    this.strokeRiver(g, RIVER, 34, 0x1d4a5c);
    this.strokeRiver(g, HARBOR, 26, 0x1a4252);
    g.lineStyle(3, 0xc4b48a, 0.35);
    this.strokePoly(g, RIVER);
    this.strokePoly(g, HARBOR);

    // Roads
    for (const poly of ROAD_NETWORK) {
      g.lineStyle(16, 0x5a4632, 0.95);
      this.strokePoly(g, poly.map((p) => [p.x, p.y]));
    }
    for (const poly of ROAD_NETWORK) {
      g.lineStyle(9, 0xa89070, 0.95);
      this.strokePoly(g, poly.map((p) => [p.x, p.y]));
      g.lineStyle(1.5, 0xe6d7b8, 0.55);
      for (let i = 0; i < poly.length - 1; i++) this.dash(g, poly[i], poly[i + 1]);
    }

    // District frames, kept thin so they don't read as boxes around buildings
    for (const reg of REGIONS) {
      g.lineStyle(1.5, reg.borderColor, 0.28);
      g.strokeRoundedRect(reg.bounds.x, reg.bounds.y, reg.bounds.w, reg.bounds.h, 28);
    }
  }

  grove(g, x, y) {
    const blobs = [[0, 0, 34], [-16, 10, 26], [18, 8, 24], [4, -14, 20], [-8, -8, 16]];
    for (const [dx, dy, r] of blobs) {
      g.fillStyle(0x1e2c18, 0.9);
      g.fillCircle(x + dx + 3, y + dy + 4, r);
      g.fillStyle(0x2f4a28, 1);
      g.fillCircle(x + dx, y + dy, r);
      g.fillStyle(0x4e7340, 0.85);
      g.fillCircle(x + dx - r * 0.25, y + dy - r * 0.25, r * 0.45);
    }
  }

  townBlock(g, x, y, cols, rows) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = x + c * 28;
        const py = y + r * 24;
        g.fillStyle(0x2a241c, 0.35);
        g.fillRect(px + 2, py + 4, 20, 14);
        g.fillStyle(0xd9c7a4, 1);
        g.fillRect(px, py, 20, 12);
        g.fillStyle(c % 2 ? 0x8c4d38 : 0x6e7c88, 1);
        g.fillRect(px - 1, py - 6, 22, 7);
        g.fillStyle(0x243044, 0.8);
        g.fillRect(px + 4, py + 4, 4, 4);
      }
    }
  }

  portSheds(g, x, y) {
    g.fillStyle(0x8a7352, 1);
    g.fillRect(x, y, 90, 10);
    g.fillRect(x + 30, y, 8, 36);
    g.fillStyle(0x6a5848, 1);
    g.fillRect(x + 8, y - 22, 36, 20);
    g.fillStyle(0x3d4c58, 1);
    g.fillRect(x + 8, y - 28, 36, 8);
    g.fillStyle(0xc4553a, 1);
    g.fillEllipse(x + 70, y + 16, 28, 10);
  }

  strokePoly(g, pts) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.strokePath();
  }

  strokeRiver(g, pts, width, color) {
    g.lineStyle(width + 8, 0xcbb892, 0.55);
    this.strokePoly(g, pts);
    g.lineStyle(width, color, 1);
    this.strokePoly(g, pts);
  }

  dash(g, a, b) {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.floor(len / 16));
    for (let i = 0; i < n; i += 2) {
      const t0 = i / n;
      const t1 = Math.min(1, (i + 0.7) / n);
      g.lineBetween(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0, a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1);
    }
  }

  drawHatch() {
    const g = this.hatch;
    g.clear();
    for (const reg of REGIONS) {
      if (reg.unlockCostClean <= 0) continue;
      const b = reg.bounds;
      g.fillStyle(0x141910, 0.28);
      g.fillRect(b.x, b.y, b.w, b.h);
      g.lineStyle(2, reg.id === 'sierra_alta' ? 0x8a5a3a : 0x243044, 0.28);
      for (let o = -b.h; o < b.w + b.h; o += 22) {
        const x1 = window.Phaser.Math.Clamp(b.x + o, b.x, b.x + b.w);
        const y1 = window.Phaser.Math.Clamp(b.y + (x1 - (b.x + o)), b.y, b.y + b.h);
        const x2 = window.Phaser.Math.Clamp(b.x + o + b.h, b.x, b.x + b.w);
        const y2 = window.Phaser.Math.Clamp(b.y + b.h - ((b.x + o + b.h) - x2), b.y, b.y + b.h);
        if (Math.hypot(x2 - x1, y2 - y1) > 8) g.lineBetween(x1, y1, x2, y2);
      }
    }
  }

  createPlates() {
    this.plates = {};
    for (const [id, plate] of Object.entries(PLATES)) {
      const bg = this.add.rectangle(plate.x, plate.y, 210, 36, 0x141910, 0.72).setStrokeStyle(1, 0xe7d7b8, 0.35);
      const title = this.add.text(plate.x, plate.y - 6, plate.title, {
        fontFamily: 'Outfit, sans-serif', fontSize: '13px', fontStyle: '700', color: '#f4efe4'
      }).setOrigin(0.5);
      const sub = this.add.text(plate.x, plate.y + 10, plate.sub, {
        fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#d5c7a4'
      }).setOrigin(0.5);
      this.plates[id] = { bg, title, sub };
    }
  }

  createBadges() {
    for (const reg of REGIONS) {
      if (!reg.unlockCostClean) continue;
      const at = reg.unlockPos;
      const root = this.add.container(at.x, at.y);
      const bg = this.add.rectangle(0, 0, 250, 48, 0x121820, 0.94).setStrokeStyle(1.5, 0x79b8ff, 0.9);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerup', () => {
        if (!this.dragMoved) this.onRegionSelected(reg.id);
      });
      const title = this.add.text(0, -8, `Unlock ${reg.name}`, {
        fontFamily: 'Outfit, sans-serif', fontSize: '13px', fontStyle: '700', color: '#f4efe4'
      }).setOrigin(0.5);
      const cost = this.add.text(0, 10, `$${reg.unlockCostClean} clean cash`, {
        fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#8ec5ff'
      }).setOrigin(0.5);
      root.add([bg, title, cost]);
      root.setDepth(5);
      this.badges[reg.id] = root;
    }
  }

  createSlots() {
    for (const def of BUILD_SLOTS) {
      const root = this.add.container(def.x, def.y);
      const hit = this.add.ellipse(0, 6, 120, 78, 0x000000, 0.001);
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        if (this.dragMoved) return;
        this.sim.state.selectedSlotId = def.id;
        this.sim.state.selectedRegionId = def.regionId;
        this.onSlotSelected(def.id);
      });
      const select = this.add.ellipse(0, 8, 132, 86, 0x8ec5ff, 0.08).setStrokeStyle(2, 0x8ec5ff, 0.9).setVisible(false);
      const raid = this.add.ellipse(0, 8, 138, 92, 0xf85149, 0.12).setStrokeStyle(2.5, 0xf85149, 0.95).setVisible(false);
      const art = this.add.graphics();
      const barBg = this.add.rectangle(0, -50, 74, 6, 0x10140f, 0.85);
      const bar = this.add.rectangle(-36, -50, 4, 4, 0x7dcea0, 1).setOrigin(0, 0.5);
      const nameBg = this.add.rectangle(0, 58, 132, 22, 0x10140f, 0.88);
      const name = this.add.text(0, 58, def.label, {
        fontFamily: 'Outfit, sans-serif', fontSize: '14px', fontStyle: '700', color: '#f6f1e7'
      }).setOrigin(0.5).setResolution(2);
      const stockBg = this.add.rectangle(0, 78, 120, 16, 0x10140f, 0.8);
      const stock = this.add.text(0, 78, '', {
        fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#d5deea'
      }).setOrigin(0.5).setResolution(2);
      root.add([select, raid, hit, art, barBg, bar, nameBg, name, stockBg, stock]);
      root.setDepth(4);
      this.slots[def.id] = { def, root, hit, select, raid, art, barBg, bar, nameBg, name, stockBg, stock, key: '' };
    }
  }

  spawnAmbientCraft() {
    this.boats = [
      { path: RIVER, at: 0.4, speed: 0.012, cargo: false },
      { path: HARBOR, at: 0.55, speed: 0.02, cargo: true }
    ];
    this.plane = { x: 2040, y: 760, angle: 0, flying: false };
  }

  bindCamera() {
    this.input.on('pointerdown', (p) => {
      this.drag = true;
      this.dragMoved = false;
      this.dragFrom = { x: p.x, y: p.y, sx: this.cameras.main.scrollX, sy: this.cameras.main.scrollY };
    });
    this.input.on('pointermove', (p) => {
      const a = this.input.pointer1;
      const b = this.input.pointer2;
      if (a.isDown && b.isDown) {
        const d = window.Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        if (this.pinch != null) {
          const zoom = window.Phaser.Math.Clamp(this.cameras.main.zoom + (d - this.pinch) * 0.003, 0.48, 1.85);
          this.cameras.main.setZoom(zoom);
        }
        this.pinch = d;
        this.dragMoved = true;
        this.userPanned = true;
        return;
      }
      this.pinch = null;
      if (!this.drag || !p.isDown || !this.dragFrom) return;
      const dx = p.x - this.dragFrom.x;
      const dy = p.y - this.dragFrom.y;
      if (Math.hypot(dx, dy) > 6) {
        this.dragMoved = true;
        this.userPanned = true;
      }
      if (this.dragMoved) {
        const z = this.cameras.main.zoom;
        this.cameras.main.scrollX = this.dragFrom.sx - dx / z;
        this.cameras.main.scrollY = this.dragFrom.sy - dy / z;
      }
    });
    this.input.on('pointerup', () => { this.drag = false; this.pinch = null; });
    this.input.on('wheel', (_p, _o, _dx, dy) => {
      this.userPanned = true;
      this.cameras.main.setZoom(window.Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.0008, 0.48, 1.85));
    });
    this.cursors = this.input.keyboard ? this.input.keyboard.createCursorKeys() : null;
  }

  frameValley(instant) {
    const cam = this.cameras.main;
    const vw = this.scale.width;
    const zoom = vw < 520 ? 0.9 : vw < 900 ? 0.82 : vw < 1500 ? 1.12 : 1.28;
    const focus = vw < 520 ? { x: 490, y: 690 } : { x: 560, y: 640 };
    cam.setZoom(zoom);
    if (instant) cam.centerOn(focus.x, focus.y);
    else cam.pan(focus.x, focus.y, 420, 'Sine.easeInOut');
  }

  frameOverview() {
    this.userPanned = true;
    const cam = this.cameras.main;
    const zoom = Math.min(this.scale.width / 2100, this.scale.height / 1000);
    cam.setZoom(window.Phaser.Math.Clamp(zoom, 0.48, 1.1));
    cam.pan(1200, 680, 480, 'Sine.easeInOut');
  }

  focusOnSlot(slotId, instant = false) {
    const def = BUILD_SLOTS.find((s) => s.id === slotId);
    if (!def) return;
    this.userPanned = true;
    const cam = this.cameras.main;
    const zoom = this.scale.width < 520 ? 0.95 : 1.15;
    cam.setZoom(zoom);
    if (instant) cam.centerOn(def.x, def.y + 20);
    else cam.pan(def.x, def.y + 20, 360, 'Sine.easeInOut');
  }

  focusOnRegion(regionId) {
    const reg = REGIONS.find((r) => r.id === regionId);
    if (!reg) return;
    this.userPanned = true;
    this.cameras.main.pan(reg.bounds.x + reg.bounds.w / 2, reg.bounds.y + reg.bounds.h / 2, 420, 'Sine.easeInOut');
  }

  update(_t, delta) {
    if (!this.sim) this.sim = this.registry.get('sim');
    if (!this.sim) return;
    const dt = Math.min(0.05, delta / 1000);
    this.phase += dt;
    const bind = this.registry.get('bindScene');
    if (bind && !this.bound) {
      bind(this);
      this.bound = true;
    }
    if (!this.sim) this.sim = this.registry.get('sim');
    this.sim.step(dt);
    if (this.cursors) {
      const step = 420 * dt;
      if (this.cursors.left.isDown || this.cursors.right.isDown || this.cursors.up.isDown || this.cursors.down.isDown) {
        this.userPanned = true;
      }
      if (this.cursors.left.isDown) this.cameras.main.scrollX -= step;
      if (this.cursors.right.isDown) this.cameras.main.scrollX += step;
      if (this.cursors.up.isDown) this.cameras.main.scrollY -= step;
      if (this.cursors.down.isDown) this.cameras.main.scrollY += step;
    }
    this.syncRegions();
    this.syncSlots();
    this.syncTrucks();
    this.syncLife(dt);
    this.syncSky();
    this.syncFloaters(dt);
  }

  syncRegions() {
    for (const reg of REGIONS) {
      const state = this.sim.state.regions[reg.id];
      const badge = this.badges[reg.id];
      if (badge) badge.setVisible(state && !state.unlocked);
      const plate = this.plates[reg.id];
      if (!plate || !state) continue;
      const crew = LIEUTENANTS.filter((lt) => {
        const row = this.sim.state.lieutenants[lt.id];
        return row && row.hired && row.regionId === reg.id;
      }).map((lt) => lt.name.split(' ')[0]);
      const heat = state.unlocked ? ` · heat ${Math.floor(state.heat)}%` : ' · locked';
      plate.sub.setText(`${PLATES[reg.id].sub}${heat}${crew.length ? ' · ' + crew[0] : ''}`);
    }
  }

  syncSlots() {
    const zoom = this.cameras.main.zoom;
    const names = zoom >= 0.62;
    const detail = zoom >= 0.88;
    const selected = this.sim.state.selectedSlotId;
    for (const [id, node] of Object.entries(this.slots)) {
      const state = this.sim.state.slots[id];
      if (!state) continue;
      node.select.setVisible(id === selected);
      node.raid.setVisible(!!state.raidLocked);
      if (state.raidLocked) node.raid.setAlpha(0.45 + Math.sin(this.phase * 6) * 0.35);
      const key = `${state.buildingId || 'empty'}:${state.rivalControlled ? 1 : 0}:${state.level}`;
      if (key !== node.key) {
        node.key = key;
        this.paintSite(node.art, state);
      }
      const built = !!state.buildingId && !state.rivalControlled;
      node.barBg.setVisible(detail && built);
      node.bar.setVisible(detail && built);
      node.nameBg.setVisible(names);
      node.name.setVisible(names);
      node.stockBg.setVisible(detail && (built || state.rivalControlled));
      node.stock.setVisible(detail && (built || state.rivalControlled));
      if (built) {
        const def = BUILDINGS[state.buildingId];
        node.bar.width = Math.max(4, Math.min(70, state.progress * 70));
        node.bar.fillColor = state.raidLocked ? 0xf85149 : (def.accentColor || 0x7dcea0);
        node.name.setText(def.shortName);
        node.name.setColor('#f6f1e7');
        node.stock.setText(this.stockLine(state, def));
        node.stock.setColor(state.raidLocked ? '#ffb4ae' : '#d5deea');
        if (detail && (state.buildingId === 'drying_barn' || state.buildingId === 'chem_lab' || state.buildingId === 'packaging_mill' || state.buildingId === 'coffee_estate')) {
          if (Math.random() < 0.15) this.puff(node.def.x + 18, node.def.y - 36);
        }
      } else if (state.rivalControlled) {
        node.name.setText('Los Lobos');
        node.name.setColor('#ffb4ae');
        node.stock.setText('Hostile gate');
        node.stock.setColor('#f85149');
      } else {
        node.name.setText(names && detail ? node.def.label : '');
        node.name.setColor('#e7dcc6');
        node.barBg.setVisible(false);
        node.bar.setVisible(false);
      }
    }
  }

  stockLine(state, def) {
    if (state.raidLocked) return 'Raid lockdown';
    if (def.role === 'launderer') return `Launders $${def.launderPerCycle}/cycle`;
    const out = Object.entries(state.outputBuffer).find(([, q]) => q > 0);
    const inn = Object.entries(state.inputBuffer).find(([, q]) => q > 0);
    if (out) return `${out[1]} ${GOODS[out[0]]?.shortName || out[0]}`;
    if (inn) return `In ${inn[1]} ${GOODS[inn[0]]?.shortName || inn[0]}`;
    if (def.trucksProvided) return `+${def.trucksProvided} trucks`;
    return 'Working';
  }

  paintSite(g, state) {
    g.clear();
    if (state.rivalControlled) {
      this.drawRival(g);
      return;
    }
    if (!state.buildingId) {
      this.drawPlot(g);
      return;
    }
    g.fillStyle(0x10140c, 0.38);
    g.fillEllipse(6, 18, 124, 40);
    const id = state.buildingId;
    if (id === 'plantation') this.drawPlantation(g);
    else if (id === 'coffee_estate') this.drawCoffee(g);
    else if (id === 'highland_farm') this.drawHighland(g);
    else if (id === 'drying_barn') this.drawBarn(g);
    else if (id === 'packaging_mill') this.drawMill(g);
    else if (id === 'chem_lab') this.drawLab(g);
    else if (id === 'warehouse') this.drawWarehouse(g);
    else if (id === 'transport_depot') this.drawDepot(g);
    else if (id === 'river_pier') this.drawPier(g);
    else if (id === 'aerodrome') this.drawStrip(g);
    else if (id === 'taxi_co') this.drawTaxi(g);
    else if (id === 'salsa_club') this.drawClub(g);
    else if (id === 'banco_regional') this.drawBank(g);
    else this.drawBarn(g);
  }

  drawPlot(g) {
    g.fillStyle(0x6a5438, 0.28);
    g.fillEllipse(0, 10, 78, 40);
    g.lineStyle(1.5, 0xe6d3ae, 0.45);
    const steps = 24;
    for (let i = 0; i < steps; i += 2) {
      g.beginPath();
      g.arc(0, 10, 34, (i / steps) * Math.PI * 2, ((i + 0.85) / steps) * Math.PI * 2, false);
      g.strokePath();
    }
  }

  wall(g, x, y, w, h, wall, roof) {
    g.fillStyle(wall, 1);
    g.fillRect(x, y, w, h);
    g.fillStyle(roof, 1);
    g.fillRect(x - 3, y - 10, w + 6, 12);
    g.fillStyle(0x000000, 0.18);
    g.fillRect(x + w - 7, y, 7, h);
  }

  drawPlantation(g) {
    g.fillStyle(0x5a4630, 1);
    g.fillRoundedRect(-48, -8, 62, 36, 3);
    g.fillStyle(0x3f6b32, 1);
    for (let i = 0; i < 4; i++) g.fillRect(-44, -4 + i * 8, 54, 5);
    g.fillStyle(0x7dcea0, 0.9);
    for (let i = 0; i < 4; i++) g.fillRect(-42, -4 + i * 8, 50, 2);
    this.wall(g, 16, -16, 28, 26, 0xe6d3b0, 0x8c4a32);
    g.fillStyle(0x6a3a28, 1);
    g.fillRect(26, -2, 6, 12);
  }

  drawCoffee(g) {
    g.fillStyle(0x4a6a32, 1);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) g.fillCircle(-40 + c * 14, -6 + r * 12, 5);
    }
    g.fillStyle(0xc4a574, 1);
    g.fillRect(-46, 18, 40, 4);
    g.fillRect(-46, 24, 40, 4);
    this.wall(g, 16, -18, 32, 30, 0xf0e2c4, 0x9a5a32);
    g.fillStyle(0x6e8f4e, 1);
    g.fillRect(20, -28, 24, 8);
  }

  drawHighland(g) {
    const bands = [[-46, 16, 90, 0x6d6248], [-40, 2, 78, 0x5f7a3e], [-34, -12, 66, 0x7d9a4e]];
    for (const [x, y, w, color] of bands) {
      g.fillStyle(0x3a3228, 1);
      g.fillRect(x, y + 8, w, 6);
      g.fillStyle(color, 1);
      g.fillRect(x, y, w, 8);
    }
    g.fillStyle(0xcbb892, 1);
    g.fillRect(28, -24, 16, 18);
    g.fillStyle(0x8c4a32, 1);
    g.fillRect(26, -30, 20, 7);
  }

  drawBarn(g) {
    this.wall(g, -46, -8, 92, 32, 0xd7c4a2, 0x8d4630);
    g.fillStyle(0x6e3424, 1);
    g.fillTriangle(-49, -8, 0, -34, 49, -8);
    g.fillStyle(0x4a4034, 1);
    g.fillRect(18, -40, 8, 18);
    g.fillStyle(0x2a241c, 1);
    g.fillRect(-8, 6, 14, 18);
    g.fillStyle(0xc4a06a, 1);
    g.fillRect(-40, 16, 14, 10);
    g.fillRect(-24, 18, 12, 8);
  }

  drawMill(g) {
    this.wall(g, -20, -6, 64, 30, 0xd9cbb0, 0x7a5344);
    g.fillStyle(0xb7b1a4, 1);
    g.fillCircle(28, -16, 12);
    g.fillRect(22, -8, 12, 22);
    g.fillStyle(0x8c4a32, 1);
    g.fillRect(-46, 4, 24, 16);
    g.fillStyle(0x5a4632, 1);
    g.fillRect(-18, 8, 16, 4);
  }

  drawLab(g) {
    this.wall(g, -40, -4, 70, 28, 0xd5d2c8, 0x3e626c);
    g.fillStyle(0x8fd0d8, 0.95);
    g.fillRect(-30, 2, 12, 8);
    g.fillRect(-12, 2, 12, 8);
    g.fillStyle(0x6aa8b0, 1);
    g.fillCircle(36, -2, 9);
    g.fillCircle(50, 2, 7);
    g.fillStyle(0x2c3e44, 1);
    g.fillRect(8, -22, 6, 16);
  }

  drawWarehouse(g) {
    this.wall(g, -50, -10, 46, 34, 0xcfc6b4, 0x5c656e);
    this.wall(g, 2, -10, 46, 34, 0xcfc6b4, 0x5c656e);
    g.fillStyle(0x3a4250, 0.9);
    g.fillRect(-40, 6, 26, 14);
    g.fillRect(12, 6, 26, 14);
    this.miniTruck(g, -16, 28, 0xc47a4a);
    this.miniTruck(g, 24, 30, 0x4d6a8a);
  }

  drawDepot(g) {
    this.wall(g, -46, -14, 88, 28, 0xd2c8b2, 0x4d5966);
    g.fillStyle(0x2c3440, 1);
    g.fillRect(-38, 0, 20, 14);
    g.fillRect(-12, 0, 20, 14);
    g.fillRect(14, 0, 20, 14);
    this.miniTruck(g, -20, 26, 0xd7c4a2);
    this.miniTruck(g, 8, 28, 0x7aa2c4);
    this.miniTruck(g, 32, 24, 0xc47a4a);
  }

  miniTruck(g, x, y, color) {
    g.fillStyle(color, 1);
    g.fillRect(x, y, 16, 8);
    g.fillStyle(0xe8eef4, 1);
    g.fillRect(x + 12, y + 1, 6, 6);
    g.fillStyle(0x1c140e, 1);
    g.fillCircle(x + 4, y + 8, 2);
    g.fillCircle(x + 13, y + 8, 2);
  }

  drawPier(g) {
    g.fillStyle(0x1d4a5c, 0.95);
    g.fillRoundedRect(-54, -6, 108, 40, 6);
    g.fillStyle(0x8d6a42, 1);
    g.fillRect(-8, -28, 16, 62);
    g.lineStyle(2, 0xcbb892, 0.7);
    for (let i = -24; i <= 24; i += 8) g.lineBetween(-8, i, 8, i);
    g.fillStyle(0xc4553a, 1);
    g.fillEllipse(-30, 8, 26, 10);
    g.fillStyle(0xe8eef4, 1);
    g.fillEllipse(30, 14, 22, 9);
    this.wall(g, -46, -30, 22, 16, 0xe6d3b0, 0x8c4a32);
  }

  drawStrip(g) {
    g.fillStyle(0x2c343c, 1);
    g.fillRect(-58, 0, 116, 16);
    g.fillStyle(0xe8eef4, 0.9);
    for (let x = -46; x <= 40; x += 16) g.fillRect(x, 6, 8, 3);
    this.wall(g, -50, -28, 34, 22, 0xd7c4a2, 0x3e626c);
    g.fillStyle(0xd7e2ea, 1);
    g.fillTriangle(20, -6, 48, 2, 20, 10);
    g.fillRect(8, -2, 16, 6);
  }

  drawTaxi(g) {
    this.wall(g, -18, -20, 48, 28, 0xf0e2c4, 0x3d5c7a);
    g.fillStyle(0x8ec5ff, 0.9);
    g.fillRect(-8, -8, 28, 6);
    const cabs = [[-46, 8], [-22, 14], [28, 10]];
    cabs.forEach(([x, y], i) => this.miniTruck(g, x, y, i === 1 ? 0xf0d36a : 0xe8eef4));
  }

  drawClub(g) {
    this.wall(g, -40, -8, 80, 30, 0x2a2430, 0x6e3458);
    g.fillStyle(0xbc8cff, 0.95);
    g.fillRect(-28, -2, 56, 8);
    g.fillStyle(0xf0d36a, 0.9);
    g.fillCircle(-8, 8, 3);
    g.fillCircle(8, 8, 3);
    g.fillStyle(0xe8eef4, 1);
    g.fillRect(-6, 8, 12, 14);
  }

  drawBank(g) {
    g.fillStyle(0xcfc6b4, 1);
    g.fillRect(-40, -2, 80, 28);
    g.fillStyle(0x8ea0b0, 1);
    g.fillTriangle(-46, -2, 0, -28, 46, -2);
    g.fillStyle(0xf4efe4, 1);
    for (let i = 0; i < 4; i++) g.fillRect(-30 + i * 16, 2, 6, 22);
    g.fillStyle(0x1d4a5c, 1);
    g.fillRect(-8, 8, 16, 18);
  }

  drawRival(g) {
    g.fillStyle(0x10140c, 0.4);
    g.fillEllipse(4, 16, 110, 36);
    g.fillStyle(0x6a4038, 1);
    g.fillRect(-36, -8, 72, 28);
    g.fillStyle(0x4a2c28, 1);
    g.fillRect(-40, -28, 16, 28);
    g.fillRect(24, -32, 16, 32);
    g.lineStyle(2, 0xf85149, 0.9);
    g.strokeRect(-36, -8, 72, 28);
    g.fillStyle(0xf85149, 1);
    g.fillTriangle(32, -32, 32, -18, 46, -26);
  }

  syncTrucks() {
    const live = new Set();
    this.flow.clear();
    for (const truck of this.sim.state.activeTrucks) {
      live.add(truck.id);
      const good = GOODS[truck.goodId];
      const color = good ? good.color : 0xd7c4a2;
      if (truck.path && truck.path.length) {
        this.flow.lineStyle(2, color, 0.28);
        this.flow.lineBetween(truck.x, truck.y, truck.path[Math.min(truck.pathIndex, truck.path.length - 1)].x, truck.path[Math.min(truck.pathIndex, truck.path.length - 1)].y);
      }
      let node = this.trucks[truck.id];
      if (!node) {
        const root = this.add.container(truck.x, truck.y).setDepth(8);
        const body = this.add.rectangle(0, 0, 18, 10, color).setStrokeStyle(1, 0x1c140e);
        const cab = this.add.rectangle(10, 0, 7, 8, 0xe8eef4).setStrokeStyle(1, 0x1c140e);
        const label = this.add.text(0, -14, '', {
          fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#f6f1e7',
          backgroundColor: '#10140fe6', padding: { x: 3, y: 1 }
        }).setOrigin(0.5).setResolution(2);
        root.add([body, cab, label]);
        node = { root, body, cab, label };
        this.trucks[truck.id] = node;
      }
      node.root.setPosition(truck.x, truck.y);
      const angle = truck.heading || 0;
      node.body.setRotation(angle);
      node.cab.setRotation(angle);
      node.cab.setPosition(Math.cos(angle) * 10, Math.sin(angle) * 10);
      node.label.setText(`${truck.qty} ${good ? good.shortName : ''}`);
      node.label.setVisible(this.cameras.main.zoom >= 0.8);
    }
    for (const [id, node] of Object.entries(this.trucks)) {
      if (!live.has(Number(id))) {
        node.root.destroy();
        delete this.trucks[id];
      }
    }
  }

  puff(x, y) {
    if (this.smoke.length > 48) return;
    this.smoke.push({ x, y, life: 1, r: 3 + Math.random() * 3 });
  }

  syncLife(dt) {
    const g = this.life;
    g.clear();
    // Water highlights
    g.fillStyle(0x8fd0e0, 0.35);
    for (let i = 0; i < RIVER.length - 1; i++) {
      const a = RIVER[i];
      const b = RIVER[i + 1];
      const t = (this.phase * 0.25 + i * 0.17) % 1;
      g.fillCircle(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 3);
    }
    // Boats
    for (const boat of this.boats) {
      if (boat.cargo) {
        const pier = this.sim.state.slots.slot_rp_pier;
        if (!pier || pier.buildingId !== 'river_pier') continue;
      }
      boat.at = (boat.at + boat.speed * dt) % 1;
      const p = this.along(boat.path, boat.at);
      g.fillStyle(boat.cargo ? 0xc4553a : 0xe8eef4, 1);
      g.fillEllipse(p.x, p.y, boat.cargo ? 18 : 14, 7);
      g.fillStyle(0x2a241c, 0.8);
      g.fillEllipse(p.x, p.y + 4, 12, 3);
    }
    // Plane once pilots are researched and the strip exists
    const strip = Object.values(this.sim.state.slots).find((s) => s.buildingId === 'aerodrome');
    if (strip && this.sim.state.research.pilots) {
      this.plane.angle += dt * 0.6;
      const def = BUILD_SLOTS.find((s) => s.id === strip.slotId);
      this.plane.x = def.x + Math.cos(this.plane.angle) * 70;
      this.plane.y = def.y + Math.sin(this.plane.angle) * 36;
      g.fillStyle(0xd7e2ea, 1);
      g.fillTriangle(this.plane.x, this.plane.y, this.plane.x + 16, this.plane.y + 4, this.plane.x + 4, this.plane.y + 8);
    }
    // Workers on plantations
    for (const slot of Object.values(this.sim.state.slots)) {
      if (slot.buildingId !== 'plantation' && slot.buildingId !== 'coffee_estate') continue;
      const def = BUILD_SLOTS.find((s) => s.id === slot.slotId);
      for (let i = 0; i < 2; i++) {
        const a = this.phase * 0.8 + i * 2;
        g.fillStyle(0xf0d8b0, 1);
        g.fillCircle(def.x - 20 + Math.cos(a) * 16, def.y + 6 + Math.sin(a) * 8, 2.4);
      }
    }
    this.smoke = this.smoke.filter((p) => {
      p.y -= 18 * dt;
      p.life -= dt * 0.6;
      if (p.life <= 0) return false;
      g.fillStyle(0xd7d2c8, Math.max(0, p.life) * 0.45);
      g.fillCircle(p.x, p.y, p.r + (1 - p.life) * 4);
      return true;
    });
    if (this.sim.state.weather === 'rain') {
      g.lineStyle(1, 0xc5d4e0, 0.35);
      for (let i = 0; i < 70; i++) {
        const x = (i * 97 + this.phase * 240) % WORLD_W;
        const y = (i * 53 + this.phase * 520) % WORLD_H;
        g.lineBetween(x, y, x - 3, y + 10);
      }
    }
  }

  along(path, t) {
    const seg = (path.length - 1) * t;
    const i = Math.min(path.length - 2, Math.floor(seg));
    const f = seg - i;
    return {
      x: path[i][0] + (path[i + 1][0] - path[i][0]) * f,
      y: path[i][1] + (path[i + 1][1] - path[i][1]) * f
    };
  }

  syncSky() {
    const t = this.sim.state.timeOfDay ?? 0.4;
    let color = 0xffe2b0;
    let alpha = 0.04;
    if (t < 0.18) { color = 0xffb37a; alpha = 0.12; }
    else if (t < 0.62) { color = 0xfff1d2; alpha = 0.04; }
    else if (t < 0.78) { color = 0xe07a4a; alpha = 0.16; }
    else { color = 0x1a2744; alpha = 0.4; }
    if (this.sim.state.weather === 'fog') alpha += 0.08;
    if (this.sim.state.weather === 'rain') { color = 0x243044; alpha = Math.max(alpha, 0.18); }
    this.sky.clear();
    this.sky.fillStyle(color, alpha);
    this.sky.fillRect(0, 0, WORLD_W, WORLD_H);
  }

  syncFloaters(dt) {
    this.floaters = this.floaters.filter((f) => {
      f.y -= 28 * dt;
      f.life -= dt;
      f.node.setPosition(f.x, f.y);
      f.node.setAlpha(Math.max(0, f.life));
      if (f.life <= 0) {
        f.node.destroy();
        return false;
      }
      return true;
    });
  }

  fx(evt) {
    if (!evt) return;
    if (evt.type === 'exported' || evt.type === 'laundered') {
      const id = evt.slotId;
      const def = BUILD_SLOTS.find((s) => s.id === id);
      if (!def) return;
      const text = evt.type === 'exported'
        ? `+$${evt.earnedDirty || evt.earnedClean || 0}`
        : `+$${evt.cleanEarned || 0} clean`;
      const node = this.add.text(def.x, def.y - 20, text, {
        fontFamily: 'Outfit, sans-serif', fontSize: '16px', fontStyle: '700',
        color: evt.type === 'laundered' ? '#8ec5ff' : '#7dcea0'
      }).setOrigin(0.5).setDepth(20);
      this.floaters.push({ node, x: def.x, y: def.y - 20, life: 1.1 });
    }
    if (evt.type === 'raid_started') this.cameras.main.shake(280, 0.004);
    if (evt.type === 'truck_delivered') {
      const def = BUILD_SLOTS.find((s) => s.id === evt.truck.toSlotId);
      if (def) this.puff(def.x, def.y);
    }
  }
}
