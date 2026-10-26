// Grow Op: San Verde '84 — map, labels, camera, and onboarding chrome.
//
// Hooks for the other Grow Op branches (do not fold their files in here):
//   art.js      drawWorld, drawFog, drawMiniTruck, paintStructure.
//               If it also exports textureKey(ctx) and drawKeyed(g, key, ctx),
//               structures go through that path. ctx is
//               { buildingId, rival, level, night, progress, slotId }.
//   simulation  recommendedSlot() and observeFrame(dt) are called when present.
//   audio/juice registry key onJuice(evt) runs after the visual fx() below.
//   registry key juice, when present, is the cashPop / shake / pulseBuilding / burst / step bag.
//   simulation  gameplayView() is the map catalog. Actions are unlockZone,
//               buyAndConvert, buyLot, startDemolish, buildNew, buildOnPlot,
//               negotiate, intimidate. Lots with a slotId stay on BUILD_SLOTS.

import { GOODS } from './data/goods.js';
import { BUILDINGS } from './data/buildings.js';
import { REGIONS, BUILD_SLOTS, ROAD_NETWORK, LIEUTENANTS } from './data/missions.js';
import { LOT_POS, MAP_H, MAP_W, ZONE_LAYOUT, zoneCenter } from './map-layout.js';
import { drawExtended, paintOpen, paintProperty, paintRubble, paintScaffold } from './map-draw.js';
import * as Art from './art.js';

