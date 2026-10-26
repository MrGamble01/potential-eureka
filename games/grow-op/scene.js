// Grow Op: San Verde '84 — Phaser 3 Regional Map & Logistics Scene
// Renders the warm dusty 1980s Latin American region, terrain contours, rivers, road network,
// interactive building compounds, progress rings, cargo trucks, lieutenant tokens, and raid sirens.

import { GOODS } from './data/goods.js';
import { BUILDINGS } from './data/buildings.js';
import { REGIONS, BUILD_SLOTS, ROAD_NETWORK, LIEUTENANTS } from './data/missions.js';

export const WORLD_W = 2300;
export const WORLD_H = 920;

export class MapScene extends window.Phaser.Scene {
  constructor() {
    super({ key: 'MapScene' });
    this.slotContainers = {};
    this.truckContainers = {};
    this.regionOverlays = {};
    this.ltBadges = {};
    this.isDragging = false;
    this.dragMoved = false;
    this.dragStart = { x: 0, y: 0, scrollX: 0, scrollY: 0 };
    this.pinchDist = null;
    this.pulsePhase = 0;
  }

  create() {
    this.sim = this.registry.get('sim');
    this.onSlotSelected = this.registry.get('onSlotSelected') || (() => {});
    this.onRegionSelected = this.registry.get('onRegionSelected') || (() => {});

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setBackgroundColor('#24211b');

    // Layers
    this.terrainLayer = this.add.layer();
    this.roadLayer = this.add.layer();
    this.flowLineLayer = this.add.graphics();
    this.slotLayer = this.add.layer();
    this.truckLayer = this.add.layer();
    this.fxLayer = this.add.layer();

    this.drawRegionalTerrain();
    this.drawRoads();
    this.createSlotNodes();
    this.setupCameraControls();

    // Center camera initially on Río Plata Valley & San Marco border
    this.focusOnSlot('slot_rp_wh1', true);
  }

