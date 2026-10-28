// Grow Op: San Verde '84 — map, labels, camera, and onboarding chrome.
//
// Hooks for the other Grow Op branches (do not fold their files in here):
//   art.js      drawWorld, drawFog, drawMiniTruck, paintStructure.
//               If it also exports textureKey(ctx) and drawKeyed(g, key, ctx),
//               structures go through that path. ctx is
//               { buildingId, rival, level, night, progress }.
//   simulation  recommendedSlot() and observeFrame(dt) are called when present.
//   audio/juice registry key onJuice(evt) runs after the visual fx() below.
//   registry key juice, when present, is the cashPop / shake / pulseBuilding / burst / step bag.
//   simulation  gameplayView() is the map catalog. Actions are unlockZone,
//               buyAndConvert, buyLot, startDemolish, buildNew, buildOnPlot,
//               negotiate, intimidate. Lots with a slotId stay on BUILD_SLOTS.

import { GOODS } from './data/goods.js';
import { BUILDINGS } from './data/buildings.js';
import { REGIONS, BUILD_SLOTS, ROAD_NETWORK, findRoadPath } from './data/missions.js';
import { DISTRICT_EDGE, LOT_POS, MAP_H, MAP_W, ZONE_LAYOUT, zoneCenter } from './map-layout.js';
import { drawExtended, paintOpen, paintProperty } from './map-draw.js';
import { artURL, iconKeyForBuilding, iconKeyForProperty, iconKeyForRole } from './art-keys.js';
import { capExtra, storageCap } from './systems/chains.js';
import * as Art from './art.js';

const PIN_MARK = '<img alt="" width="64" height="64" draggable="false"><svg class="go-glyph go-glyph-plus" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><svg class="go-glyph go-glyph-crane" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 17h14M5 17V9h7l3-5h3M8 9v4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><svg class="go-glyph go-glyph-lock" viewBox="0 0 20 20" aria-hidden="true"><rect x="5" y="9" width="10" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9" fill="none" stroke="currentColor" stroke-width="1.6"/></svg><strong hidden></strong><span hidden></span><i class="go-pin-bar" hidden><b></b></i>';

const { WORLD_W, WORLD_H, RIVER, HARBOR } = Art;

const SOFT_EDGE = new Map();