const { WORLD_W, WORLD_H, RIVER, HARBOR } = Art;

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
    this.didReveal = false;
    this.holdMapReveal = false;
    this.chartAlpha = 1;
    this.fogAlpha = {};
    this.lots = {};
    this.zoneMarks = {};
  }

  create() {
    this.sim = this.registry.get('sim');
    this.onSlotSelected = this.registry.get('onSlotSelected') || (() => {});
    this.onRegionSelected = this.registry.get('onRegionSelected') || (() => {});
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setBackgroundColor('#2c3824');

    this.coast = this.add.graphics().setDepth(0);
    this.terrain = this.add.graphics().setDepth(1);
    this.water = this.add.graphics().setDepth(1);
    this.hatch = this.add.graphics().setDepth(2);
    this.life = this.add.graphics().setDepth(3);
    this.flow = this.add.graphics().setDepth(3);
    this.zoneFog = this.add.graphics().setDepth(6);
    this.sky = this.add.graphics().setDepth(30);
    this.fontsReady = !!(document.fonts && document.fonts.status === 'loaded');
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { this.fontsReady = true; });
    } else {
      this.fontsReady = true;
    }
    this.pinHost = document.getElementById('go-pins');
    this.drawTerrain();
    drawExtended(this.coast);
    this.drawHatch();
    this.createPlates();
    this.createSlots();
    this.createBadges();
    this.createPlacedLots();
    this.createZoneMarks();
    this.spawnAmbientCraft();
    this.bindCamera();
    this.frameValley(true);
    this.scale.on('resize', () => {
      if (!this.userPanned && !(this.sim && this.sim.state.mapOpen)) this.frameValley(true);
    });
  }

  drawTerrain() {
    Art.drawWorld(this.terrain, ROAD_NETWORK);
  }

  drawHatch() {
    Art.drawFog(this.hatch, REGIONS, this.sim.state);
    this.fogKey = this.fogSignature();
  }

  fogSignature() {
    return REGIONS.map((r) => (this.sim.state.regions[r.id] && this.sim.state.regions[r.id].unlocked) ? '1' : '0').join('');
  }

  isNight() {
    const hour = this.sim && this.sim.state ? this.sim.state.timeOfDay || 0 : 0;
    return hour > 0.72 || hour < 0.18;
  }

  createPlates() {
    this.plates = {};
    for (const [id, plate] of Object.entries(PLATES)) {
      const el = document.createElement('div');
      el.className = 'go-plate';
      el.innerHTML = '<strong></strong><span></span>';
      el.hidden = true;
      this.pinHost.appendChild(el);
      this.plates[id] = { el, x: plate.x, y: plate.y, title: plate.title, sub: plate.sub };
    }
  }

  createBadges() {
    for (const reg of REGIONS) {
      if (!reg.unlockCostClean) continue;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'go-badge';
      el.innerHTML = `<strong>Unlock ${reg.name}</strong><span>$${reg.unlockCostClean} clean cash</span>`;
      el.addEventListener('click', () => this.onRegionSelected(reg.id));
      el.hidden = true;
      this.pinHost.appendChild(el);
      this.badges[reg.id] = { el, x: reg.unlockPos.x, y: reg.unlockPos.y };
    }
  }

  createSlots() {
    for (const def of BUILD_SLOTS) {
      const root = this.add.container(def.x, def.y);
      const hit = this.add.ellipse(0, 10, 210, 130, 0x000000, 0.001);
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerup', (pointer) => {
        if (this.dragMoved || this.pointingAtUi(pointer)) return;
        this.sim.state.selectedSlotId = def.id;
        this.sim.state.selectedRegionId = def.regionId;
        this.onSlotSelected(def.id);
      });
      const select = this.add.ellipse(0, 12, 230, 140, 0x8ec5ff, 0.06).setStrokeStyle(2, 0x8ec5ff, 0.85).setVisible(false);
      const raid = this.add.ellipse(0, 12, 240, 150, 0xf85149, 0.1).setStrokeStyle(3, 0xf85149, 0.9).setVisible(false);
      const art = this.add.graphics();
      const pulse = this.add.ellipse(0, 18, 170, 78).setStrokeStyle(3, 0x8ec5ff, 1).setVisible(false);
      const pin = document.createElement('div');
      pin.className = 'go-pin';
      pin.innerHTML = '<strong></strong><span hidden></span><i class="go-pin-bar" hidden><b></b></i>';
      pin.hidden = true;
      this.pinHost.appendChild(pin);
      root.add([pulse, select, raid, hit, art]);
      root.setDepth(4);
      this.slots[def.id] = { def, root, hit, select, raid, art, pulse, pin, key: '' };
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

  pointingAtUi(pointer) {
    const el = document.elementFromPoint(pointer.x, pointer.y);
    if (!el) return false;
    const canvas = document.querySelector('#phaser-mount canvas');
    return !(canvas && (el === canvas || canvas.contains(el)));
  }

  bindCamera() {
    this.input.on('pointerdown', (p) => {
      if (this.pointingAtUi(p)) return;
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
          const zoom = window.Phaser.Math.Clamp(this.cameras.main.zoom + (d - this.pinch) * 0.003, this.minZoom(), 2.8);
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
      this.cameras.main.setZoom(window.Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.0008, this.minZoom(), 2.8));
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
    if (typeof this.sim.observeFrame === 'function') this.sim.observeFrame(dt);
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
    this.syncWorld(dt);
  }

  syncRegions() {
    const fogKey = this.fogSignature();
    if (fogKey !== this.fogKey) {
      this.fogKey = fogKey;
      Art.drawFog(this.hatch, REGIONS, this.sim.state);
    }
    for (const reg of REGIONS) {
      const state = this.sim.state.regions[reg.id];
      const badge = this.badges[reg.id];
      if (badge) {
        badge.el.hidden = !(state && !state.unlocked && this.fontsReady);
        if (!badge.el.hidden) this.placeScreen(badge.el, badge.x, badge.y);
      }
      const plate = this.plates[reg.id];
      if (!plate || !state || !this.fontsReady) {
        if (plate) plate.el.hidden = true;
        continue;
      }
      const crew = LIEUTENANTS.filter((lt) => {
        const row = this.sim.state.lieutenants[lt.id];
        return row && row.hired && row.regionId === reg.id;
      }).map((lt) => lt.name.split(' ')[0]);
      const heat = state.unlocked ? ` · heat ${Math.floor(state.heat)}%` : ' · locked';
      plate.el.querySelector('strong').textContent = plate.title;
      plate.el.querySelector('span').textContent = `${plate.sub}${heat}${crew.length ? ' · ' + crew[0] : ''}`;
      plate.el.hidden = false;
      this.placeScreen(plate.el, plate.x, plate.y);
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
      const lot = this.sim.state.lots && this.sim.state.lots[id];
      const ctx = {
        buildingId: state.buildingId || null,
        rival: !!state.rivalControlled,
        level: state.level || (lot && lot.level) || 1,
        night: this.isNight(),
        progress: state.progress || 0,
        slotId: state.slotId || id,
        phase: lot ? lot.phase : '',
        propertyType: lot ? lot.propertyType : null,
        owned: lot ? !!lot.owned : !!state.buildingId,
        size: lot ? lot.size : null,
        constructLeft: state.constructLeft || (lot && lot.constructLeft) || 0
      };
      const key = typeof Art.textureKey === 'function'
        ? Art.textureKey(ctx)
        : `${state.buildingId || 'empty'}:${state.rivalControlled ? 1 : 0}:${state.level}`;
      if (key !== node.key) {
        node.key = key;
        this.paintSite(node.art, state);
      }
      if (built) {
        const def = BUILDINGS[state.buildingId];
        this.placeLabel(node, def.shortName, this.stockLine(state, def), names, detail, state.progress, state.raidLocked ? '#f85149' : '#7dcea0');
        node.pin.classList.toggle('is-hot', !!state.raidLocked);
        if (state.buildingId === 'drying_barn' || state.buildingId === 'chem_lab' || state.buildingId === 'packaging_mill' || state.buildingId === 'coffee_estate') {
          if (Math.random() < 0.12) this.puff(node.def.x + 30, node.def.y - 70);
        }
      } else if (state.rivalControlled) {
        this.placeLabel(node, 'Los Lobos', 'Hostile gate', names, detail, 0, '#f85149');
        node.pin.classList.add('is-hot');
      } else if (id === recommend) {
        this.placeLabel(node, 'Open plot', '', names, false, 0, '#8ec5ff');
        node.pin.classList.remove('is-hot');
      } else {
        node.pin.hidden = true;
      }
    }
    this.separatePins();
  }

  recommendedSlot() {
    if (this.sim && typeof this.sim.recommendedSlot === 'function') {
      const picked = this.sim.recommendedSlot();
      if (picked) return picked;
    }
    const st = this.sim.state;
    if (!st.tutorialDone && st.tutorialStep === 0) return 'slot_rp_town1';
    const empty = Object.values(st.slots).find((s) => !s.buildingId && !s.rivalControlled && st.regions[s.regionId] && st.regions[s.regionId].unlocked);
    return empty ? empty.slotId : null;
  }

  placeLabel(node, title, stock, showName, showStock, progress, barColor) {
    const el = node.pin;
    if (!showName || !this.fontsReady) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.querySelector('strong').textContent = title;
    const status = el.querySelector('span');
    const line = showStock && stock ? stock : '';
    status.hidden = !line;
    status.textContent = line;
    const bar = el.querySelector('.go-pin-bar');
    bar.hidden = !showStock;
    const fill = bar.querySelector('b');
    fill.style.width = `${Math.round(Math.max(0, Math.min(1, progress || 0)) * 100)}%`;
    fill.style.background = barColor || '#7dcea0';
    this.placeScreen(el, node.def.x, node.def.y - 108);
  }

  placeScreen(el, worldX, worldY) {
    const spot = this.worldToScreen(worldX, worldY);
    const vw = this.scale.width;
    const vh = this.scale.height;
    if (spot.x < -40 || spot.y < -40 || spot.x > vw + 40 || spot.y > vh + 40) {
      el.hidden = true;
      return false;
    }
    el.hidden = false;
    el.style.transform = 'translate(0px, 0px)';
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const hud = document.querySelector('.go-subhud');
    const hudBottom = hud ? hud.getBoundingClientRect().bottom : 0;
    const topLimit = Math.max(vw < 700 ? 168 : 78, hudBottom + 8);
    const bottomLimit = this.bottomLimit(vh);
    let left = spot.x - w / 2;
    let top = spot.y - h;
    left = Math.max(8, Math.min(Math.max(8, vw - w - 8), left));
    top = Math.max(topLimit, Math.min(Math.max(topLimit, bottomLimit - h), top));
    const cleared = this.clearOfChrome(left, top, w, h, topLimit, bottomLimit);
    left = cleared.left;
    top = cleared.top;
    el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    return true;
  }

  separatePins() {
    const els = [...this.pinHost.querySelectorAll('.go-pin, .go-badge, .go-plate')].filter((el) => !el.hidden);
    const overlap = (a, b) => {
      const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      return x > 1 && y > 1;
    };
    for (let pass = 0; pass < 10; pass++) {
      let moved = false;
      const boxes = els.map((el) => ({ el, r: el.getBoundingClientRect() }));
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          if (!overlap(boxes[i].r, boxes[j].r)) continue;
          const lower = boxes[i].r.top >= boxes[j].r.top ? boxes[i] : boxes[j];
          const upper = lower === boxes[i] ? boxes[j] : boxes[i];
          const dy = upper.r.bottom - lower.r.top + 6;
          const match = lower.el.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
          if (!match) continue;
          const x = Number(match[1]);
          let y = Number(match[2]) + dy;
          const vh = this.scale.height;
          const maxY = vh - 86 - lower.r.height;
          if (y > maxY) {
            if (lower.el.classList.contains('go-pin') && lower.el.querySelector('strong').textContent === 'Open plot') {
              lower.el.hidden = true;
            }
            continue;
          }
          lower.el.style.transform = `translate(${x}px, ${Math.round(y)}px)`;
          lower.r = lower.el.getBoundingClientRect();
          moved = true;
        }
      }
      if (!moved) break;
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
    const lot = this.sim.state.lots && state.slotId ? this.sim.state.lots[state.slotId] : null;
    const ctx = {
      buildingId: state.buildingId || null,
      rival: !!state.rivalControlled,
      level: state.level || (lot && lot.level) || 1,
      night: this.isNight(),
      progress: state.progress || 0,
      slotId: state.slotId || null,
      phase: lot ? lot.phase : '',
      propertyType: lot ? lot.propertyType : null,
      owned: lot ? !!lot.owned : !!state.buildingId,
      size: lot ? lot.size : null,
      constructLeft: state.constructLeft || (lot && lot.constructLeft) || 0
    };
    if (typeof Art.textureKey === 'function' && typeof Art.drawKeyed === 'function') {
      Art.drawKeyed(g, Art.textureKey(ctx), ctx);
      return;
    }
    Art.paintStructure(g, state.buildingId, state.rivalControlled);
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
        root.add([body, cab]);
        node = { root, body, cab };
        this.trucks[truck.id] = node;
      }
      node.root.setPosition(truck.x, truck.y);
      const angle = truck.heading || 0;
      node.body.setRotation(angle);
      node.cab.setRotation(angle);
      node.cab.setPosition(Math.cos(angle) * 10, Math.sin(angle) * 10);
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
      Art.drawMiniTruck(g, p.x, p.y, van.color);
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
    if ((hour > 0.72 || hour < 0.18) && typeof Art.textureKey !== 'function') {
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
    if (typeof Art.paintAmbient === 'function') Art.paintAmbient(this, g);
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
    this.sky.fillRect(0, 0, MAP_W, MAP_H);
  }

  syncFloaters(dt) {
    const j = this.registry.get('juice');
    if (j && j.step) {
      j.step(dt);
      return;
    }
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

  minZoom() {
    if (!this.sim || !this.sim.state.mapOpen) return 0.35;
    return this.scale.width < 700 ? 0.34 : 0.2;
  }

  bottomLimit(vh) {
    let limit = vh - 86;
    const panel = document.getElementById('mix-panel');
    if (panel && !panel.hidden) {
      const rect = panel.getBoundingClientRect();
      if (rect.height > 20 && rect.top > this.scale.height * 0.45) limit = Math.min(limit, rect.top - 8);
    }
    return limit;
  }

  chromeObstacles() {
    const boxes = [];
    const panel = document.getElementById('mix-panel');
    if (panel && !panel.hidden) {
      const rect = panel.getBoundingClientRect();
      if (rect.width > 8 && rect.height > 8) boxes.push(rect);
    }
    const toggle = document.getElementById('btn-control');
    if (toggle) {
      const rect = toggle.getBoundingClientRect();
      if (rect.width > 8) boxes.push(rect);
    }
    return boxes;
  }

  clearOfChrome(left, top, w, h, topLimit, bottomLimit) {
    for (const rect of this.chromeObstacles()) {
      const hit = left + w > rect.left && left < rect.right && top + h > rect.top && top < rect.bottom;
      if (!hit) continue;
      const shift = rect.left - w - 8;
      if (shift >= 8) left = shift;
      else {
        const below = rect.bottom + 8;
        if (below + h <= bottomLimit) top = below;
        else top = Math.max(topLimit, rect.top - h - 8);
      }
    }
    return { left, top };
  }

  placeFree(el, worldX, worldY) {
    const spot = this.worldToScreen(worldX, worldY);
    const vw = this.scale.width;
    const vh = this.scale.height;
    el.hidden = false;
    el.style.transform = 'translate(0px, 0px)';
    const w = el.offsetWidth || 80;
    const h = el.offsetHeight || 28;
    const hud = document.querySelector('.go-subhud');
    const hudBottom = hud ? hud.getBoundingClientRect().bottom : 0;
    const topLimit = Math.max(vw < 700 ? 168 : 78, hudBottom + 8);
    const bottomLimit = this.bottomLimit(vh);
    const left = spot.x - w / 2;
    const top = spot.y - h;
    if (left < 8 || top < topLimit || left + w > vw - 8 || top + h > bottomLimit) {
      el.hidden = true;
      return false;
    }
    const cleared = this.clearOfChrome(left, top, w, h, topLimit, bottomLimit);
    if (cleared.left < 8 || cleared.top < topLimit) {
      el.hidden = true;
      return false;
    }
    el.style.transform = `translate(${Math.round(cleared.left)}px, ${Math.round(cleared.top)}px)`;
    return true;
  }

  createPlacedLots() {
    for (const [id, pos] of Object.entries(LOT_POS)) {
      const root = this.add.container(pos.x, pos.y);
      const hit = this.add.ellipse(0, 8, 150, 90, 0x000000, 0.001);
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerup', (pointer) => {
        if (this.dragMoved || this.pointingAtUi(pointer)) return;
        const fn = this.registry.get('onLotSelected');
        if (fn) fn(id);
      });
      const select = this.add.ellipse(0, 10, 168, 100, 0x8ec5ff, 0.08).setStrokeStyle(2, 0x8ec5ff, 0.9).setVisible(false);
      const art = this.add.graphics();
      const pin = document.createElement('div');
      pin.className = 'go-mark';
      pin.innerHTML = '<strong></strong><span></span>';
      pin.hidden = true;
      this.pinHost.appendChild(pin);
      root.add([select, hit, art]);
      root.setDepth(4);
      this.lots[id] = { id, pos, root, hit, select, art, pin, key: '', phase: '', demoMax: 0, buildMax: 0 };
    }
  }

  createZoneMarks() {
    for (const id of Object.keys(ZONE_LAYOUT)) {
      if (id === 'rio_plata') continue;
      const spot = zoneCenter(id);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'go-zone';
      el.innerHTML = '<strong></strong><span></span>';
      el.hidden = true;
      el.addEventListener('click', () => {
        const fn = this.registry.get('onZoneSelected');
        if (fn) fn(id);
      });
      const area = document.createElement('div');
      area.className = 'go-area';
      area.innerHTML = '<strong></strong>';
      area.hidden = true;
      this.pinHost.appendChild(el);
      this.pinHost.appendChild(area);
      this.zoneMarks[id] = { el, area, x: spot.x, y: spot.y };
    }
  }

  applyBounds() {
    const open = this.sim && this.sim.state.mapOpen;
    const cam = this.cameras.main;
    if (open) cam.setBounds(0, 0, MAP_W, MAP_H);
    else cam.setBounds(0, 0, WORLD_W, WORLD_H);
  }

  revealMap() {
    this.userPanned = true;
    this.applyBounds();
    const cam = this.cameras.main;
    const phone = this.scale.width < 800;
    const zoom = phone
      ? 0.58
      : window.Phaser.Math.Clamp(Math.min(this.scale.width / 2800, (this.scale.height - 140) / 1600), 0.48, 0.85);
    const x = phone ? 1900 : 4300;
    const y = phone ? 2050 : 900;
    cam.setZoom(zoom);
    cam.pan(x, y, 1500, 'Sine.easeInOut');
    const fn = this.registry.get('onMapRevealed');
    if (typeof fn === 'function') fn();
  }

  frameLot(lotId, instant = true) {
    const pos = LOT_POS[lotId];
    if (!pos) return;
    this.userPanned = true;
    this.applyBounds();
    const cam = this.cameras.main;
    const zoom = this.scale.width < 700 ? 0.9 : 1.15;
    cam.setZoom(zoom);
    if (instant) cam.centerOn(pos.x, pos.y);
    else cam.pan(pos.x, pos.y, 360, 'Sine.easeInOut');
  }

  frameZone(zoneId, instant = true) {
    const box = ZONE_LAYOUT[zoneId];
    if (!box) return;
    this.userPanned = true;
    this.applyBounds();
    const cam = this.cameras.main;
    const zoom = window.Phaser.Math.Clamp(Math.min(this.scale.width / (box.w + 180), this.scale.height / (box.h + 220)), this.minZoom(), 1.4);
    cam.setZoom(zoom);
    const x = box.x + box.w / 2;
    const y = box.y + box.h / 2;
    if (instant) cam.centerOn(x, y);
    else cam.pan(x, y, 420, 'Sine.easeInOut');
  }

  syncWorld(dt) {
    if (!this.sim || !this.sim.state || !this.sim.state.lots) return;
    const open = !!this.sim.state.mapOpen;
    if (open && !this.didReveal) {
      const modal = document.getElementById('title-modal');
      if (modal && !modal.hidden) return;
      this.didReveal = true;
      this.applyBounds();
      const held = this.holdMapReveal || this.registry.get('holdMapReveal');
      if (!held) this.revealMap();
    } else if (!open) {
      this.applyBounds();
    }
    if (open && this.chartAlpha > 0) this.chartAlpha = Math.max(0, this.chartAlpha - dt / 1.2);
    if (!open) this.chartAlpha = 1;
    const view = this.sim.gameplayView();
    this.syncFog(view);
    this.syncPlacedLots(view);
    this.syncZoneChrome(view);
    this.settleMarks();
  }

  syncFog(view) {
    const g = this.zoneFog;
    if (!g) return;
    g.clear();
    const chart = this.chartAlpha;
    if (chart > 0.02) {
      this.hatchRect(g, 0, 1360, MAP_W, MAP_H - 1360, chart);
      this.hatchRect(g, 2520, 0, MAP_W - 2520, 1360, chart);
    }
    for (const zone of view.zones) {
      const box = ZONE_LAYOUT[zone.id];
      if (!box || zone.id === 'rio_plata') continue;
      const target = zone.unlocked ? 0 : 1;
      const prev = this.fogAlpha[zone.id] == null ? target : this.fogAlpha[zone.id];
      const next = prev + (target - prev) * 0.08;
      this.fogAlpha[zone.id] = Math.abs(next - target) < 0.02 ? target : next;
      if (this.fogAlpha[zone.id] > 0.02 && this.chartAlpha < 0.85) {
        this.hatchRect(g, box.x, box.y, box.w, box.h, this.fogAlpha[zone.id]);
      }
    }
    if (this.registry.get('showControl')) {
      for (const zone of view.zones) {
        if (!zone.unlocked) continue;
        const box = ZONE_LAYOUT[zone.id];
        if (!box) continue;
        g.fillStyle(0x58a6ff, 0.14);
        g.fillRect(box.x, box.y, box.w, box.h);
      }
    }
  }

  hatchRect(g, x, y, w, h, alpha) {
    g.fillStyle(0x121812, 0.52 * alpha);
    g.fillRect(x, y, w, h);
    g.lineStyle(2, 0xb7c7a4, 0.22 * alpha);
    for (let i = 24; i < w + h; i += 36) {
      const x1 = x + Math.min(i, w);
      const y1 = y + Math.max(0, i - w);
      const x2 = x + Math.max(0, i - h);
      const y2 = y + Math.min(i, h);
      g.lineBetween(x1, y1, x2, y2);
    }
  }

  syncPlacedLots(view) {
    const byId = {};
    for (const lot of view.lots) byId[lot.id] = lot;
    const zoom = this.cameras.main.zoom;
    const selected = this.registry.get('openLotId');
    for (const node of Object.values(this.lots)) {
      const lot = byId[node.id];
      const live = this.sim.state.lots[node.id];
      if (!lot || !live) continue;
      const zone = view.zones.find((item) => item.id === lot.zoneId);
      const locked = zone && !zone.unlocked;
      node.select.setVisible(selected === node.id);
      node.root.setAlpha(locked ? 0.55 : 1);
      if (live.phase === 'demolishing') {
        if (node.phase !== 'demolishing') {
          node.demoMax = Math.max(0.2, live.demolishLeft || lot.demolishLeft || 1);
          const juice = this.registry.get('juice');
          if (juice && juice.shake) juice.shake(240, 0.003);
          if (juice && juice.burst) juice.burst({ x: node.pos.x, y: node.pos.y }, 0xc4a574);
        }
        const total = node.demoMax || 1;
        paintRubble(node.art, 1 - Math.max(0, live.demolishLeft) / total);
        node.key = '';
        if (Math.random() < 0.35) this.puff(node.pos.x + (Math.random() - 0.5) * 40, node.pos.y - 10);
      } else if (live.phase === 'building') {
        if (node.phase !== 'building') {
          node.buildMax = Math.max(0.2, live.constructLeft || lot.constructLeft || 1);
          const juice = this.registry.get('juice');
          if (juice && juice.burst) juice.burst({ x: node.pos.x, y: node.pos.y }, 0x8ec5ff);
        }
        const total = node.buildMax || 1;
        paintScaffold(node.art, 1 - Math.max(0, live.constructLeft) / total);
        node.key = '';
      } else if (live.buildingId && live.phase === 'operating') {
        if (node.key !== 'b:' + live.buildingId) {
          node.key = 'b:' + live.buildingId;
          this.paintSite(node.art, { buildingId: live.buildingId, rivalControlled: false, level: live.level || 1, progress: 1 });
        }
      } else if (lot.kind === 'open') {
        if (node.key !== 'open') {
          node.key = 'open';
          paintOpen(node.art);
        }
      } else if (typeof Art.drawKeyed === 'function' && lot.propertyType && node.key !== 'k:' + lot.propertyType) {
        node.key = 'k:' + lot.propertyType;
        const ctx = { buildingId: lot.propertyType, rival: lot.owner === 'rival', level: 1, night: this.isNight(), progress: 0 };
        node.art.clear();
        Art.drawKeyed(node.art, lot.propertyType, ctx);
      } else if (!(typeof Art.drawKeyed === 'function' && lot.propertyType) && node.key !== 'p:' + (lot.propertyType || lot.kind)) {
        node.key = 'p:' + (lot.propertyType || lot.kind);
        paintProperty(node.art, lot.propertyType);
      }
      if (node.phase === 'demolishing' && live.phase === 'cleared') {
        const fn = this.registry.get('onLotReady');
        if (fn) fn(node.id);
      }
      const shown = live.phase === 'demolishing' ? Math.ceil(live.demolishLeft || 0) : live.phase === 'building' ? Math.ceil(live.constructLeft || 0) : -1;
      if (node.shownLeft !== shown && this.registry.get('openLotId') === node.id) {
        const tick = this.registry.get('onLotTick');
        if (tick) tick();
      }
      node.shownLeft = shown;
      node.phase = live.phase;
      const title = live.phase === 'demolishing' ? 'Demolishing' : live.phase === 'building' ? 'Scaffolding' : lot.propertyLabel || lot.label;
      const sub = live.phase === 'operating' && lot.role ? lot.role : lot.kind === 'open' ? 'Open plot' : '';
      this.placeMark(node, title, sub, zoom >= 0.55 && !locked);
    }
  }

  placeMark(node, title, sub, show) {
    const el = node.pin;
    if (!show || !this.fontsReady) {
      el.hidden = true;
      return;
    }
    el.querySelector('strong').textContent = title;
    const span = el.querySelector('span');
    span.hidden = !sub;
    span.textContent = sub || '';
    this.placeFree(el, node.pos.x, node.pos.y - 78);
  }

  syncZoneChrome(view) {
    const open = !!this.sim.state.mapOpen;
    const zoom = this.cameras.main.zoom;
    const control = !!this.registry.get('showControl');
    for (const zone of view.zones) {
      const mark = this.zoneMarks[zone.id];
      if (!mark) continue;
      const showUnlock = open && !zone.unlocked;
      mark.el.hidden = !showUnlock;
      if (showUnlock) {
        mark.el.querySelector('strong').textContent = `Unlock ${zone.name}`;
        const cost = zone.unlock && zone.unlock.clean ? `$${zone.unlock.clean} clean` : 'Open';
        mark.el.querySelector('span').textContent = cost;
        this.placeFree(mark.el, mark.x, mark.y);
      }
      const showArea = open && zone.unlocked && zoom < 0.9;
      mark.area.hidden = !showArea;
      if (showArea) {
        const pct = control ? ` · ${zone.control}%` : '';
        mark.area.querySelector('strong').textContent = `${zone.name}${pct}`;
        this.placeFree(mark.area, mark.x, mark.y);
      }
    }
  }

  settleMarks() {
    const pins = [...this.pinHost.querySelectorAll('.go-pin, .go-badge, .go-plate')].filter((el) => !el.hidden);
    const extras = [...this.pinHost.querySelectorAll('.go-mark, .go-zone, .go-area')].filter((el) => !el.hidden);
    const hit = (a, b) => {
      const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      return x > 1 && y > 1;
    };
    for (const el of extras) {
      const rect = el.getBoundingClientRect();
      if (pins.some((pin) => hit(rect, pin.getBoundingClientRect()))) el.hidden = true;
    }
  }

  fx(evt) {
    if (!evt) return;
    const j = this.registry.get('juice');
    if (j && j.cashPop) {
      if (evt.type === 'exported') {
        if (evt.earnedDirty) j.cashPop(evt.slotId, evt.earnedDirty, 'dirty');
        if (evt.earnedClean) j.cashPop(evt.slotId, evt.earnedClean, 'clean');
      } else if (evt.type === 'laundered') {
        j.cashPop(evt.slotId, evt.cleanEarned, 'clean');
        j.burst(evt.slotId, 0x8ec5ff);
      }
      if (evt.type === 'produced' || evt.type === 'processed' || evt.type === 'built') j.pulseBuilding(evt.slotId);
      if (evt.type === 'raid_started' || evt.type === 'rival_raid' || evt.type === 'raid_seized') j.shake();
      if (evt.type === 'truck_delivered' && evt.truck) j.burst({ x: evt.truck.x, y: evt.truck.y }, 0xe7d3a1);
    } else {
      if (evt.type === 'exported' || evt.type === 'laundered') {
        const def = BUILD_SLOTS.find((s) => s.id === evt.slotId);
        if (def) {
          const text = evt.type === 'exported'
            ? `+$${evt.earnedDirty || evt.earnedClean || 0}`
            : `+$${evt.cleanEarned || 0} clean`;
          const node = this.add.text(def.x, def.y - 20, text, {
            fontFamily: 'Outfit, sans-serif', fontSize: '16px', fontStyle: '700',
            color: evt.type === 'laundered' ? '#8ec5ff' : '#7dcea0'
          }).setOrigin(0.5).setDepth(20);
          this.floaters.push({ node, x: def.x, y: def.y - 20, life: 1.1 });
        }
      }
      if (evt.type === 'raid_started' || evt.type === 'rival_raid') this.cameras.main.shake(280, 0.004);
      if (evt.type === 'truck_delivered') {
        const def = BUILD_SLOTS.find((s) => s.id === evt.truck.toSlotId);
        if (def) this.puff(def.x, def.y);
      }
    }
    const onJuice = this.registry.get('onJuice');
    if (typeof onJuice === 'function') onJuice(evt);
  }
}