  drawRegionalTerrain() {
    const g = this.add.graphics();
    this.terrainLayer.add(g);

    // Base warm dusty 1980s paper/ochre tabletop background
    g.fillStyle(0x2a251d, 1);
    g.fillRect(0, 0, WORLD_W, WORLD_H);

    // Topographic contour patches (warm dusty olive, ochre, terracotta, highland slate)
    const contours = [
      { x: 430, y: 420, rx: 380, ry: 310, color: 0x3b4229, alpha: 0.75 },
      { x: 360, y: 340, rx: 250, ry: 200, color: 0x485432, alpha: 0.65 },
      { x: 1150, y: 430, rx: 390, ry: 310, color: 0x423a29, alpha: 0.75 },
      { x: 1180, y: 390, rx: 260, ry: 210, color: 0x4f4531, alpha: 0.65 },
      { x: 1840, y: 430, rx: 360, ry: 310, color: 0x383e32, alpha: 0.8 },
      { x: 1880, y: 360, rx: 240, ry: 195, color: 0x444d3b, alpha: 0.65 }
    ];
    for (const c of contours) {
      g.fillStyle(c.color, c.alpha);
      g.fillEllipse(c.x, c.y, c.rx * 2, c.ry * 2);
    }

    // Subtle topographic grid lines for cartel war-room map feel
    g.lineStyle(1, 0xded0b6, 0.06);
    for (let x = 80; x < WORLD_W; x += 80) {
      g.lineBetween(x, 0, x, WORLD_H);
    }
    for (let y = 80; y < WORLD_H; y += 80) {
      g.lineBetween(0, y, WORLD_W, y);
    }

    // Southern Caribbean / Río Plata River & Coastline
    g.fillStyle(0x1b3b48, 1);
    g.beginPath();
    g.moveTo(0, 690);
    g.lineTo(380, 650);
    g.lineTo(750, 710);
    g.lineTo(1260, 675);
    g.lineTo(1680, 735);
    g.lineTo(WORLD_W, 715);
    g.lineTo(WORLD_W, WORLD_H);
    g.lineTo(0, WORLD_H);
    g.closePath();
    g.fillPath();

    // River tributary snaking up into Río Plata Valley
    g.lineStyle(26, 0x1b3b48, 1);
    g.beginPath();
    g.moveTo(280, 680);
    g.lineTo(220, 520);
    g.lineTo(160, 340);
    g.lineTo(130, 140);
    g.strokePath();

    g.lineStyle(2, 0x4fa3bd, 0.35);
    g.beginPath();
    g.moveTo(0, 690);
    g.lineTo(380, 650);
    g.lineTo(750, 710);
    g.lineTo(1260, 675);
    g.lineTo(1680, 735);
    g.lineTo(WORLD_W, 715);
    g.strokePath();

    // Decorative 1980s palm / scrub clusters & mountain ridges (pure geometric vector shapes)
    const scrubPoints = [
      [190, 230], [360, 190], [570, 210], [560, 480], [740, 440],
      [890, 210], [1040, 195], [1280, 220], [930, 560], [1420, 530],
      [1590, 200], [1780, 195], [2040, 250], [1610, 600], [2090, 440]
    ];
    for (const [sx, sy] of scrubPoints) {
      g.fillStyle(0x2d3b22, 0.8);
      g.fillCircle(sx, sy, 14);
      g.fillStyle(0x526b3d, 0.85);
      g.fillCircle(sx - 3, sy - 3, 10);
      g.fillStyle(0x6b8a4f, 0.7);
      g.fillCircle(sx + 5, sy + 2, 7);
    }

    // Region borders, headers, and town plazas
    for (const reg of REGIONS) {
      const { x, y, w, h } = reg.bounds;
      const borderG = this.add.graphics();
      this.terrainLayer.add(borderG);

      // Region frame
      borderG.lineStyle(2, reg.borderColor, 0.38);
      borderG.strokeRoundedRect(x, y, w, h, 18);

      // Region header banner on the map
      const headerBg = this.add.rectangle(x + w / 2, y + 28, 280, 38, 0x161920, 0.84);
      headerBg.setStrokeStyle(1.5, reg.borderColor, 0.55);
      headerBg.setInteractive({ useHandCursor: true });
      headerBg.on('pointerup', () => {
        if (!this.dragMoved) this.onRegionSelected(reg.id);
      });
      this.terrainLayer.add(headerBg);

      const titleTxt = this.add.text(x + w / 2, y + 21, reg.name.toUpperCase(), {
        fontFamily: 'Outfit, Inter, sans-serif',
        fontSize: '13px',
        fontStyle: '700',
        color: '#f2ece1',
        letterSpacing: 1.2
      }).setOrigin(0.5);
      this.terrainLayer.add(titleTxt);

      const subTxt = this.add.text(x + w / 2, y + 36, `${reg.townName} · Fertility ${Math.round(reg.fertilityBonus * 100)}%`, {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '10px',
        color: '#b8b0a2'
      }).setOrigin(0.5);
      this.terrainLayer.add(subTxt);

      // Locked region veil + Raid alert veil
      const lockOverlay = this.add.container(x + w / 2, y + h / 2);
      const veil = this.add.rectangle(0, 0, w - 8, h - 8, 0x0e1116, 0.52);
      veil.setStrokeStyle(2, 0x58a6ff, 0.45);
      veil.setInteractive({ useHandCursor: true });
      veil.on('pointerup', () => {
        if (!this.dragMoved) this.onRegionSelected(reg.id);
      });

      const lockBadge = this.add.rectangle(0, 0, 250, 68, 0x161b24, 0.94);
      lockBadge.setStrokeStyle(1.5, 0x58a6ff, 0.8);
      const lockTitle = this.add.text(0, -11, `UNLOCK ${reg.name.toUpperCase()}`, {
        fontFamily: 'Outfit, sans-serif',
        fontSize: '13px',
        fontStyle: '700',
        color: '#f2ece1'
      }).setOrigin(0.5);
      const lockCost = this.add.text(0, 12, `Tap to Expand Territory ($${reg.unlockCostClean} Clean Cash)`, {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '11px',
        color: '#79b8ff'
      }).setOrigin(0.5);

      lockOverlay.add([veil, lockBadge, lockTitle, lockCost]);
      this.slotLayer.add(lockOverlay);

      // Raid perimeter glow
      const raidRect = this.add.rectangle(x + w / 2, y + h / 2, w - 4, h - 4, 0xf85149, 0.08);
      raidRect.setStrokeStyle(3, 0xf85149, 0.85);
      raidRect.setVisible(false);
      this.fxLayer.add(raidRect);

      this.regionOverlays[reg.id] = {
        lockOverlay,
        raidRect,
        subTxt
      };
    }
  }

