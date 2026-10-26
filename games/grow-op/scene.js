// Grow Op: San Verde '84 — top-down regional world.
// Terrain, 3/4 buildings, road-following trucks, weather, and label LOD.

import { GOODS } from './data/goods.js';
import { BUILDINGS } from './data/buildings.js';
import { REGIONS, BUILD_SLOTS, ROAD_NETWORK, LIEUTENANTS } from './data/missions.js';
import { WORLD_W, WORLD_H, RIVER, HARBOR, drawWorld, drawFog, paintStructure, drawMiniTruck } from './art.js';

const PLATES = {
  rio_plata: { x: 200, y: 340, title: 'RÍO PLATA VALLEY', sub: 'Puerto Plata' },
  san_marco: { x: 980, y: 340, title: 'SAN MARCO DISTRICT', sub: 'Ciudad San Marco' },
  sierra_alta: { x: 1680, y: 340, title: 'SIERRA ALTA', sub: 'Villa Dorada' }
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
    drawWorld(this.terrain, ROAD_NETWORK);
  }

  drawHatch() {
    drawFog(this.hatch, REGIONS);
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
      const hit = this.add.ellipse(0, 10, 210, 130, 0x000000, 0.001);
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        if (this.dragMoved) return;
        this.sim.state.selectedSlotId = def.id;
        this.sim.state.selectedRegionId = def.regionId;
        this.onSlotSelected(def.id);
      });
      const select = this.add.ellipse(0, 12, 230, 140, 0x8ec5ff, 0.06).setStrokeStyle(2, 0x8ec5ff, 0.85).setVisible(false);
      const raid = this.add.ellipse(0, 12, 240, 150, 0xf85149, 0.1).setStrokeStyle(3, 0xf85149, 0.9).setVisible(false);
      const art = this.add.graphics();
      const pulse = this.add.ellipse(0, 18, 170, 78).setStrokeStyle(3, 0x8ec5ff, 1).setVisible(false);
      const label = this.add.container(def.x, def.y - 120).setDepth(18);
      const plate = this.add.graphics();
      const font = 'Outfit, Inter, sans-serif';
      const name = this.add.text(0, 0, '', {
        fontFamily: font, fontSize: '13px', fontStyle: '700', color: '#f6f1e7'
      }).setOrigin(0.5).setResolution(2);
      const stock = this.add.text(0, 0, '', {
        fontFamily: font, fontSize: '11px', color: '#c5d0dc'
      }).setOrigin(0.5).setResolution(2);
      label.add([plate, name, stock]);
      root.add([pulse, select, raid, hit, art]);
      root.setDepth(4);
      this.slots[def.id] = { def, root, hit, select, raid, art, pulse, label, plate, name, stock, key: '' };
    }
  }

  spawnAmbientCraft() {
    this.boats = [
      { path: RIVER, at: 0.2, speed: 0.018, cargo: false },
      { path: RIVER, at: 0.55, speed: 0.012, cargo: true },
      { path: HARBOR, at: 0.4, speed: 0.02, cargo: true }
    ];
    this.traffic = [
      { at: 0.12, speed: 0.025, color: 0xc47a4a },
      { at: 0.4, speed: 0.018, color: 0x4d6a8a },
      { at: 0.7, speed: -0.02, color: 0xf4f7fb }
    ];
    this.plane = { angle: 0.4 };
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
          const zoom = window.Phaser.Math.Clamp(this.cameras.main.zoom + (d - this.pinch) * 0.003, 0.35, 2.8);
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
      this.cameras.main.setZoom(window.Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.0008, 0.35, 2.8));
    });
    this.cursors = this.input.keyboard ? this.input.keyboard.createCursorKeys() : null;
  }

  valleyZoom() {
    const vw = this.scale.width;
    const vh = this.scale.height;
    const top = vw < 700 ? 176 : 156;
    const bottom = 84;
    const zoom = Math.min((vw - 28) / 640, (vh - top - bottom) / 820);
    return window.Phaser.Math.Clamp(zoom * 0.98, 0.48, 1.2);
  }

  frameValley(instant) {
    const cam = this.cameras.main;
    const zoom = this.valleyZoom();
    cam.setZoom(zoom);
    const topInset = this.scale.width < 700 ? 188 : 164;
    const viewY = 300 - topInset / zoom;
    const focus = { x: 470, y: viewY + (this.scale.height / zoom) / 2 };
    if (instant) cam.centerOn(focus.x, focus.y);
    else cam.pan(focus.x, focus.y, 420, 'Sine.easeInOut');
  }

  frameClose(instant) {
    this.userPanned = true;
    const cam = this.cameras.main;
    const zoom = this.scale.width < 520 ? 1.65 : this.scale.width < 900 ? 1.45 : 2.15;
    cam.setZoom(zoom);
    if (instant) cam.centerOn(460, 560);
    else cam.pan(460, 560, 360, 'Sine.easeInOut');
  }

  frameOverview() {
    this.userPanned = true;
    const cam = this.cameras.main;
    const zoom = Math.min(this.scale.width / 2500, this.scale.height / 1200);
    cam.setZoom(window.Phaser.Math.Clamp(zoom, 0.32, 0.9));
    cam.pan(1260, 700, 480, 'Sine.easeInOut');
  }

  focusOnSlot(slotId, instant = false) {
    const def = BUILD_SLOTS.find((s) => s.id === slotId);
    if (!def) return;
    this.userPanned = true;
    const cam = this.cameras.main;
    const zoom = this.scale.width < 520 ? 1.05 : this.scale.width < 900 ? 1.15 : 1.7;
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
      const spot = this.worldToScreen(plate.bg.x, plate.bg.y);
      const clear = !this.underHud(spot.x, spot.y, 120, 28);
      plate.bg.setVisible(clear);
      plate.title.setVisible(clear);
      plate.sub.setVisible(clear);
    }
  }

  worldToScreen(x, y) {
    const view = this.cameras.main.worldView;
    const zoom = this.cameras.main.zoom;
    return { x: (x - view.x) * zoom, y: (y - view.y) * zoom };
  }

  underHud(sx, sy, hw, hh) {
    const w = this.scale.width;
    const h = this.scale.height;
    const top = w < 700 ? 168 : 72;
    if (sy - hh < top) return true;
    if (sy + hh > h - 78) return true;
    const objBottom = top + (w < 700 ? 78 : 132);
    if (sx - hw < 400 && sy - hh < objBottom) return true;
    return false;
  }

  syncSlots() {
    const zoom = this.cameras.main.zoom;
    const rel = zoom / this.valleyZoom();
    const names = rel >= 0.82;
    const detail = rel >= 0.92;
    const selected = this.sim.state.selectedSlotId;
    const recommend = this.recommendedSlot();
    for (const [id, node] of Object.entries(this.slots)) {
      const state = this.sim.state.slots[id];
      if (!state) continue;
      node.select.setVisible(id === selected);
      node.raid.setVisible(!!state.raidLocked);
      if (state.raidLocked) node.raid.setAlpha(0.45 + Math.sin(this.phase * 6) * 0.35);
      const built = !!state.buildingId && !state.rivalControlled;
      node.pulse.setVisible(!built && !state.rivalControlled && id === recommend);
      if (node.pulse.visible) node.pulse.setAlpha(0.25 + Math.sin(this.phase * 3) * 0.35);
      const key = `${state.buildingId || 'empty'}:${state.rivalControlled ? 1 : 0}:${state.level}`;
      if (key !== node.key) {
        node.key = key;
        this.paintSite(node.art, state);
      }
      if (built) {
        const def = BUILDINGS[state.buildingId];
        this.placeLabel(node, def.shortName, this.stockLine(state, def), names, detail, state.progress, state.raidLocked ? 0xf85149 : 0x7dcea0);
        node.name.setColor(state.raidLocked ? '#ffb4ae' : '#f6f1e7');
        if (state.buildingId === 'drying_barn' || state.buildingId === 'chem_lab' || state.buildingId === 'packaging_mill' || state.buildingId === 'coffee_estate') {
          if (Math.random() < 0.12) this.puff(node.def.x + 30, node.def.y - 70);
        }
      } else if (state.rivalControlled) {
        this.placeLabel(node, 'Los Lobos', 'Hostile gate', names, detail, 0, 0xf85149);
        node.name.setColor('#ffb4ae');
        node.stock.setColor('#ffb4ae');
      } else if (id === recommend) {
        this.placeLabel(node, 'Open plot', '', names, false, 0, 0x8ec5ff);
        node.name.setColor('#d5e4f5');
      } else {
        node.label.setVisible(false);
      }
    }
  }

  recommendedSlot() {
    const st = this.sim.state;
    if (!st.tutorialDone && st.tutorialStep === 0) return 'slot_rp_town1';
    const empty = Object.values(st.slots).find((s) => !s.buildingId && !s.rivalControlled && st.regions[s.regionId] && st.regions[s.regionId].unlocked);
    return empty ? empty.slotId : null;
  }

  placeLabel(node, title, stock, showName, showStock, progress, barColor) {
    if (!showName) {
      node.label.setVisible(false);
      return;
    }
    const cam = this.cameras.main;
    const scale = Math.min(1.45, Math.max(0.62, 1 / cam.zoom));
    node.label.setScale(scale);
    node.name.setText(title);
    const status = showStock && stock ? stock : '';
    node.stock.setText(status);
    node.stock.setVisible(!!status);
    const nameW = Math.ceil(node.name.width);
    const stockW = status ? Math.ceil(node.stock.width) : 0;
    const w = Math.max(108, nameW + 22, stockW + 22);
    const h = 22 + (status ? 18 : 0) + (showStock ? 12 : 0);
    node.plate.clear();
    node.plate.fillStyle(0x12161c, 0.94);
    node.plate.fillRoundedRect(-w / 2, -h / 2, w, h, 9);
    node.plate.lineStyle(1, 0x3d4c63, 1);
    node.plate.strokeRoundedRect(-w / 2, -h / 2, w, h, 9);
    node.name.setPosition(0, -h / 2 + 13);
    node.stock.setPosition(0, -h / 2 + 30);
    node.stock.setColor('#c5d0dc');
    if (showStock) {
      const bw = w - 16;
      const bx = -bw / 2;
      const by = h / 2 - 8;
      node.plate.fillStyle(0x2a3344, 1);
      node.plate.fillRoundedRect(bx, by, bw, 4, 2);
      node.plate.fillStyle(barColor || 0x7dcea0, 1);
      node.plate.fillRoundedRect(bx, by, Math.max(4, bw * Math.max(0, Math.min(1, progress || 0))), 4, 2);
    }
    const y = node.def.y - 118;
    const spot = this.worldToScreen(node.def.x, y);
    const blocked = this.underHud(spot.x, spot.y, (w * scale) / 2, (h * scale) / 2);
    node.label.setVisible(!blocked);
    node.label.setPosition(node.def.x, y);
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
    paintStructure(g, state.buildingId, state.rivalControlled);
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
      node.label.setVisible(this.cameras.main.zoom > 0.85 && this.cameras.main.zoom < 1.45);
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
      boat.at = (boat.at + boat.speed * dt) % 1;
      if (boat.at < 0) boat.at += 1;
      const p = this.along(boat.path, boat.at);
      const bob = Math.sin(this.phase * 2 + boat.at * 8) * 2;
      g.fillStyle(boat.cargo ? 0xc4553a : 0xe8eef4, 1);
      g.fillEllipse(p.x, p.y + bob, boat.cargo ? 36 : 26, 12);
      g.fillStyle(0x2a3440, 1);
      g.fillRect(p.x - 4, p.y - 10 + bob, 12, 8);
    }
    const road = ROAD_NETWORK[0];
    for (const van of this.traffic) {
      van.at = (van.at + van.speed * dt) % 1;
      if (van.at < 0) van.at += 1;
      const p = this.along(road.map((pt) => [pt.x, pt.y]), van.at);
      drawMiniTruck(g, p.x, p.y, van.color);
    }
    this.plane.angle += dt * 0.45;
    const strip = BUILD_SLOTS.find((s) => s.id === 'slot_sa_airstrip');
    const px = strip.x + Math.cos(this.plane.angle) * 90;
    const py = strip.y - 40 + Math.sin(this.plane.angle) * 36;
    g.fillStyle(0xd5e4ee, 1);
    g.fillEllipse(px, py, 28, 10);
    g.fillTriangle(px + 8, py, px + 26, py - 12, px + 26, py + 12);
    for (const slot of Object.values(this.sim.state.slots)) {
      if (!slot.buildingId || slot.raidLocked) continue;
      const def = BUILD_SLOTS.find((s) => s.id === slot.slotId);
      if (slot.buildingId === 'plantation' || slot.buildingId === 'coffee_estate' || slot.buildingId === 'highland_farm') {
        for (let i = 0; i < 3; i++) {
          const t = (this.phase * 0.15 + i * 0.33) % 1;
          const wx = def.x - 70 + t * 120;
          const wy = def.y - 10 + (i - 1) * 16 + Math.sin(this.phase * 3 + i) * 2;
          g.fillStyle(0xf0d8b0, 1);
          g.fillCircle(wx, wy - 4, 3);
          g.fillStyle(i === 1 ? 0x3d5c7a : 0x8c4030, 1);
          g.fillRect(wx - 2, wy, 4, 6);
        }
      }
      if (slot.buildingId === 'salsa_club') {
        g.fillStyle(0xbc8cff, 0.35 + Math.sin(this.phase * 4) * 0.25);
        g.fillRect(def.x - 70, def.y - 8, 140, 8);
      }
      if (slot.buildingId === 'drying_barn') {
        const spin = this.phase * 3;
        g.lineStyle(2, 0x6b4428, 0.7);
        g.lineBetween(def.x + 20, def.y - 20, def.x + 20 + Math.cos(spin) * 14, def.y - 20 + Math.sin(spin) * 6);
      }
    }
    const hour = this.sim.state.timeOfDay || 0;
    if (hour > 0.72 || hour < 0.18) {
      g.fillStyle(0xffd27a, 0.9);
      for (const slot of Object.values(this.sim.state.slots)) {
        if (!slot.buildingId) continue;
        const def = BUILD_SLOTS.find((s) => s.id === slot.slotId);
        g.fillRect(def.x + 18, def.y - 28, 8, 6);
        g.fillRect(def.x + 34, def.y - 28, 8, 6);
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
    if (evt.type === 'raid_started' || evt.type === 'rival_raid') this.cameras.main.shake(280, 0.004);
    if (evt.type === 'truck_delivered') {
      const def = BUILD_SLOTS.find((s) => s.id === evt.truck.toSlotId);
      if (def) this.puff(def.x, def.y);
    }
  }
}
