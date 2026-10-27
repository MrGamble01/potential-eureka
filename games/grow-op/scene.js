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
import { REGIONS, BUILD_SLOTS, ROAD_NETWORK } from './data/missions.js';
import { DISTRICT_EDGE, LOT_POS, MAP_H, MAP_W, ZONE_LAYOUT, zoneCenter } from './map-layout.js';
import { drawExtended, paintOpen, paintProperty } from './map-draw.js';
import { artURL, iconKeyForBuilding, iconKeyForProperty, iconKeyForRole } from './art-keys.js';
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
      pin.innerHTML = PIN_MARK;
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
    if (!this.sim || !this.sim.state.mapOpen) return { x: 0, y: 0, w: WORLD_W, h: WORLD_H };
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
    this.syncLife(dt);
    this.syncSky();
    this.syncFloaters(dt);
    this.syncWorld(dt);
    this.syncTip();
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
    if (!this.hover) {
      tip.hidden = true;
      return;
    }
    let best = null;
    let bestD = 80;
    const nodes = [...Object.values(this.slots), ...Object.values(this.lots)];
    for (const node of nodes) {
      const x = node.def ? node.def.x : node.pos.x;
      const y = node.def ? node.def.y : node.pos.y;
      const d = Math.hypot(this.hover.x - x, this.hover.y - y);
      if (d < bestD && node.pin && !node.pin.hidden && node.pin.title) {
        best = { x, y, title: node.pin.title };
        bestD = d;
      }
    }
    if (!best) {
      tip.hidden = true;
      return;
    }
    const spot = this.worldToScreen(best.x, best.y - 96);
    tip.hidden = false;
    tip.textContent = best.title;
    tip.style.transform = `translate(${Math.round(spot.x)}px, ${Math.round(spot.y)}px)`;
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
    for (const [id, node] of Object.entries(this.slots)) {
      const state = this.sim.state.slots[id];
      if (!state) continue;
      const lot = this.sim.state.lots && this.sim.state.lots[id];
      const phase = lot ? lot.phase : '';
      node.select.setVisible(id === selected);
      node.raid.setVisible(!supplyOnly && !!state.raidLocked);
      if (node.raid.visible) node.raid.setAlpha(0.45 + Math.sin(this.phase * 6) * 0.35);
      const built = !!state.buildingId && !state.rivalControlled;
      const marked = id === recommend || id === this.recommendId();
      node.pulse.setVisible(!built && !state.rivalControlled && marked);
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
      const working = (state.progress || 0) > 0.04 || Object.values(state.outputBuffer || {}).some((qty) => qty > 0);
      if (phase === 'building' || phase === 'demolishing') {
        this.placeBadge(node, node.def.x, node.def.y, null, 'is-build', built ? BUILDINGS[state.buildingId].shortName : 'Build');
      } else if (built) {
        const def = BUILDINGS[state.buildingId];
        this.placeBadge(node, node.def.x, node.def.y, iconKeyForBuilding(state.buildingId), working ? 'is-work' : 'is-idle', def ? def.shortName : '');
        if (state.buildingId === 'drying_barn' || state.buildingId === 'chem_lab' || state.buildingId === 'packaging_mill' || state.buildingId === 'coffee_estate') {
          if (Math.random() < 0.08) this.puff(node.def.x + 30, node.def.y - 70);
        }
      } else if (!state.rivalControlled && marked) {
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
      constructLeft: lot ? lot.constructLeft || 0 : 0,
      demolishLeft: lot ? lot.demolishLeft || 0 : 0
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

  paintSite(g, state) {
    const lot = this.sim && this.sim.state.lots && state.slotId ? this.sim.state.lots[state.slotId] : null;
    const ctx = this.siteCtx(state, lot, state.slotId || (state.buildingId || 'lot'));
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
    this.paintRoutes();
    for (const [id, node] of Object.entries(this.trucks)) {
      if (!live.has(Number(id))) {
        node.root.destroy();
        delete this.trucks[id];
      }
    }
  }

  paintRoutes() {
    const g = this.flow;
    const paths = [
      [{ x: 280, y: 460 }, { x: 450, y: 460 }, { x: 640, y: 440 }],
      [{ x: 640, y: 440 }, { x: 450, y: 460 }, { x: 450, y: 700 }],
      [{ x: 450, y: 700 }, { x: 280, y: 960 }]
    ];
    let cursor = (this.phase * 42) % 64;
    for (const path of paths) {
      g.lineStyle(5, 0x58a6ff, 0.22);
      for (let i = 0; i < path.length - 1; i++) g.lineBetween(path[i].x, path[i].y, path[i + 1].x, path[i + 1].y);
      let travel = cursor;
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i];
        const b = path[i + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        while (travel < len) {
          const t = travel / len;
          const x = a.x + (b.x - a.x) * t;
          const y = a.y + (b.y - a.y) * t;
          g.fillStyle(0x8ec5ff, 0.95);
          g.fillCircle(x, y, 4.5);
          g.fillTriangle(
            x + Math.cos(ang) * 9, y + Math.sin(ang) * 9,
            x + Math.cos(ang + 2.4) * 6, y + Math.sin(ang + 2.4) * 6,
            x + Math.cos(ang - 2.4) * 6, y + Math.sin(ang - 2.4) * 6
          );
          travel += 64;
        }
        travel -= len;
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
      const pin = document.createElement('div');
      pin.className = 'go-mark';
      pin.innerHTML = PIN_MARK;
      pin.hidden = true;
      this.pinHost.appendChild(pin);
      root.add([select, valid, hit, art, ghost]);
      root.setDepth(4);
      this.lots[id] = { id, pos, root, hit, select, art, ghost, valid, pin, key: '', ghostKey: '', phase: '', demoMax: 0, buildMax: 0, hammer: 0 };
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

  veilZone(g, poly, alpha) {
    if (!poly || poly.length < 3 || alpha < 0.02) return;
    g.fillStyle(0x1a221c, 0.34 * alpha);
    this.fillPoly(g, poly);
    g.lineStyle(28, 0x101612, 0.22 * alpha);
    this.strokePoly(g, poly);
  }

  dashZone(g, poly, alpha) {
    if (!poly || poly.length < 3 || alpha < 0.02) return;
    g.lineStyle(5, 0xc5d6b0, 0.1 * alpha);
    this.strokePoly(g, poly);
    g.lineStyle(1.5, 0xe7f2df, 0.42 * alpha);
    const dash = 16;
    const gap = 12;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      let walked = 0;
      while (walked < len) {
        const end = Math.min(len, walked + dash);
        g.lineBetween(
          a[0] + (dx * walked) / len,
          a[1] + (dy * walked) / len,
          a[0] + (dx * end) / len,
          a[1] + (dy * end) / len
        );
        walked += dash + gap;
      }
    }
  }

  syncFog(view) {
    const g = this.zoneFog;
    if (!g) return;
    g.clear();
    const chart = this.chartAlpha;
    for (const zone of view.zones) {
      const box = ZONE_LAYOUT[zone.id];
      if (!box || !box.poly) continue;
      const target = zone.unlocked ? 0 : 1;
      const prev = this.fogAlpha[zone.id] == null ? target : this.fogAlpha[zone.id];
      const next = prev + (target - prev) * 0.08;
      this.fogAlpha[zone.id] = Math.abs(next - target) < 0.02 ? target : next;
      const edge = softEdge(box.poly);
      if (!zone.starter && chart > 0.02) this.veilZone(g, edge, chart * 0.85);
      if (this.fogAlpha[zone.id] > 0.02 && chart < 0.85) this.veilZone(g, edge, this.fogAlpha[zone.id] * 0.72);
      const ink = this.fogAlpha[zone.id] > 0.15 ? 0.42 + this.fogAlpha[zone.id] * 0.28 : 0.28;
      this.dashZone(g, edge, ink * (1 - chart * 0.45));
    }
    for (const reg of REGIONS) {
      if (!reg.unlockCostClean) continue;
      const state = this.sim.state.regions[reg.id];
      if (!state || state.unlocked) continue;
      const poly = DISTRICT_EDGE[reg.id];
      if (poly) this.veilZone(g, softEdge(poly), 0.7);
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
      node.phase = live.phase;
      if (live.phase !== 'building') node.root.setScale(1);
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
      else this.placeBadge(node, node.pos.x, node.pos.y, icon, status, lot.propertyLabel || lot.label || '');
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
    const zoomedOut = this.cameras.main.zoom / this.valleyZoom() < 0.72;
    for (const zone of view.zones) {
      const mark = this.zoneMarks[zone.id];
      if (!mark) continue;
      mark.area.hidden = true;
      const affordable = !zone.blockers || zone.blockers.length === 0;
      const show = open && zoomedOut && (zone.unlocked || affordable);
      mark.el.hidden = !show;
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