  drawRoads() {
    const rg = this.add.graphics();
    this.roadLayer.add(rg);

    // Outer dusty roadbed
    rg.lineStyle(14, 0x594936, 0.95);
    for (const path of ROAD_NETWORK) {
      for (let i = 0; i < path.length - 1; i++) {
        rg.lineBetween(path[i].x, path[i].y, path[i + 1].x, path[i + 1].y);
      }
    }

    // Inner compacted gravel surface
    rg.lineStyle(8, 0x8c765a, 0.9);
    for (const path of ROAD_NETWORK) {
      for (let i = 0; i < path.length - 1; i++) {
        rg.lineBetween(path[i].x, path[i].y, path[i + 1].x, path[i + 1].y);
      }
    }
  }

  createSlotNodes() {
    for (const slotDef of BUILD_SLOTS) {
      const container = this.add.container(slotDef.x, slotDef.y);

      // Selection halo
      const selectRing = this.add.ellipse(0, 4, 118, 86, 0x58a6ff, 0.12);
      selectRing.setStrokeStyle(2.5, 0x58a6ff, 0.95);
      selectRing.setVisible(false);

      // Raid siren halo
      const raidRing = this.add.ellipse(0, 4, 124, 92, 0xf85149, 0.22);
      raidRing.setStrokeStyle(3, 0xf85149, 1);
      raidRing.setVisible(false);

      // Compound base pad
      const pad = this.add.rectangle(0, 4, 96, 66, 0x363027, 0.95);
      pad.setStrokeStyle(2, 0x7a6c58, 0.85);
      pad.setInteractive({ useHandCursor: true });
      pad.on('pointerup', () => {
        if (!this.dragMoved) {
          this.sim.state.selectedSlotId = slotDef.id;
          this.sim.state.selectedRegionId = slotDef.regionId;
          this.onSlotSelected(slotDef.id);
        }
      });

      // Architectural graphic (drawn dynamically per building type)
      const buildingArt = this.add.graphics();

      // Cycle progress bar background + fill
      const progBg = this.add.rectangle(0, -34, 72, 6, 0x12151c, 0.9);
      const progFill = this.add.rectangle(-36, -34, 0, 4, 0x3ddc97, 1).setOrigin(0, 0.5);

      // Building name tag
      const nameTagBg = this.add.rectangle(0, 44, 118, 20, 0x13171f, 0.92);
      nameTagBg.setStrokeStyle(1, 0x384152, 0.8);
      const nameTxt = this.add.text(0, 44, slotDef.label, {
        fontFamily: 'Outfit, Inter, sans-serif',
        fontSize: '11px',
        fontStyle: '700',
        color: '#f0ebe1'
      }).setOrigin(0.5);

      // Stock / Output pill badge
      const stockBg = this.add.rectangle(0, 64, 108, 17, 0x1b222d, 0.92);
      stockBg.setStrokeStyle(1, 0x2f3b4c, 0.85);
      const stockTxt = this.add.text(0, 64, 'Empty Lot', {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '10px',
        color: '#9ca7b8'
      }).setOrigin(0.5);

      // Level pill
      const levelBadge = this.add.rectangle(40, -24, 28, 16, 0x1c2533, 0.95);
      levelBadge.setStrokeStyle(1, 0x58a6ff, 0.8);
      const levelTxt = this.add.text(40, -24, 'L1', {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '10px',
        fontStyle: '700',
        color: '#79b8ff'
      }).setOrigin(0.5);

      container.add([
        selectRing,
        raidRing,
        pad,
        buildingArt,
        progBg,
        progFill,
        nameTagBg,
        nameTxt,
        stockBg,
        stockTxt,
        levelBadge,
        levelTxt
      ]);

      this.slotLayer.add(container);
      this.slotContainers[slotDef.id] = {
        slotDef,
        container,
        selectRing,
        raidRing,
        pad,
        buildingArt,
        progBg,
        progFill,
        nameTxt,
        stockBg,
        stockTxt,
        levelBadge,
        levelTxt,
        lastKey: ''
      };
    }
  }