function softEdge(poly) {
  const cached = SOFT_EDGE.get(poly);
  if (cached) return cached;
  const n = poly.length;
  const out = [];
  const steps = 4;
  for (let i = 0; i < n; i++) {
    const prev = poly[(i - 1 + n) % n];
    const c = poly[i];
    const nxt = poly[(i + 1) % n];
    const x0 = (prev[0] + c[0]) / 2;
    const y0 = (prev[1] + c[1]) / 2;
    const x1 = (c[0] + nxt[0]) / 2;
    const y1 = (c[1] + nxt[1]) / 2;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const u = 1 - t;
      out.push([u * u * x0 + 2 * u * t * c[0] + t * t * x1, u * u * y0 + 2 * u * t * c[1] + t * t * y1]);
    }
  }
  SOFT_EDGE.set(poly, out);
  return out;
}

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
    if (!(typeof Art.coversExtendedMap === 'function' && Art.coversExtendedMap())) drawExtended(this.coast);
    this.hatch.clear();
    this.createSlots();
    this.createPlacedLots();
    this.createZoneMarks();
    this.spawnAmbientCraft();
    this.bindCamera();
    this.placeRoot = this.add.container(0, 0).setDepth(12).setVisible(false);
    this.placeRing = this.add.graphics();
    this.placeArt = this.add.graphics();
    this.placeRoot.add([this.placeRing, this.placeArt]);
    this.frameValley(true);
    this.scale.on('resize', () => {
      if (!this.userPanned && !(this.sim && this.sim.state.mapOpen)) this.frameValley(true);
    });
  }

  drawTerrain() {
    Art.drawWorld(this.terrain, ROAD_NETWORK);
  }

  isNight() {
    const hour = this.sim && this.sim.state ? this.sim.state.timeOfDay || 0 : 0;
    return hour > 0.72 || hour < 0.18;
  }

  createSlots() {
    for (const def of BUILD_SLOTS) {
      const root = this.add.container(def.x, def.y);
      const hit = this.add.ellipse(0, 10, 210, 130, 0x000000, 0.001);
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerup', (pointer) => {
        if (this.dragMoved || this.pointingAtUi(pointer)) return;
        const state = this.sim.state.slots[def.id];
        const placing = this.registry.get('placing');
        if (placing) {
          if (state && !state.buildingId && !state.rivalControlled) {
            this.hover = { x: def.x, y: def.y };
            this.registry.set('snapLock', def.id);
            const tapped = this.registry.get('onLotTapped');
            if (tapped) tapped(def.id);
          }
          return;
        }
        if (state && !state.buildingId && !state.rivalControlled) {
          const open = this.registry.get('onEmptyLot');
          if (open) {
            open(def.id);
            return;
          }
        }
        this.sim.state.selectedSlotId = def.id;
        this.sim.state.selectedRegionId = def.regionId;
        this.onSlotSelected(def.id);
      });
      const select = this.add.ellipse(0, 12, 230, 140, 0x8ec5ff, 0.06).setStrokeStyle(2, 0x8ec5ff, 0.85).setVisible(false);
      const raid = this.add.ellipse(0, 12, 240, 150, 0xf85149, 0.1).setStrokeStyle(3, 0xf85149, 0.9).setVisible(false);
      const art = this.add.graphics();
      const pulse = this.add.ellipse(0, 18, 170, 78).setStrokeStyle(3, 0x8ec5ff, 1).setVisible(false);
      const ring = this.add.graphics();
      const pin = document.createElement('div');
      pin.className = 'go-pin';
      pin.innerHTML = PIN_MARK;
      pin.hidden = true;
      const stack = document.createElement('div');
      stack.className = 'go-stack';
      stack.hidden = true;
      const flow = document.createElement('div');
      flow.className = 'go-flow';
      flow.hidden = true;
      const block = document.createElement('div');
      block.className = 'go-block';
      block.hidden = true;
      const fleet = document.createElement('div');
      fleet.className = 'go-fleet';
      fleet.hidden = true;
      this.pinHost.appendChild(pin);
      this.pinHost.appendChild(stack);
      this.pinHost.appendChild(flow);
      this.pinHost.appendChild(block);
      this.pinHost.appendChild(fleet);
      root.add([pulse, select, raid, hit, art, ring]);
      root.setDepth(4);
      this.slots[def.id] = { def, root, hit, select, raid, art, ring, pulse, pin, stack, flow, block, fleet, key: '', buildMax: 0, wasBuilding: false, pop: 0 };
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

  haltCamera() {
    const cam = this.cameras.main;
    if (cam.panEffect && cam.panEffect.isRunning) cam.panEffect.reset();
    if (cam.zoomEffect && cam.zoomEffect.isRunning) cam.zoomEffect.reset();
  }

  bindCamera() {
    this.inertia = { x: 0, y: 0 };
    this.samples = [];
    if (this.input.addPointer) this.input.addPointer(1);
    this.input.on('pointerdown', (p) => {
      if (this.pointingAtUi(p)) return;
      this.haltCamera();
      this.drag = true;
      this.dragMoved = false;
      this.inertia.x = 0;
      this.inertia.y = 0;
      this.samples = [{ x: p.x, y: p.y, t: performance.now() }];
      this.dragFrom = { x: p.x, y: p.y, sx: this.cameras.main.scrollX, sy: this.cameras.main.scrollY };
    });
    this.input.on('pointermove', (p) => {
      const a = this.input.pointer1;
      const b = this.input.pointer2;
      if (a && b && a.isDown && b.isDown) {
        this.haltCamera();
        const d = window.Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        if (this.pinch != null) {
          const zoom = window.Phaser.Math.Clamp(this.cameras.main.zoom + (d - this.pinch) * 0.003, this.minZoom(), 2.8);
          this.cameras.main.setZoom(zoom);
          this.clampScroll();
        }
        this.pinch = d;
        this.dragMoved = true;
        this.userPanned = true;
        return;
      }
      this.pinch = null;
      if (p) this.hover = { x: p.worldX, y: p.worldY };
      if (!this.drag || !p.isDown || !this.dragFrom) return;
      const dx = p.x - this.dragFrom.x;
      const dy = p.y - this.dragFrom.y;
      if (Math.hypot(dx, dy) <= 6) return;
      this.dragMoved = true;
      this.userPanned = true;
      const z = this.cameras.main.zoom;
      this.cameras.main.scrollX = this.dragFrom.sx - dx / z;
      this.cameras.main.scrollY = this.dragFrom.sy - dy / z;
      this.clampScroll();
      const now = performance.now();
      this.samples.push({ x: p.x, y: p.y, t: now });
      this.samples = this.samples.filter((sample) => now - sample.t < 90);
    });
    this.input.on('pointerup', () => {
      if (this.dragMoved && this.samples.length >= 2) {
        const first = this.samples[0];
        const last = this.samples[this.samples.length - 1];
        const dt = Math.max(16, last.t - first.t);
        const z = this.cameras.main.zoom || 1;
        this.inertia.x = ((last.x - first.x) / dt) * 16 / z;
        this.inertia.y = ((last.y - first.y) / dt) * 16 / z;
      }
      this.drag = false;
      this.pinch = null;
    });
    this.input.on('wheel', (p, _o, _dx, dy) => {
      if (p && this.pointingAtUi(p)) return;
      this.haltCamera();
      this.userPanned = true;
      const cam = this.cameras.main;
      cam.setZoom(window.Phaser.Math.Clamp(cam.zoom - dy * 0.0008, this.minZoom(), 2.8));
      this.clampScroll();
    });
    this.cursors = this.input.keyboard ? this.input.keyboard.createCursorKeys() : null;
  }

  unlockedRect() {
    if (!this.sim || !this.sim.state.mapOpen) {
      const view = this.view;
      const core = !view || view.coreMode !== false;
      if (core) return { x: 0, y: 0, w: Math.max(WORLD_W, 1600), h: 2720 };
      return { x: 0, y: 0, w: WORLD_W, h: WORLD_H };
    }
    const view = this.view || (this.sim.gameplayView ? this.sim.gameplayView() : { zones: [] });
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const zone of view.zones || []) {
      if (!zone.unlocked && !zone.starter) continue;
      const box = ZONE_LAYOUT[zone.id];
      if (!box) continue;
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.w);
      maxY = Math.max(maxY, box.y + box.h);
    }
    if (!Number.isFinite(minX)) return { x: 0, y: 0, w: MAP_W, h: MAP_H };
    if (minX < 80 && maxX > 5200 && minY < 250 && maxY > 2400) return { x: 0, y: 0, w: MAP_W, h: MAP_H };
    const pad = 200;
    return { x: minX - pad, y: minY - pad, w: (maxX - minX) + pad * 2, h: (maxY - minY) + pad * 2 };
  }

  clampScroll() {
    const cam = this.cameras.main;
    const b = this.unlockedRect();
    const dw = cam.displayWidth;
    const dh = cam.displayHeight;
    const minSX = b.x + (dw - cam.width) / 2;
    const maxSX = Math.max(minSX, minSX + b.w - dw);
    const minSY = b.y + (dh - cam.height) / 2;
    const maxSY = Math.max(minSY, minSY + b.h - dh);
    cam.scrollX = Math.min(maxSX, Math.max(minSX, cam.scrollX));
    cam.scrollY = Math.min(maxSY, Math.max(minSY, cam.scrollY));
  }

  coastInertia() {
    if (this.drag || !this.inertia) return;
    if (Math.abs(this.inertia.x) < 0.12 && Math.abs(this.inertia.y) < 0.12) {
      this.inertia.x = 0;
      this.inertia.y = 0;
      return;
    }
    this.cameras.main.scrollX -= this.inertia.x;
    this.cameras.main.scrollY -= this.inertia.y;
    this.inertia.x *= 0.9;
    this.inertia.y *= 0.9;
    this.clampScroll();
  }

  nearPoint(x, y, reach) {
    if (!this.hover) return false;
    return Math.hypot(this.hover.x - x, this.hover.y - y) < reach;
  }

  valleyZoom() {
    const vw = this.scale.width;
    const vh = this.scale.height;
    const top = 52;
    const bottom = 64;
    const zoom = Math.min((vw - 16) / 640, (vh - top - bottom) / 820);
    return window.Phaser.Math.Clamp(zoom * 0.98, 0.55, 1.35);
  }

  stopCamera() {
    this.haltCamera();
  }

  frameValley(instant) {
    this.stopCamera();
    const cam = this.cameras.main;
    const zoom = this.valleyZoom();
    cam.setZoom(zoom);
    const topInset = 56;
    const viewY = 300 - topInset / zoom;
    const focus = { x: 470, y: viewY + (this.scale.height / zoom) / 2 };
    if (instant) cam.centerOn(focus.x, focus.y);
    else cam.pan(focus.x, focus.y, 420, 'Sine.easeInOut');
    this.clampScroll();
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
    this.frameDt = dt;
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
      this.clampScroll();
    }
    this.coastInertia();
    this.view = this.sim.gameplayView ? this.sim.gameplayView() : null;
    this.syncSlots();
    this.syncTrucks();
    this.syncPlacement();
    this.syncLife(dt);
    this.syncSky();
    this.syncFloaters(dt);
    this.syncWorld(dt);
    this.syncTip();
    this.syncGuide();
  }

  ensureTip() {
    let tip = document.getElementById('map-tip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'map-tip';
      tip.hidden = true;
      document.body.appendChild(tip);
    }
    return tip;
  }

  syncTip() {
    const tip = this.ensureTip();
    tip.hidden = true;
  }

  worldToScreen(x, y) {
    const view = this.cameras.main.worldView;
    const zoom = this.cameras.main.zoom;
    return { x: (x - view.x) * zoom, y: (y - view.y) * zoom };
  }

  underHud(sx, sy, hw, hh) {
    const w = this.scale.width;
    const h = this.scale.height;
    const top = 56;
    if (sy - hh < top) return true;
    if (sy + hh > h - 78) return true;
    const objBottom = top + (w < 700 ? 78 : 132);
    if (sx - hw < 400 && sy - hh < objBottom) return true;
    return false;
  }

  syncSlots() {
    const selected = this.sim.state.selectedSlotId;
    const recommend = this.recommendedSlot();
    const supplyOnly = !this.view || this.view.coreMode !== false;
    const guide = this.registry.get('guide');
    const guiding = !!(guide && guide.live);
    const guideId = guide && guide.slotId;
    const guided = !!guideId;
    for (const [id, node] of Object.entries(this.slots)) {
      const state = this.sim.state.slots[id];
      if (!state) continue;
      const lot = this.sim.state.lots && this.sim.state.lots[id];
      const phase = lot ? lot.phase : '';
      node.select.setVisible(!guiding && id === selected);
      node.raid.setVisible(!supplyOnly && !!state.raidLocked);
      if (node.raid.visible) node.raid.setAlpha(0.45 + Math.sin(this.phase * 6) * 0.35);
      const built = !!state.buildingId && !state.rivalControlled;
      const marked = !guided && (id === recommend || id === this.recommendId());
      node.pulse.setVisible(!guiding && !built && !state.rivalControlled && marked);
      if (guiding && guideId) node.root.setAlpha(id === guideId ? 1 : 0.4);
      else if (node.root.alpha !== 1) node.root.setAlpha(1);
      if (node.pulse.visible) node.pulse.setAlpha(0.25 + Math.sin(this.phase * 3) * 0.35);
      const ctx = this.siteCtx(state, lot, id);
      if (typeof Art.textureKey === 'function' && typeof Art.drawKeyed === 'function') {
        const key = Art.textureKey(ctx);
        if (key !== node.key) {
          node.key = key;
          Art.drawKeyed(node.art, key, ctx);
        }
      } else {
        const key = `${state.buildingId || 'empty'}:${state.rivalControlled ? 1 : 0}:${state.level}`;
        if (key !== node.key) {
          node.key = key;
          this.paintSite(node.art, state);
        }
      }
      const constructing = phase === 'building' || (state.constructLeft || 0) > 0;
      const buildingNow = constructing || phase === 'demolishing';
      this.noteBuild(node, buildingNow && !!state.buildingId, state.constructLeft || 0, { x: node.def.x, y: node.def.y }, state.buildingId, constructing);
      this.syncStock(node, state);
      this.syncChain(node, state);
      const working = (state.progress || 0) > 0.04 || Object.values(state.outputBuffer || {}).some((qty) => qty > 0);
      if (buildingNow) {
        this.placeBadge(node, node.def.x, node.def.y, null, 'is-build', built ? BUILDINGS[state.buildingId].shortName : 'Build');
      } else if (built) {
        const def = BUILDINGS[state.buildingId];
        this.placeBadge(node, node.def.x, node.def.y, iconKeyForBuilding(state.buildingId), working ? 'is-work' : 'is-idle', def ? def.shortName : '');
        if (state.buildingId === 'drying_barn' || state.buildingId === 'chem_lab' || state.buildingId === 'packaging_mill' || state.buildingId === 'coffee_estate') {
          if (Math.random() < 0.08) this.puff(node.def.x + 30, node.def.y - 70);
        }
      } else if (!built && !state.rivalControlled && !this.registry.get('placing') && this.lotOpen(node.def)) {
        this.placeBadge(node, node.def.x, node.def.y, null, 'is-plus', 'Build');
      } else {
        node.pin.hidden = true;
        node.pin.classList.remove('is-hot', 'is-work', 'is-idle', 'is-build', 'is-plus');
      }
    }
    this.separatePins();
  }

  recommendId() {
    const lots = this.view && this.view.lots;
    if (!lots) return null;
    const row = lots.find((lot) => lot.recommended);
    return row ? row.id : null;
  }

  siteCtx(state, lot, id) {
    return {
      buildingId: (state && state.buildingId) || (lot && lot.buildingId) || null,
      rival: !!(state && state.rivalControlled) || (lot && lot.propertyType === 'outpost'),
      level: (state && state.level) || (lot && lot.level) || 1,
      night: this.isNight(),
      progress: (state && state.progress) || 0,
      slotId: id,
      phase: lot ? lot.phase : '',
      propertyType: lot ? lot.propertyType : null,
      owned: lot ? !!lot.owned : !!(state && state.buildingId),
      size: lot ? lot.size : null,
      constructLeft: (state && state.constructLeft) || (lot && lot.constructLeft) || 0,
      demolishLeft: (lot && lot.demolishLeft) || 0,
      phase: ((state && state.constructLeft > 0) || (lot && (lot.phase === 'building' || lot.phase === 'demolishing')))
        ? ((lot && lot.phase === 'demolishing') ? 'demolishing' : 'building')
        : (lot ? lot.phase : '')
    };
  }

  placeBadge(node, x, y, iconKey, status, tip) {
    const el = node.pin;
    el.hidden = false;
    el.classList.remove('is-work', 'is-idle', 'is-build', 'is-plus', 'is-hot');
    if (status) el.classList.add(status);
    const img = el.querySelector('img');
    const src = iconKey ? artURL(iconKey) : '';
    if (img) {
      if (src) img.src = src;
      img.hidden = !src || status === 'is-plus' || status === 'is-build';
    }
    const strong = el.querySelector('strong');
    const span = el.querySelector('span');
    if (strong) {
      strong.hidden = true;
      strong.textContent = '';
    }
    if (span) {
      span.hidden = true;
      span.textContent = '';
    }
    el.title = tip || '';
    const bar = el.querySelector('.go-pin-bar');
    if (bar) {
      bar.hidden = status !== 'is-work' && status !== 'is-idle';
      const fill = bar.querySelector('b');
      if (fill) {
        fill.style.width = status === 'is-work' ? '100%' : '35%';
        fill.style.background = '#58a6ff';
      }
    }
    this.placeScreen(el, x, y - 72);
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
    if (!showName) {
      node.pin.hidden = true;
      return;
    }
    const icon = title && BUILDINGS[title] ? iconKeyForBuilding(title) : null;
    this.placeBadge(node, node.def.x, node.def.y, icon, progress > 0 ? 'is-work' : 'is-idle', title || '');
    if (barColor) node.pin.style.setProperty('--go-ring', barColor);
  }

  placeScreen(el, worldX, worldY) {
    const spot = this.worldToScreen(worldX, worldY);
    const vw = this.scale.width;
    const vh = this.scale.height;
    if (spot.x < 0 || spot.y < 0 || spot.x > vw || spot.y > vh) {
      el.hidden = true;
      return false;
    }
    el.hidden = false;
    el.style.transform = 'translate(0px, 0px)';
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const hud = document.querySelector('.go-subhud');
    const hudBottom = hud ? hud.getBoundingClientRect().bottom : 0;
    const topLimit = Math.max(48, hudBottom + 6);
    const bottomLimit = this.bottomLimit(vh);
    let left = spot.x - w / 2;
    let top = spot.y - h;
    if (left < -24 || top < topLimit - 24 || left + w > vw + 24 || top + h > bottomLimit + 24) {
      el.hidden = true;
      return false;
    }
    left = Math.max(8, Math.min(Math.max(8, vw - w - 8), left));
    top = Math.max(topLimit, Math.min(Math.max(topLimit, bottomLimit - h), top));
    const cleared = this.clearOfChrome(left, top, w, h, topLimit, bottomLimit);
    left = cleared.left;
    top = cleared.top;
    el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    return true;
  }

  separatePins() {
    const els = [...this.pinHost.querySelectorAll('.go-pin, .go-badge, .go-plate, .go-mark, .go-zone, .go-area')].filter((el) => !el.hidden);
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
          if (y > maxY) continue;
          lower.el.style.transform = `translate(${x}px, ${Math.round(y)}px)`;
          lower.r = lower.el.getBoundingClientRect();
          moved = true;
        }
      }
      if (!moved) break;
    }
    const rank = (el) => (el.classList.contains('go-zone') || el.classList.contains('go-area') ? 0 : 1);
    const left = els.filter((el) => !el.hidden);
    for (let i = 0; i < left.length; i++) {
      if (left[i].hidden) continue;
      const a = left[i].getBoundingClientRect();
      for (let j = i + 1; j < left.length; j++) {
        if (left[j].hidden) continue;
        const b = left[j].getBoundingClientRect();
        if (!overlap(a, b)) continue;
        const drop = rank(left[i]) > rank(left[j]) ? left[i] : rank(left[j]) > rank(left[i]) ? left[j] : (a.top >= b.top ? left[i] : left[j]);
        drop.hidden = true;
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

  paintProgress(g, p) {
    g.clear();
    const amount = Math.max(0.08, Math.min(1, p || 0));
    const y = -52;
    g.fillStyle(0x12181c, 0.88);
    g.fillCircle(0, y, 18);
    g.lineStyle(5, 0x2c3848, 1);
    g.strokeCircle(0, y, 16);
    g.lineStyle(5, 0x3ddc97, 1);
    g.beginPath();
    g.arc(0, y, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * amount);
    g.strokePath();
  }

  syncStock(node, state) {
    const el = node.stack;
    if (!el) return;
    const building = state && (state.constructLeft || 0) <= 0 && state.buildingId;
    const rows = [];
    if (building) {
      for (const [id, qty] of Object.entries(state.outputBuffer || {})) if (qty > 0) rows.push([id, qty]);
      for (const [id, qty] of Object.entries(state.inputBuffer || {})) if (qty > 0) rows.push([id, qty]);
    }
    if (!rows.length) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    const html = rows.slice(0, 3).map(([id, qty]) => {
      const good = GOODS[id];
      const bg = good ? good.badgeBg : '#333';
      const ink = good ? good.badgeInk : '#fff';
      const name = good ? good.shortName : id;
      return `<i title="${name}"><b style="background:${ink};box-shadow:inset 0 0 0 1.5px ${bg}"></b><em>${qty}</em></i>`;
    }).join('');
    if (el.dataset.stack !== html) {
      el.dataset.stack = html;
      el.innerHTML = html;
    }
    const x = node.def ? node.def.x : node.pos.x;
    const y = node.def ? node.def.y : node.pos.y;
    this.placeStack(el, x, y + 46);
  }

  placeStack(el, worldX, worldY) {
    const spot = this.worldToScreen(worldX, worldY);
    const vw = this.scale.width;
    const vh = this.scale.height;
    if (spot.x < 0 || spot.y < 40 || spot.x > vw || spot.y > vh - 48) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const w = el.offsetWidth || 28;
    const left = Math.max(6, Math.min(vw - w - 6, Math.round(spot.x - w / 2)));
    el.style.transform = `translate(${left}px, ${Math.round(spot.y)}px)`;
  }

  goodSwatch(id) {
    const good = GOODS[id];
    if (!good) return '';
    return `<b style="background:${good.badgeInk};box-shadow:inset 0 0 0 1.5px ${good.badgeBg}" title="${good.shortName}"></b>`;
  }

  pileCount(buffer) {
    let sum = 0;
    for (const value of Object.values(buffer || {})) sum += value || 0;
    return sum;
  }

  chainMark(def) {
    if (!def) return '';
    const ins = Object.keys(def.inputs || {});
    const outs = Object.keys(def.outputs || {});
    if (ins.length && outs.length) return `${ins.map((id) => this.goodSwatch(id)).join('')}<s></s>${outs.map((id) => this.goodSwatch(id)).join('')}`;
    if (outs.length) return outs.map((id) => this.goodSwatch(id)).join('');
    if (def.role === 'smuggling') return `${this.goodSwatch('cured_pack')}<s></s><b class="go-bill" title="Cash"></b>`;
    if (def.role === 'warehouse') return '<b class="go-bill" title="Store"></b>';
    return '';
  }

  fleetJammed() {
    const max = this.sim.getMaxTrucks();
    if (!max || this.sim.state.activeTrucks.length < max) return false;
    return Object.values(this.sim.state.slots).some((slot) => this.pileCount(slot.outputBuffer) >= 2);
  }

  blockMark(state, def) {
    if (!state || !def || (state.constructLeft || 0) > 0) return null;
    const cap = storageCap(def, state.level || 1, capExtra(this.sim.state, def));
    const out = this.pileCount(state.outputBuffer);
    const inn = this.pileCount(state.inputBuffer);
    const jammed = this.fleetJammed();
    if (def.role === 'producer') {
      if (jammed && out >= 2) return { kind: 'jam', good: Object.keys(def.outputs || {})[0] };
      if (cap && out >= cap) return { kind: 'full', good: Object.keys(def.outputs || {})[0] };
    }
    if (def.role === 'processor') {
      if (cap && out >= cap) return { kind: 'full', good: Object.keys(def.outputs || {})[0] };
      const missing = Object.keys(def.inputs || {}).find((id) => (state.inputBuffer[id] || 0) < def.inputs[id]);
      if (missing && (state.progress || 0) < 0.05) return { kind: 'need', good: missing };
    }
    if (def.role === 'warehouse') {
      if (jammed && out >= 2) return { kind: 'jam', good: null };
      if (cap && out + inn >= cap) return { kind: 'full', good: null };
    }
    if (def.role === 'smuggling' && inn < 1 && (state.progress || 0) < 0.05) return { kind: 'need', good: 'cured_pack' };
    return null;
  }

  syncChain(node, state) {
    if (!node.flow || !node.block) return;
    const def = state && state.buildingId ? BUILDINGS[state.buildingId] : null;
    const recipe = def && (state.constructLeft || 0) <= 0 ? this.chainMark(def) : '';
    if (!recipe) node.flow.hidden = true;
    else {
      if (node.flow.dataset.flow !== recipe) {
        node.flow.dataset.flow = recipe;
        node.flow.innerHTML = recipe;
      }
      this.placeStack(node.flow, node.def.x + 86, node.def.y - 6);
    }
    const blocked = def ? this.blockMark(state, def) : null;
    if (!blocked) node.block.hidden = true;
    else {
      const glyph = blocked.kind === 'full' ? ' is-full' : blocked.kind === 'jam' ? ' is-jam' : '';
      const html = `${blocked.good ? this.goodSwatch(blocked.good) : ''}<i class="go-gap${glyph}"></i>`;
      if (node.block.dataset.block !== html) {
        node.block.dataset.block = html;
        node.block.innerHTML = html;
      }
      this.placeStack(node.block, node.def.x - 78, node.def.y - 8);
    }
    this.syncFleet(node, state, def);
  }

  syncFleet(node, state, def) {
    if (!node.fleet) return;
    if (!def || def.role !== 'warehouse' || !state || (state.constructLeft || 0) > 0) {
      node.fleet.hidden = true;
      return;
    }
    const max = this.sim.getMaxTrucks();
    const used = Math.min(max, this.sim.state.activeTrucks.length);
    const html = Array.from({ length: max }, (_, i) => `<i class="${i < used ? 'is-out' : ''}"></i>`).join('');
    if (node.fleet.dataset.fleet !== html) {
      node.fleet.dataset.fleet = html;
      node.fleet.innerHTML = html;
    }
    this.placeStack(node.fleet, node.def.x, node.def.y - 54);
  }

  lotOpen(def) {
    if (!def || !this.sim) return false;
    const reg = this.sim.state.regions[def.regionId];
    if (!reg || !reg.unlocked) return false;
    const lot = this.sim.state.lots && this.sim.state.lots[def.id];
    if (lot && (lot.phase === 'building' || lot.phase === 'demolishing')) return false;
    if (lot && lot.kind === 'standing' && lot.phase !== 'cleared') return false;
    return true;
  }

  ensureGuideEl(className, html) {
    let el = document.querySelector('.' + className);
    if (!el) {
      el = document.createElement('div');
      el.className = className;
      el.hidden = true;
      el.innerHTML = html;
      (className === 'go-guide' ? document.body : this.pinHost).appendChild(el);
    }
    return el;
  }

  guideTarget(guide) {
    if (!guide || !guide.live) return null;
    if (guide.aim === 'build') return document.getElementById('dock-build-btn');
    if (guide.aim === 'menu') {
      const picker = document.getElementById('lot-picker');
      if (picker && !picker.hidden) {
        const picked = picker.querySelector('[data-pick="drying_barn"]');
        if (picked) return picked;
      }
      const strip = document.getElementById('build-strip');
      if (strip && !strip.hidden) return strip.querySelector('[data-place="drying_barn"]');
    }
    if (guide.aim === 'place-ok') {
      const hud = document.getElementById('place-hud');
      const ok = document.getElementById('place-ok');
      if (hud && ok && !hud.hidden) return ok;
    }
    return null;
  }

  frameGuide(node) {
    this.userPanned = true;
    this.haltCamera();
    const cam = this.cameras.main;
    const b = this.unlockedRect();
    cam.setBounds(b.x, b.y, b.w, b.h);
    const zoom = this.scale.width < 700 ? 1.2 : this.scale.width < 1100 ? 1.28 : 1.45;
    cam.setZoom(zoom);
    const dw = cam.displayWidth;
    const dh = cam.displayHeight;
    const minCX = b.x + dw / 2;
    const maxCX = b.x + b.w - dw / 2;
    const minCY = b.y + dh / 2;
    const maxCY = b.y + b.h - dh / 2;
    const cx = minCX <= maxCX ? Math.min(maxCX, Math.max(minCX, node.def.x)) : b.x + b.w / 2;
    const cy = minCY <= maxCY ? Math.min(maxCY, Math.max(minCY, node.def.y + 16)) : b.y + b.h / 2;
    cam.centerOn(cx, cy);
    this.clampScroll();
  }

  pointGuide(arrow, dom) {
    const rect = dom.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) {
      arrow.hidden = true;
      return;
    }
    const bob = Math.sin(this.phase * 5.2) * 12;
    const x = rect.left + rect.width / 2;
    const y = Math.max(8, rect.top - 70 + bob);
    arrow.hidden = false;
    arrow.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  syncGuide() {
    const tick = this.registry.get('guideTick');
    if (typeof tick === 'function') tick();
    const guide = this.registry.get('guide');
    const arrow = this.ensureGuideEl('go-guide', '<svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"><path d="M32 6v36M16 30l16 20 16-20" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>');
    const done = this.ensureGuideEl('go-done', '<svg viewBox="0 0 20 20" width="22" height="22" aria-hidden="true"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>');
    if (!this.guideRing) this.guideRing = this.add.graphics().setDepth(13);
    if (!this.guideShade) this.guideShade = this.add.graphics().setDepth(3);
    const flash = this.registry.get('guideFlash');
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    if (flash && flash.slot && now < flash.until) {
      const node = this.slots[flash.slot];
      if (node) {
        const spot = this.worldToScreen(node.def.x + 54, node.def.y - 70);
        done.hidden = false;
        done.style.transform = `translate(${Math.round(spot.x)}px, ${Math.round(spot.y)}px)`;
      }
    } else done.hidden = true;
    const slotId = guide && guide.slotId;
    const aim = guide && guide.aim;
    const live = !!(guide && guide.live);
    if (live || slotId) {
      for (const other of Object.values(this.slots)) {
        other.pulse.setVisible(false);
        if (live) other.select.setVisible(false);
      }
      if (live) {
        for (const other of Object.values(this.lots)) other.select.setVisible(false);
      }
    }
    let node = slotId ? this.slots[slotId] : null;
    if (!node && guide && guide.lotId && LOT_POS[guide.lotId]) {
      const pos = LOT_POS[guide.lotId];
      node = { def: { x: pos.x, y: pos.y } };
    }
    if (!node && guide && guide.zoneId) {
      const center = zoneCenter(guide.zoneId);
      if (center) node = { def: { x: center.x, y: center.y } };
    }
    const dom = this.guideTarget(guide);
    this.guideRing.clear();
    this.guideShade.clear();
    if (live && !(guide && guide.aim === 'zone')) {
      this.guideShade.fillStyle(0x0c1410, 0.34);
      this.guideShade.fillRect(0, 0, WORLD_W, WORLD_H);
    }
    const frameIt = !!(node && (live || !aim));
    const focusKey = slotId || (guide && (guide.lotId || guide.zoneId)) || null;
    if (frameIt && this.guideFocus !== focusKey) {
      this.guideFocus = focusKey;
      this.frameGuide(node);
    } else if (!node) this.guideFocus = null;
    const drawRing = !!(node && (live || !aim) && (!dom || aim === 'world' || aim === 'place-ok' || !aim));
    if (drawRing) {
      const pulse = 1 + Math.sin(this.phase * 4.2) * 0.07;
      const radius = 86 * pulse;
      this.guideRing.lineStyle(12, 0x39e58a, 0.28);
      this.guideRing.strokeCircle(node.def.x, node.def.y + 8, radius + 14);
      this.guideRing.lineStyle(7, 0x39e58a, 1);
      this.guideRing.strokeCircle(node.def.x, node.def.y + 8, radius);
    }
    if (dom) {
      this.pointGuide(arrow, dom);
      return;
    }
    if (!node || aim === 'build' || aim === 'menu') {
      arrow.hidden = true;
      return;
    }
    const spot = this.worldToScreen(node.def.x, node.def.y - 150);
    const bob = Math.sin(this.phase * 5.2) * 16;
    arrow.hidden = false;
    arrow.style.transform = `translate(${Math.round(spot.x)}px, ${Math.round(spot.y + bob)}px)`;
  }

  noteBuild(node, active, left, point, buildingId, constructing) {
    if (node.wasBuilding && !active) {
      const juice = this.registry.get('juice');
      if (juice && juice.demolishDust) juice.demolishDust(point);
      if (juice && juice.burst) juice.burst({ x: point.x, y: point.y - 24 }, 0x8ec5ff);
      node.pop = 0.42;
      if (node.wasConstruct && buildingId) {
        const ready = this.registry.get('onBuildingReady');
        if (ready) ready(buildingId);
      }
    }
    node.wasBuilding = !!active;
    node.wasConstruct = !!(active && constructing);
    if (node.pop > 0) {
      node.pop = Math.max(0, node.pop - (this.frameDt || 0.016));
      const u = 1 - node.pop / 0.42;
      node.root.setScale(0.86 + Math.sin(u * Math.PI) * 0.2);
    } else if (!active) node.root.setScale(1);
    if (!node.ring) return;
    if (active && left > 0) {
      if (left > (node.buildMax || 0)) node.buildMax = left;
      this.paintProgress(node.ring, node.buildMax ? 1 - left / node.buildMax : 0);
      if (node.root.bringToTop) node.root.bringToTop(node.ring);
    } else node.ring.clear();
  }

  placeSites(building) {
    const st = this.sim.state;
    const sites = [];
    for (const def of BUILD_SLOTS) {
      const slot = st.slots[def.id];
      const reg = st.regions[def.regionId];
      if (!slot || !reg || !reg.unlocked || slot.rivalControlled || slot.buildingId) continue;
      const lot = st.lots && st.lots[def.id];
      if (lot && (lot.phase === 'building' || lot.phase === 'demolishing')) continue;
      if (lot && lot.kind === 'standing' && lot.phase !== 'cleared') continue;
      const fits = !def.allowedCategories || def.allowedCategories.includes(building.category);
      const openPlot = !!(lot && lot.kind === 'open');
      const dirty = openPlot ? Math.round(building.buildCostDirty * 0.85) : building.buildCostDirty;
      const clean = openPlot ? Math.round(building.buildCostClean * 0.85) : building.buildCostClean;
      const cash = st.dirtyCash >= dirty && st.cleanCash >= clean;
      const actOk = st.mode === 'sandbox' || st.act >= building.act;
      sites.push({ id: def.id, x: def.x, y: def.y, ok: !!(fits && cash && actOk) });
    }
    return sites;
  }

  syncPlacement() {
    const placing = this.registry.get('placing');
    const hud = document.getElementById('place-hud');
    const okBtn = document.getElementById('place-ok');
    const building = placing && BUILDINGS[placing.buildingId];
    if (!building || !this.placeRoot) {
      if (this.placeRoot) this.placeRoot.setVisible(false);
      if (hud) hud.hidden = true;
      this.registry.set('placeSnap', null);
      return;
    }
    const sites = this.placeSites(building);
    if (!sites.length) {
      this.placeRoot.setVisible(false);
      if (hud) hud.hidden = true;
      this.registry.set('placeSnap', null);
      return;
    }
    const guide = this.registry.get('guide');
    const teachLot = !!(guide && guide.live && guide.id === 'lot');
    const snapLock = this.registry.get('snapLock');
    let pick = snapLock ? sites.find((site) => site.id === snapLock) || null : null;
    if (!pick && this.hover && !teachLot) {
      let best = 260;
      for (const site of sites) {
        const d = Math.hypot(this.hover.x - site.x, this.hover.y - site.y);
        if (d < best) {
          best = d;
          pick = site;
        }
      }
    }
    if (!pick) {
      if (teachLot) {
        this.placeRoot.setVisible(false);
        if (hud) hud.hidden = true;
        this.registry.set('placeSnap', null);
        return;
      }
      const legal = sites.filter((site) => site.ok);
      const pool = legal.length ? legal : sites;
      const south = pool.find((site) => site.id === 'slot_rp_south');
      if (south && building.category === 'production') pick = south;
      else {
        const cam = this.cameras.main.midPoint;
        pick = pool.slice().sort((a, b) => Math.hypot(a.x - cam.x, a.y - cam.y) - Math.hypot(b.x - cam.x, b.y - cam.y))[0];
      }
    }
    this.placeRoot.setVisible(true);
    this.placeRoot.setPosition(pick.x, pick.y);
    const color = pick.ok ? 0x3ddc97 : 0xf85149;
    this.placeRing.clear();
    this.placeRing.fillStyle(color, 0.18);
    this.placeRing.fillEllipse(0, 16, 176, 84);
    this.placeRing.lineStyle(4, color, 0.98);
    this.placeRing.strokeEllipse(0, 16, 176, 84);
    const ctx = this.siteCtx({ buildingId: building.id, level: 1 }, { phase: 'operating', owned: true, buildingId: building.id }, 'placing');
    const key = typeof Art.textureKey === 'function' ? Art.textureKey(ctx) : building.id;
    if (this.placeKey !== key && typeof Art.drawKeyed === 'function') {
      this.placeKey = key;
      Art.drawKeyed(this.placeArt, key, ctx);
    }
    const sprite = this.placeArt.getData && this.placeArt.getData('sprite');
    if (sprite) {
      sprite.setVisible(true);
      sprite.setAlpha(0.66);
    }
    if (this.placeRoot.bringToTop) this.placeRoot.bringToTop(this.placeRing);
    this.registry.set('placeSnap', { id: pick.id, x: pick.x, y: pick.y, ok: pick.ok, buildingId: building.id });
    if (hud && okBtn) {
      const thumb = this.scale.width < 800;
      hud.hidden = false;
      hud.classList.toggle('is-thumb', thumb);
      if (!thumb) {
        const spot = this.worldToScreen(pick.x + 110, pick.y - 36);
        const x = Math.max(8, Math.min(this.scale.width - 150, spot.x));
        const y = Math.max(64, Math.min(this.scale.height - 140, spot.y));
        hud.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      }
      okBtn.disabled = !pick.ok;
      okBtn.classList.toggle('is-bad', !pick.ok);
    }
  }

  paintSite(g, state) {
    const lot = this.sim && this.sim.state.lots && state.slotId ? this.sim.state.lots[state.slotId] : null;
    const ctx = this.siteCtx(state, lot, state.slotId || (state.buildingId || 'lot'));
    if (typeof Art.textureKey === 'function' && typeof Art.drawKeyed === 'function') {
      Art.drawKeyed(g, Art.textureKey(ctx), ctx);
      return;
    }
    Art.paintStructure(g, state.buildingId, state.rivalControlled);
  }

  goodKey(good) {
    const id = good ? good.id : 'crate';
    const key = 'go-good-' + id;
    if (this.textures.exists(key)) return key;
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 32;
    const g = c.getContext('2d');
    g.fillStyle = good && good.badgeBg ? good.badgeBg : '#333';
    g.beginPath();
    g.moveTo(8, 2);
    g.arcTo(30, 2, 30, 30, 8);
    g.arcTo(30, 30, 2, 30, 8);
    g.arcTo(2, 30, 2, 2, 8);
    g.arcTo(2, 2, 30, 2, 8);
    g.closePath();
    g.fill();
    g.strokeStyle = good && good.badgeInk ? good.badgeInk : '#fff';
    g.lineWidth = 2.4;
    g.beginPath();
    const raw = good && (good.category === 'raw' || good.category === 'legal');
    if (raw) {
      g.ellipse(16, 17, 6, 10, -0.7, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.moveTo(16, 7);
      g.lineTo(16, 26);
    } else {
      g.rect(8, 8, 16, 16);
      g.stroke();
      g.beginPath();
      g.moveTo(8, 14);
      g.lineTo(24, 14);
    }
    g.stroke();
    this.textures.addCanvas(key, c);
    return key;
  }

  rigKey(kind) {
    const key = kind === 'mule' ? 'go-rig-mule' : 'go-rig-truck';
    if (this.textures.exists(key)) return key;
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 36;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(16,12,8,0.28)';
    g.beginPath();
    g.ellipse(32, 24, 22, 8, 0, 0, Math.PI * 2);
    g.fill();
    if (kind === 'mule') {
      g.fillStyle = '#8a5a32';
      g.beginPath();
      g.ellipse(28, 16, 14, 8, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#c4a574';
      g.beginPath();
      g.arc(46, 14, 6, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#5c3a22';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(18, 20);
      g.lineTo(14, 28);
      g.moveTo(36, 20);
      g.lineTo(40, 28);
      g.stroke();
    } else {
      g.fillStyle = '#c4b08a';
      g.fillRect(8, 10, 28, 14);
      g.fillStyle = '#3d4c63';
      g.fillRect(36, 8, 16, 16);
      g.fillStyle = '#8ec4d4';
      g.fillRect(42, 11, 7, 5);
      g.fillStyle = '#1c140e';
      g.beginPath();
      g.arc(18, 25, 4, 0, Math.PI * 2);
      g.arc(40, 25, 4, 0, Math.PI * 2);
      g.fill();
    }
    this.textures.addCanvas(key, c);
    return key;
  }

  syncTrucks() {
    const live = new Set();
    this.flow.clear();
    this.paintRoutes();
    for (const truck of this.sim.state.activeTrucks) {
      live.add(String(truck.id));
      const good = GOODS[truck.goodId];
      const mule = !!(good && (good.category === 'raw' || good.category === 'legal'));
      let node = this.trucks[truck.id];
      if (!node) {
        const root = this.add.container(truck.x, truck.y).setDepth(9);
        const rig = this.add.image(0, 0, this.rigKey(mule ? 'mule' : 'truck')).setOrigin(0.5, 0.55).setScale(1.7);
        root.add([rig]);
        node = { root, rig, mule, tag: null };
        this.trucks[truck.id] = node;
      }
      if (node.mule !== mule) {
        node.mule = mule;
        node.rig.setTexture(this.rigKey(mule ? 'mule' : 'truck'));
      }
      node.root.setPosition(truck.x, truck.y);
      node.rig.setRotation(truck.heading || 0);
      this.placeCargo(node, good, truck);
    }
    for (const [id, node] of Object.entries(this.trucks)) {
      if (!live.has(id)) {
        if (node.tag) node.tag.remove();
        node.root.destroy();
        delete this.trucks[id];
      }
    }
  }

  placeCargo(node, good, truck) {
    if (!node.tag) {
      const el = document.createElement('div');
      el.className = 'go-cargo';
      this.pinHost.appendChild(el);
      node.tag = el;
    }
    const el = node.tag;
    const spot = this.worldToScreen(truck.x, truck.y - 20);
    const vw = this.scale.width;
    const vh = this.scale.height;
    if (spot.x < 4 || spot.y < 40 || spot.x > vw - 4 || spot.y > vh - 40) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const ink = good && good.badgeInk ? good.badgeInk : '#9ce6a8';
    const bg = good && good.badgeBg ? good.badgeBg : '#274d2e';
    const url = this.goodURL(good);
    const qty = Math.max(1, Math.round(truck.qty || 1));
    el.dataset.qty = String(qty);
    el.style.backgroundColor = ink;
    el.style.backgroundImage = url ? `url(${url})` : '';
    el.style.boxShadow = `0 1px 2px rgba(0,0,0,0.45), inset 0 0 0 2px ${bg}`;
    el.title = good ? good.shortName : '';
    el.style.transform = `translate(${Math.round(spot.x - 16)}px, ${Math.round(spot.y - 38)}px)`;
  }

  goodURL(good) {
    const id = good ? good.id : 'crate';
    if (!this.goodURLs) this.goodURLs = {};
    if (this.goodURLs[id]) return this.goodURLs[id];
    const key = this.goodKey(good);
    const source = this.textures.get(key).getSourceImage();
    this.goodURLs[id] = source && source.toDataURL ? source.toDataURL() : '';
    return this.goodURLs[id];
  }

  chainPath(fromId, toId) {
    if (!this.chainPaths) this.chainPaths = {};
    const key = fromId + '>' + toId;
    if (this.chainPaths[key]) return this.chainPaths[key];
    const start = BUILD_SLOTS.find((slot) => slot.id === fromId);
    const path = start ? [{ x: start.x, y: start.y }, ...findRoadPath(fromId, toId)] : [];
    this.chainPaths[key] = path;
    return path;
  }

  paintRoutes() {
    const g = this.flow;
    const slots = this.sim.state.slots;
    const trucks = this.sim.state.activeTrucks || [];
    const hot = new Set(trucks.map((truck) => `${truck.fromSlotId}>${truck.toSlotId}`));
    const legs = [
      ['slot_rp_farm1', 'slot_rp_barn1'],
      ['slot_rp_barn1', 'slot_rp_wh1'],
      ['slot_rp_wh1', 'slot_rp_pier']
    ];
    const cursor = (this.phase * 42) % 56;
    for (const [from, to] of legs) {
      if (!slots[from] || !slots[from].buildingId || !slots[to] || !slots[to].buildingId) continue;
      const path = this.chainPath(from, to);
      if (path.length < 2) continue;
      const live = hot.has(`${from}>${to}`) || hot.has(`${to}>${from}`);
      const guiding = !!(this.registry.get('guide') && this.registry.get('guide').live);
      if (!live && guiding) continue;
      g.lineStyle(live ? 7 : 3, live ? 0xf4d35e : 0x58a6ff, live ? 0.9 : 0.14);
      for (let i = 0; i < path.length - 1; i++) g.lineBetween(path[i].x, path[i].y, path[i + 1].x, path[i + 1].y);
      if (!live) continue;
      let travel = cursor;
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i];
        const b = path[i + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        while (travel < len) {
          const t = travel / len;
          g.fillStyle(0xfff4d2, 0.95);
          g.fillCircle(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 4.5);
          travel += 48;
        }
        travel -= len;
      }
    }
    for (const truck of trucks) {
      if (!truck.path || !truck.path.length) continue;
      const good = GOODS[truck.goodId];
      g.lineStyle(4, good ? good.color : 0xf4d35e, 0.95);
      let prev = { x: truck.x, y: truck.y };
      for (let i = truck.pathIndex || 0; i < truck.path.length; i++) {
        const next = truck.path[i];
        g.lineBetween(prev.x, prev.y, next.x, next.y);
        prev = next;
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
    if (typeof Art.paintAmbient === 'function') Art.paintAmbient(this, g);
    if (this.sim.state.weather === 'rain') {
      const view = this.cameras.main.worldView;
      g.lineStyle(1, 0xc5d4e0, 0.35);
      const spanW = view.width + 24;
      const spanH = view.height + 24;
      for (let i = 0; i < 80; i++) {
        const x = view.x + ((i * 97 + this.phase * 240) % spanW);
        const y = view.y + ((i * 53 + this.phase * 520) % spanH);
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
    const view = this.cameras.main.worldView;
    const pad = 12;
    this.sky.fillRect(view.x - pad, view.y - pad, view.width + pad * 2, view.height + pad * 2);
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
    if (spot.x < -20 || spot.y < -20 || spot.x > vw + 20 || spot.y > vh + 20) {
      el.hidden = true;
      return false;
    }
    el.hidden = false;
    el.style.transform = 'translate(0px, 0px)';
    const w = el.offsetWidth || 80;
    const h = el.offsetHeight || 28;
    const hud = document.querySelector('.go-subhud');
    const hudBottom = hud ? hud.getBoundingClientRect().bottom : 0;
    const topLimit = Math.max(48, hudBottom + 6);
    const bottomLimit = this.bottomLimit(vh);
    let left = spot.x - w / 2;
    let top = spot.y - h;
    left = Math.max(8, Math.min(Math.max(8, vw - w - 8), left));
    top = Math.max(topLimit, Math.min(Math.max(topLimit, bottomLimit - h), top));
    const cleared = this.clearOfChrome(left, top, w, h, topLimit, bottomLimit);
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
      const ghost = this.add.graphics().setAlpha(0.62);
      const valid = this.add.graphics();
      const ring = this.add.graphics();
      const pin = document.createElement('div');
      pin.className = 'go-mark';
      pin.innerHTML = PIN_MARK;
      pin.hidden = true;
      this.pinHost.appendChild(pin);
      root.add([select, valid, hit, art, ghost, ring]);
      root.setDepth(4);
      this.lots[id] = { id, pos, root, hit, select, art, ghost, valid, ring, pin, key: '', ghostKey: '', phase: '', demoMax: 0, buildMax: 0, hammer: 0, wasBuilding: false, pop: 0 };
    }
  }

  createZoneMarks() {
    for (const id of Object.keys(ZONE_LAYOUT)) {
      const spot = zoneCenter(id);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'go-zone';
      el.innerHTML = '<svg class="go-glyph go-glyph-lock" viewBox="0 0 20 20" aria-hidden="true"><rect x="5" y="9" width="10" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9" fill="none" stroke="currentColor" stroke-width="1.6"/></svg><strong></strong><span></span>';
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
    const b = this.unlockedRect();
    const key = `${Math.round(b.x)}|${Math.round(b.y)}|${Math.round(b.w)}|${Math.round(b.h)}`;
    if (key === this.boundsKey) return;
    this.boundsKey = key;
    this.cameras.main.setBounds(b.x, b.y, b.w, b.h);
  }

  revealMap() {
    this.userPanned = true;
    this.applyBounds();
    const cam = this.cameras.main;
    const phone = this.scale.width < 800;
    const fit = Math.min(this.scale.width / MAP_W, (this.scale.height - 120) / MAP_H);
    const zoom = phone ? 0.46 : window.Phaser.Math.Clamp(fit * 0.98, 0.24, 0.42);
    const x = phone ? 2400 : MAP_W / 2;
    const y = phone ? 1500 : 1340;
    cam.setZoom(zoom);
    cam.centerOn(x, y);
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
    const x = box.focusX != null ? box.focusX : box.x + box.w / 2;
    const y = box.focusY != null ? box.focusY : box.y + box.h / 2;
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

  fillPoly(g, poly) {
    g.beginPath();
    g.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) g.lineTo(poly[i][0], poly[i][1]);
    g.closePath();
    g.fillPath();
  }

  strokePoly(g, poly) {
    g.beginPath();
    g.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) g.lineTo(poly[i][0], poly[i][1]);
    g.closePath();
    g.strokePath();
  }

  dashPoly(g, poly, dash, gap, width, color, alpha) {
    if (!poly || poly.length < 2) return;
    g.lineStyle(width, color, alpha);
    const pts = poly.concat([poly[0]]);
    for (let i = 0; i < pts.length - 1; i += 1) {
      const x0 = pts[i][0];
      const y0 = pts[i][1];
      const x1 = pts[i + 1][0];
      const y1 = pts[i + 1][1];
      const len = Math.hypot(x1 - x0, y1 - y0) || 1;
      let dist = 0;
      let draw = true;
      while (dist < len) {
        const step = Math.min(draw ? dash : gap, len - dist);
        const a = dist / len;
        const b = (dist + step) / len;
        if (draw) {
          g.beginPath();
          g.moveTo(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a);
          g.lineTo(x0 + (x1 - x0) * b, y0 + (y1 - y0) * b);
          g.strokePath();
        }
        dist += step;
        draw = !draw;
      }
    }
  }

  veilZone(g, poly, alpha) {
    if (!poly || poly.length < 3 || alpha < 0.02) return;
    const haze = Math.max(0.08, Math.min(0.2, 0.16 * alpha));
    g.fillStyle(0xb7c2ae, haze);
    this.fillPoly(g, poly);
    g.lineStyle(14, 0xe7fff3, 0.22 * alpha);
    this.strokePoly(g, poly);
    this.dashPoly(g, poly, 34, 18, 4, 0xf4fff6, Math.min(1, alpha));
  }

  syncFog(view) {
    const g = this.zoneFog;
    if (!g) return;
    g.clear();
    const core = !view || view.coreMode !== false;
    for (const zone of view.zones) {
      const box = ZONE_LAYOUT[zone.id];
      if (!box || !box.poly) continue;
      const target = zone.unlocked ? 0 : 1;
      const prev = this.fogAlpha[zone.id] == null ? target : this.fogAlpha[zone.id];
      const next = prev + (target - prev) * 0.08;
      this.fogAlpha[zone.id] = Math.abs(next - target) < 0.02 ? target : next;
      if (this.fogAlpha[zone.id] > 0.02) this.veilZone(g, softEdge(box.poly), this.fogAlpha[zone.id]);
    }
    if (!core) {
      for (const reg of REGIONS) {
        if (!reg.unlockCostClean) continue;
        const state = this.sim.state.regions[reg.id];
        if (!state || state.unlocked) continue;
        const poly = DISTRICT_EDGE[reg.id];
        if (poly) this.veilZone(g, softEdge(poly), 0.7);
      }
    }
    if (this.registry.get('showControl')) {
      for (const zone of view.zones) {
        if (!zone.unlocked) continue;
        const box = ZONE_LAYOUT[zone.id];
        if (!box || !box.poly) continue;
        g.fillStyle(0x58a6ff, 0.12);
        this.fillPoly(g, softEdge(box.poly));
      }
    }
  }

  veil(g, x, y, w, h, alpha) {
    if (alpha <= 0.02) return;
    g.fillStyle(0x121816, 0.38 * alpha);
    g.fillRect(x, y, w, h);
    g.fillStyle(0x1c2820, 0.16 * alpha);
    g.fillEllipse(x + w * 0.5, y + h * 0.5, w * 0.92, h * 0.86);
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
      const juice = this.registry.get('juice');
      if (live.phase === 'demolishing' && node.phase !== 'demolishing') {
        if (juice && juice.shake) juice.shake(220, 0.003);
        if (juice && juice.demolishDust) juice.demolishDust({ x: node.pos.x, y: node.pos.y });
      } else if (live.phase === 'building' && node.phase !== 'building') {
        if (juice && juice.burst) juice.burst({ x: node.pos.x, y: node.pos.y }, 0xc4a574);
      }
      if (live.phase === 'building') {
        node.hammer += 0.016;
        if (node.hammer > 1.3) {
          node.hammer = 0;
          if (juice && juice.burst) juice.burst({ x: node.pos.x, y: node.pos.y - 20 }, 0xc4a574);
        }
      }
      const ctx = this.siteCtx({ buildingId: live.buildingId, level: live.level, rivalControlled: lot.owner === 'rival' }, live, node.id);
      if (typeof Art.textureKey === 'function' && typeof Art.drawKeyed === 'function') {
        const key = Art.textureKey(ctx);
        if (key !== node.key || live.phase === 'building' || live.phase === 'demolishing') {
          node.key = key;
          Art.drawKeyed(node.art, key, ctx);
        }
      } else if (live.phase === 'demolishing' || live.phase === 'building') {
        node.key = '';
      } else if (live.buildingId && live.phase === 'operating') {
        if (node.key !== 'b:' + live.buildingId) {
          node.key = 'b:' + live.buildingId;
          this.paintSite(node.art, { buildingId: live.buildingId, rivalControlled: false, level: live.level || 1, progress: 1, slotId: node.id });
        }
      } else if (lot.kind === 'open') {
        if (node.key !== 'open') {
          node.key = 'open';
          paintOpen(node.art);
        }
      } else if (lot.propertyType && node.key !== 'p:' + lot.propertyType) {
        node.key = 'p:' + lot.propertyType;
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
      const constructing = live.phase === 'building';
      const buildingNow = constructing || live.phase === 'demolishing';
      this.noteBuild(node, buildingNow, live.phase === 'demolishing' ? (live.demolishLeft || 0) : (live.constructLeft || 0), node.pos, live.buildingId, constructing);
      node.phase = live.phase;
      const ghost = this.registry.get('ghost');
      const showGhost = ghost && ghost.lotId === node.id && ghost.buildingId && live.phase !== 'building' && live.phase !== 'demolishing';
      node.ghost.setVisible(!!showGhost);
      const ghostSprite = node.ghost.getData && node.ghost.getData('sprite');
      if (ghostSprite) ghostSprite.setVisible(!!showGhost);
      node.valid.clear();
      if (showGhost) {
        if (node.ghostKey !== ghost.buildingId) {
          node.ghostKey = ghost.buildingId;
          const ghostCtx = this.siteCtx({ buildingId: ghost.buildingId, level: 1 }, { phase: 'operating', owned: true, buildingId: ghost.buildingId }, node.id + ':ghost');
          if (typeof Art.drawKeyed === 'function') Art.drawKeyed(node.ghost, Art.textureKey(ghostCtx), ghostCtx);
        }
        const sprite = node.ghost.getData && node.ghost.getData('sprite');
        if (sprite) {
          sprite.setVisible(true);
          sprite.setAlpha(0.72);
        }
        node.valid.lineStyle(3, 0x58a6ff, 0.95);
        node.valid.strokeEllipse(0, 12, 160, 72);
      }
      const rel = zoom / this.valleyZoom();
      const close = rel >= 1.15 || this.nearPoint(node.pos.x, node.pos.y, 150) || lot.recommended;
      let icon = null;
      let status = 'is-idle';
      if (live.phase === 'building' || live.phase === 'demolishing') status = 'is-build';
      else if (lot.kind === 'open') status = 'is-plus';
      else if (live.buildingId) icon = iconKeyForBuilding(live.buildingId);
      else if (live.role) icon = iconKeyForRole(live.role);
      else if (lot.propertyType) icon = iconKeyForProperty(lot.propertyType);
      const showIcon = !locked && close && (status === 'is-build' || status === 'is-plus' || !!icon);
      if (!showIcon) node.pin.hidden = true;
      else this.placeBadge(node, node.pos.x, node.pos.y, icon, status, '');
    }
  }

  shortZone(zone) {
    const name = zone.name || '';
    if (name.indexOf('Puerto Sol ') === 0) return name.slice('Puerto Sol '.length);
    if (name === 'Río Plata Valley') return 'Río Plata';
    return name;
  }

  syncZoneChrome(view) {
    const open = !!this.sim.state.mapOpen;
    const zoomedOut = this.cameras.main.zoom < 0.42;
    for (const zone of view.zones) {
      const mark = this.zoneMarks[zone.id];
      if (!mark) continue;
      mark.area.hidden = true;
      if (!mark.lock) {
        const lock = document.createElement('div');
        lock.className = 'go-lock';
        lock.hidden = true;
        lock.innerHTML = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><rect x="5" y="9" width="10" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9" fill="none" stroke="currentColor" stroke-width="1.8"/></svg><b></b>';
        lock.addEventListener('click', () => {
          const id = lock.dataset.zone;
          const fn = this.registry.get('onZoneSelected');
          if (id && fn) fn(id);
        });
        this.pinHost.appendChild(lock);
        mark.lock = lock;
      }
      const affordable = !zone.blockers || zone.blockers.length === 0;
      const show = open && zoomedOut && (zone.unlocked || affordable);
      mark.el.hidden = !show;
      const spot = this.worldToScreen(mark.x, mark.y);
      const onScreen = spot.x > 24 && spot.y > 48 && spot.x < this.scale.width - 24 && spot.y < this.scale.height - 64;
      const price = !zone.unlocked && zone.unlock ? zone.unlock.clean : 0;
      const priceEl = mark.lock.querySelector('b');
      if (priceEl) {
        priceEl.hidden = !price;
        priceEl.textContent = price ? `$${Number(price).toLocaleString()}` : '';
      }
      mark.lock.dataset.zone = zone.id;
      const core = !view || view.coreMode !== false;
      const badge = !zone.unlocked && onScreen && (!core || zone.id === 'jungle_alta');
      mark.lock.hidden = !badge;
      if (!mark.lock.hidden) {
        const shift = price ? 36 : 12;
        mark.lock.style.transform = `translate(${Math.round(spot.x - shift)}px, ${Math.round(spot.y - 14)}px)`;
      }
      if (!show) continue;
      mark.el.classList.toggle('is-locked', !zone.unlocked);
      const strong = mark.el.querySelector('strong');
      const span = mark.el.querySelector('span');
      strong.hidden = false;
      strong.textContent = this.shortZone(zone);
      if (!zone.unlocked && zone.unlock && zone.unlock.clean) {
        span.hidden = false;
        span.textContent = `$${zone.unlock.clean}`;
      } else {
        span.hidden = true;
        span.textContent = '';
      }
      const box = ZONE_LAYOUT[zone.id];
      this.placeFree(mark.el, box.x + box.w * 0.5, box.y + 48);
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
      } else if (evt.type === 'built' || evt.type === 'build_started') {
        const id = evt.slotId || evt.lotId;
        const built = evt.buildingId && BUILDINGS[evt.buildingId];
        const lot = id && this.sim.state.lots ? this.sim.state.lots[id] : null;
        const open = !!(lot && lot.kind === 'open');
        if (built && id && this.slots[id]) {
          const dirty = open ? Math.round(built.buildCostDirty * 0.85) : built.buildCostDirty;
          const clean = open ? Math.round(built.buildCostClean * 0.85) : built.buildCostClean;
          if (dirty) j.cashPop(id, -dirty, 'dirty');
          if (clean) j.cashPop(id, -clean, 'clean');
        }
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