  drawBuildingArchitecture(g, slotState) {
    g.clear();
    if (slotState.rivalControlled) {
      // Rival Syndicate fortified compound
      g.fillStyle(0x4a2020, 1);
      g.fillRect(-36, -18, 72, 38);
      g.lineStyle(2, 0xf85149, 0.9);
      g.strokeRect(-36, -18, 72, 38);
      // Watchtower + crosshairs
      g.fillStyle(0x2b1212, 1);
      g.fillRect(-14, -12, 28, 24);
      g.lineStyle(2, 0xff7b72, 1);
      g.strokeCircle(0, 0, 9);
      g.lineBetween(-12, 0, 12, 0);
      g.lineBetween(0, -12, 0, 12);
      return;
    }

    if (!slotState.buildingId) {
      // Surveyed empty construction plot with dashed blueprint corners
      g.lineStyle(1.5, 0x8b949e, 0.45);
      g.strokeRect(-32, -16, 64, 36);
      g.lineStyle(2, 0x58a6ff, 0.75);
      g.lineBetween(-8, 2, 8, 2);
      g.lineBetween(0, -6, 0, 10);
      return;
    }

    const bDef = BUILDINGS[slotState.buildingId];
    if (!bDef) return;

    // 2.5D Isometric-style architectural compound with shadow, walls, roof & functional details
    // Drop shadow
    g.fillStyle(0x0d0f12, 0.45);
    g.fillRect(-35, -13, 76, 42);

    // Compound courtyard wall
    g.fillStyle(bDef.wallColor, 1);
    g.fillRect(-36, -18, 72, 38);
    g.lineStyle(1.5, 0x24201a, 0.85);
    g.strokeRect(-36, -18, 72, 38);

    if (bDef.role === 'producer') {
      // Plantation rows + barn roof
      g.fillStyle(0x2d4022, 1);
      g.fillRect(-32, -14, 42, 30);
      g.fillStyle(bDef.accentColor, 0.9);
      for (let ry = -10; ry <= 10; ry += 7) {
        g.fillRect(-29, ry, 36, 4);
      }
      // Farmhouse shed on right
      g.fillStyle(bDef.roofColor, 1);
      g.fillRect(12, -12, 20, 26);
      g.lineStyle(1, 0x1b2416, 0.9);
      g.strokeRect(12, -12, 20, 26);
    } else if (bDef.role === 'processor') {
      // Industrial pitched roof + ventilation stacks
      g.fillStyle(bDef.roofColor, 1);
      g.fillRect(-30, -13, 60, 28);
      g.lineStyle(1.5, bDef.accentColor, 0.9);
      g.strokeRect(-30, -13, 60, 28);
      // Skylights / Vats
      g.fillStyle(bDef.accentColor, 0.85);
      g.fillCircle(-12, 1, 6);
      g.fillCircle(12, 1, 6);
    } else if (bDef.role === 'warehouse' || bDef.role === 'logistics') {
      // Dual warehouse bays + loading dock stripes
      g.fillStyle(bDef.roofColor, 1);
      g.fillRect(-32, -14, 30, 28);
      g.fillRect(2, -14, 30, 28);
      g.fillStyle(bDef.accentColor, 0.9);
      g.fillRect(-26, 12, 18, 5);
      g.fillRect(8, 12, 18, 5);
    } else if (bDef.role === 'smuggling') {
      if (slotState.buildingId === 'aerodrome') {
        // Asphalt runway strip + center dashes + hangar
        g.fillStyle(0x2c323b, 1);
        g.fillRect(-38, -8, 76, 20);
        g.fillStyle(0xe6edf3, 0.9);
        for (let rx = -30; rx <= 26; rx += 14) {
          g.fillRect(rx, 1, 8, 2);
        }
        g.fillStyle(bDef.accentColor, 0.95);
        g.fillRect(-28, -18, 22, 10);
      } else {
        // River pier planks + speedboat berth
        g.fillStyle(0x1f4859, 1);
        g.fillRect(-34, -14, 68, 32);
        g.fillStyle(0x8c6d46, 1);
        g.fillRect(-10, -16, 20, 34);
        g.fillStyle(bDef.accentColor, 1);
        g.fillTriangle(18, -6, 30, 2, 18, 10);
      }
    } else if (bDef.role === 'launderer') {
      // Neo-colonial plaza front + neon/clean awning
      g.fillStyle(bDef.roofColor, 1);
      g.fillRect(-30, -14, 60, 28);
      g.fillStyle(bDef.accentColor, 0.95);
      g.fillRect(-26, -4, 52, 8);
      g.fillStyle(0xf2ece1, 0.9);
      g.fillCircle(0, 0, 5);
    }
  }

  setupCameraControls() {
    this.input.on('pointerdown', (pointer) => {
      this.isDragging = true;
      this.dragMoved = false;
      this.dragStart.x = pointer.x;
      this.dragStart.y = pointer.y;
      this.dragStart.scrollX = this.cameras.main.scrollX;
      this.dragStart.scrollY = this.cameras.main.scrollY;
    });

    this.input.on('pointermove', (pointer) => {
      // Pinch zoom on multi-touch
      if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
        const d = window.Phaser.Math.Distance.Between(
          this.input.pointer1.x,
          this.input.pointer1.y,
          this.input.pointer2.x,
          this.input.pointer2.y
        );
        if (this.pinchDist !== null) {
          const delta = (d - this.pinchDist) * 0.003;
          const nextZoom = window.Phaser.Math.Clamp(this.cameras.main.zoom + delta, 0.55, 1.55);
          this.cameras.main.setZoom(nextZoom);
        }
        this.pinchDist = d;
        this.dragMoved = true;
        return;
      }
      this.pinchDist = null;

      if (!this.isDragging || !pointer.isDown) return;
      const dx = pointer.x - this.dragStart.x;
      const dy = pointer.y - this.dragStart.y;
      if (Math.hypot(dx, dy) > 6) {
        this.dragMoved = true;
      }
      if (this.dragMoved) {
        const z = this.cameras.main.zoom;
        this.cameras.main.scrollX = this.dragStart.scrollX - dx / z;
        this.cameras.main.scrollY = this.dragStart.scrollY - dy / z;
      }
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
      this.pinchDist = null;
    });

    this.input.on('wheel', (_pointer, _gameObjects, _deltaX, deltaY) => {
      const nextZoom = window.Phaser.Math.Clamp(this.cameras.main.zoom - deltaY * 0.0008, 0.55, 1.55);
      this.cameras.main.setZoom(nextZoom);
    });

    // Keyboard WASD / Arrows pan
    this.cursors = this.input.keyboard ? this.input.keyboard.createCursorKeys() : null;
  }

  focusOnSlot(slotId, instant = false) {
    const slotDef = BUILD_SLOTS.find((s) => s.id === slotId);
    if (!slotDef) return;
    const cam = this.cameras.main;
    const vw = this.scale.width;
    const targetZoom = vw < 500 ? 0.68 : vw < 900 ? 0.82 : 0.95;
    cam.setZoom(targetZoom);
    if (instant) {
      cam.centerOn(slotDef.x + (vw > 900 ? 80 : 0), slotDef.y);
    } else {
      cam.pan(slotDef.x + (vw > 900 ? 80 : 0), slotDef.y, 350, 'Sine.easeInOut');
    }
  }

  focusOnRegion(regionId) {
    const regDef = REGIONS.find((r) => r.id === regionId);
    if (!regDef) return;
    const cx = regDef.bounds.x + regDef.bounds.w / 2;
    const cy = regDef.bounds.y + regDef.bounds.h / 2;
    this.cameras.main.pan(cx, cy, 400, 'Sine.easeInOut');
  }

  update(_time, delta) {
    if (!this.sim) return;
    const dt = Math.min(0.1, delta / 1000);
    this.pulsePhase += dt * 4.5;

    // Step simulation
    this.sim.step(dt);

    // Keyboard camera panning
    if (this.cursors) {
      const panSpeed = 380 * dt;
      if (this.cursors.left.isDown) this.cameras.main.scrollX -= panSpeed;
      if (this.cursors.right.isDown) this.cameras.main.scrollX += panSpeed;
      if (this.cursors.up.isDown) this.cameras.main.scrollY -= panSpeed;
      if (this.cursors.down.isDown) this.cameras.main.scrollY += panSpeed;
    }

    this.syncRegions();
    this.syncSlots();
    this.syncFlowLines();
    this.syncTrucks();
  }

  syncRegions() {
    for (const regDef of REGIONS) {
      const rState = this.sim.state.regions[regDef.id];
      const ov = this.regionOverlays[regDef.id];
      if (!rState || !ov) continue;

      ov.lockOverlay.setVisible(!rState.unlocked);
      ov.raidRect.setVisible(!!rState.raidActive);
      if (rState.raidActive) {
        ov.raidRect.setAlpha(0.12 + Math.sin(this.pulsePhase * 2) * 0.08);
      }

      // Show stationed lieutenants in region subtitle
      const lts = LIEUTENANTS.filter((l) => {
        const ls = this.sim.state.lieutenants[l.id];
        return ls && ls.hired && ls.regionId === regDef.id;
      }).map((l) => l.name.split(' ')[0]);

      const ltText = lts.length ? ` · Lt: ${lts.join(', ')}` : '';
      ov.subTxt.setText(`${regDef.townName} · Heat ${Math.floor(rState.heat)}%${ltText}`);
    }
  }

  syncSlots() {
    const selectedId = this.sim.state.selectedSlotId;
    for (const [slotId, node] of Object.entries(this.slotContainers)) {
      const sState = this.sim.state.slots[slotId];
      if (!sState) continue;

      node.selectRing.setVisible(slotId === selectedId);
      node.raidRing.setVisible(!!sState.raidLocked);
      if (sState.raidLocked) {
        node.raidRing.setAlpha(0.35 + Math.sin(this.pulsePhase * 2.5) * 0.25);
      }

      const key = `${sState.buildingId || 'empty'}_${sState.level}_${sState.rivalControlled ? 1 : 0}`;
      if (key !== node.lastKey) {
        node.lastKey = key;
        this.drawBuildingArchitecture(node.buildingArt, sState);
      }

      if (sState.rivalControlled) {
        node.nameTxt.setText('LOS LOBOS OUTPOST');
        node.nameTxt.setColor('#ff7b72');
        node.stockTxt.setText('Hostile Territory');
        node.stockTxt.setColor('#f85149');
        node.progBg.setVisible(false);
        node.progFill.setVisible(false);
        node.levelBadge.setVisible(false);
        node.levelTxt.setVisible(false);
      } else if (!sState.buildingId) {
        node.nameTxt.setText(node.slotDef.label);
        node.nameTxt.setColor('#c9d1d9');
        node.stockTxt.setText('+ Tap to Build');
        node.stockTxt.setColor('#79b8ff');
        node.progBg.setVisible(false);
        node.progFill.setVisible(false);
        node.levelBadge.setVisible(false);
        node.levelTxt.setVisible(false);
      } else {
        const bDef = BUILDINGS[sState.buildingId];
        node.nameTxt.setText(bDef.shortName.toUpperCase());
        node.nameTxt.setColor('#f2ece1');
        node.progBg.setVisible(true);
        node.progFill.setVisible(true);
        node.progFill.width = Math.max(2, Math.min(72, sState.progress * 72));
        node.progFill.fillColor = sState.raidLocked ? 0xf85149 : bDef.accentColor;

        node.levelBadge.setVisible(true);
        node.levelTxt.setVisible(true);
        node.levelTxt.setText(`L${sState.level}`);

        // Compute stock display string
        if (sState.raidLocked) {
          node.stockTxt.setText('RAID LOCKDOWN');
          node.stockTxt.setColor('#ff7b72');
        } else if (bDef.role === 'launderer') {
          node.stockTxt.setText(`Launders $${bDef.launderPerCycle * sState.level}/cycle`);
          node.stockTxt.setColor('#79b8ff');
        } else {
          const outEntries = Object.entries(sState.outputBuffer).filter(([, q]) => q > 0);
          const inEntries = Object.entries(sState.inputBuffer).filter(([, q]) => q > 0);
          if (outEntries.length > 0) {
            const [gId, q] = outEntries[0];
            node.stockTxt.setText(`Out: ${q} ${GOODS[gId]?.shortName || gId}`);
            node.stockTxt.setColor('#7ee787');
          } else if (inEntries.length > 0) {
            const [gId, q] = inEntries[0];
            node.stockTxt.setText(`In: ${q} ${GOODS[gId]?.shortName || gId}`);
            node.stockTxt.setColor('#a5d6ff');
          } else if (bDef.role === 'logistics') {
            node.stockTxt.setText(`+${bDef.trucksProvided} Fleet Trucks`);
            node.stockTxt.setColor('#79b8ff');
          } else {
            node.stockTxt.setText('Operating...');
            node.stockTxt.setColor('#9ca7b8');
          }
        }
      }
    }
  }

  syncFlowLines() {
    this.flowLineLayer.clear();
    // Draw active supply chain connection lines for active trucks
    for (const t of this.sim.state.activeTrucks) {
      const src = BUILD_SLOTS.find((s) => s.id === t.fromSlotId);
      const dst = BUILD_SLOTS.find((s) => s.id === t.toSlotId);
      if (!src || !dst) continue;
      const gDef = GOODS[t.goodId];
      const color = gDef ? gDef.color : 0x3ddc97;
      this.flowLineLayer.lineStyle(2.5, color, 0.48);
      this.flowLineLayer.lineBetween(src.x, src.y, dst.x, dst.y);
    }
  }

  syncTrucks() {
    const activeIds = new Set();
    for (const t of this.sim.state.activeTrucks) {
      activeIds.add(t.id);
      let tc = this.truckContainers[t.id];
      if (!tc) {
        const gDef = GOODS[t.goodId];
        const color = gDef ? gDef.color : 0x3ddc97;
        const container = this.add.container(t.x, t.y);

        // Truck chassis (clean geometric top-down cargo truck, no emoji)
        const shadow = this.add.rectangle(1, 2, 26, 15, 0x000000, 0.45);
        const body = this.add.rectangle(-2, 0, 18, 12, color, 1);
        body.setStrokeStyle(1.5, 0x141820, 1);
        const cab = this.add.rectangle(9, 0, 7, 10, 0xe6edf3, 1);
        cab.setStrokeStyle(1, 0x141820, 1);

        const label = this.add.text(0, -13, `${t.qty}× ${gDef ? gDef.shortName : ''}`, {
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '9.5px',
          fontStyle: '700',
          color: '#f0ebe1',
          backgroundColor: 'rgba(15,19,26,0.85)',
          padding: { x: 4, y: 1 }
        }).setOrigin(0.5);

        container.add([shadow, body, cab, label]);
        this.truckLayer.add(container);
        tc = { container, body, cab, label };
        this.truckContainers[t.id] = tc;
      }

      tc.container.setPosition(t.x, t.y);
      const angle = Math.atan2(t.ty - t.y, t.tx - t.x);
      tc.body.setRotation(angle);
      tc.cab.setRotation(angle);
      tc.cab.setPosition(Math.cos(angle) * 9, Math.sin(angle) * 9);
    }

    // Remove delivered trucks
    for (const [id, tc] of Object.entries(this.truckContainers)) {
      if (!activeIds.has(Number(id))) {
        tc.container.destroy();
        delete this.truckContainers[id];
      }
    }
  }
}
