import { paintTextures, ensureAnims } from '../art.js';
import { createAudio } from '../audio.js';
import { mountUi } from '../ui.js';
import {
  freshState, loadState, saveState, clearState, hasSave,
  tick, perform, performHire, performFavor, performPetition
} from '../sim.js';

const WORLD = { w: 2200, h: 1500 };
const PILLARS = [
  { x: 250, y: 140, w: 62, h: 430 },
  { x: 690, y: 140, w: 62, h: 430 },
  { x: 1130, y: 140, w: 62, h: 430 },
  { x: 1570, y: 140, w: 62, h: 430 }
];

const SPOTS = [
  { id: 'barrel', x: 980, y: 860 },
  { id: 'dumpster', x: 470, y: 760 },
  { id: 'dumpster', x: 1680, y: 820 },
  { id: 'dumpster', x: 1500, y: 1100 },
  { id: 'forage', x: 300, y: 1160 },
  { id: 'corner', x: 1980, y: 1160 },
  { id: 'workbench', x: 760, y: 1020 },
  { id: 'board', x: 720, y: 640 },
  { id: 'mural', x: 1200, y: 640 },
  { id: 'clinic', x: 1400, y: 1180 },
  { id: 'dog', x: 560, y: 1320 },
  { id: 'gate', x: 200, y: 900 },
  { id: 'newcomer', x: 1760, y: 680 },
  { id: 'ticket', x: 1080, y: 700 },
  { id: 'wall', x: 1320, y: 620 }
];

const STRUCT = [
  { id: 'workbench', x: 760, y: 1020, key: 'bench', ghost: 'pallet' },
  { id: 'tent', x: 1180, y: 1040, key: 'tent' },
  { id: 'soup_kitchen', x: 1260, y: 820, key: 'soup' },
  { id: 'garden', x: 900, y: 1220, key: 'garden' },
  { id: 'clinic', x: 1400, y: 1180, key: 'clinic' },
  { id: 'gate', x: 200, y: 900, key: 'gate' },
  { id: 'radio', x: 640, y: 760, key: 'radio' },
  { id: 'stash', x: 400, y: 700, key: 'crate' },
  { id: 'guitar', x: 1880, y: 1100, key: 'guitar' },
  { id: 'cart', x: 1580, y: 980, key: 'cart' },
  { id: 'pantry', x: 1340, y: 900, key: 'crate' },
  { id: 'coats', x: 1280, y: 1120, key: 'coats' },
  { id: 'toolbox', x: 820, y: 960, key: 'crate' },
  { id: 'compost', x: 780, y: 1260, key: 'brush' },
  { id: 'awning', x: 1980, y: 1080, key: 'awning' },
  { id: 'barrel', x: 980, y: 1160, key: 'rainbarrel' }
];

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export class CampScene extends Phaser.Scene {
  constructor() {
    super('camp');
  }

  create() {
    this.playing = false;
    this.paused = false;
    this.state = freshState();
    this.dest = null;
    this.audio = createAudio();
    this.reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.seenKeys = false;
    this.overShown = false;
    paintTextures(this);
    ensureAnims(this);
    this.drawWorld();
    this.props = {};
    this.placeProps();
    this.actors = {};
    this.placeActors();
    this.player = this.add.sprite(980, 980, 'player').setOrigin(0.5, 0.92);
    this.sorted = [this.player, this.flame, this.dog, ...Object.values(this.actors), ...Object.values(this.props)];
    this.cameras.main.setBounds(0, 0, WORLD.w, WORLD.h);
    this.cameras.main.centerOn(980, 860);
    this.fitZoom();
    this.scale.on('resize', () => this.fitZoom());
    if (this.input.keyboard) {
      this.keys = this.input.keyboard.addKeys({
        W: Phaser.Input.Keyboard.KeyCodes.W,
        A: Phaser.Input.Keyboard.KeyCodes.A,
        S: Phaser.Input.Keyboard.KeyCodes.S,
        D: Phaser.Input.Keyboard.KeyCodes.D,
        UP: Phaser.Input.Keyboard.KeyCodes.UP,
        DOWN: Phaser.Input.Keyboard.KeyCodes.DOWN,
        LEFT: Phaser.Input.Keyboard.KeyCodes.LEFT,
        RIGHT: Phaser.Input.Keyboard.KeyCodes.RIGHT,
        E: Phaser.Input.Keyboard.KeyCodes.E,
        C: Phaser.Input.Keyboard.KeyCodes.C,
        ESC: Phaser.Input.Keyboard.KeyCodes.ESC,
        M: Phaser.Input.Keyboard.KeyCodes.M
      });
    }
    this.input.on('pointerdown', (p) => this.onPointer(p));
    this.ui = mountUi(this);
    this.syncWorld();
    this.pan = 0;
    this.saveAcc = 0;
    this.hudAcc = 0;
    this.bedAcc = 0;
    const persist = () => { if (this.playing) saveState(this.state); };
    window.addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
    window.HV = {
      scene: this,
      get state() { return window.HV.scene.state; },
      perform: (id) => this.act(id),
      save: () => saveState(this.state),
      hasSave
    };
  }

  drawWorld() {
    this.add.tileSprite(WORLD.w / 2, WORLD.h / 2, WORLD.w, WORLD.h, 'ground').setDepth(0);
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0x2b2f36, 1);
    g.fillRect(1680, 560, 520, 940);
    g.fillStyle(0xc8c2b4, 0.15);
    for (let y = 640; y < 1460; y += 70) g.fillRect(1928, y, 10, 28);
    g.fillStyle(0x4c5158, 1);
    g.fillRect(0, 0, WORLD.w, 250);
    g.fillStyle(0x5c626a, 1);
    g.fillRect(0, 0, WORLD.w, 18);
    g.fillStyle(0x1a1d22, 0.55);
    g.fillRect(0, 230, WORLD.w, 90);
    PILLARS.forEach((p) => {
      this.add.image(p.x, p.y, 'pillar').setOrigin(0, 0).setDepth(2);
    });
    this.add.image(1320, 250, 'wall').setOrigin(0.5, 0).setDepth(3);
    this.night = this.add.rectangle(WORLD.w / 2, WORLD.h / 2, WORLD.w, WORLD.h, 0x070b14, 0).setDepth(4000);
    this.weatherTint = this.add.rectangle(WORLD.w / 2, WORLD.h / 2, WORLD.w, WORLD.h, 0x8fb4ff, 0).setDepth(4010);
    this.glow = this.add.image(980, 860, 'spark').setBlendMode(Phaser.BlendModes.ADD).setDepth(3900).setScale(14).setAlpha(0.4);
    this.flame = this.add.sprite(980, 820, 'flame0').setOrigin(0.5, 0.85).setDepth(860);
    this.flame.play('flame');
    this.fireFx = this.add.particles(980, 800, 'spark', {
      speed: { min: 16, max: 54 },
      lifespan: { min: 400, max: 900 },
      scale: { start: 0.45, end: 0 },
      alpha: { start: 0.75, end: 0 },
      gravityY: -30,
      frequency: 70,
      quantity: 1,
      tint: [0xffb15a, 0xff6a2a, 0xffe0a8],
      blendMode: Phaser.BlendModes.ADD
    }).setDepth(4100);
    this.rain = this.add.particles(980, 400, 'streak', {
      x: { min: -1400, max: 1400 },
      lifespan: 900,
      speedY: { min: 520, max: 780 },
      speedX: { min: -40, max: 20 },
      quantity: 6,
      frequency: 40,
      tint: 0xc5d0dc,
      emitting: false
    }).setDepth(4200);
    this.snow = this.add.particles(980, 400, 'spark', {
      x: { min: -1400, max: 1400 },
      lifespan: 3200,
      speedY: { min: 40, max: 90 },
      speedX: { min: -20, max: 20 },
      scale: { start: 0.18, end: 0.05 },
      quantity: 2,
      frequency: 80,
      tint: 0xf4f7fb,
      emitting: false
    }).setDepth(4200);
  }

  placeProps() {
    const add = (key, x, y, tex, originY) => {
      const s = this.add.image(x, y, tex).setOrigin(0.5, originY == null ? 0.9 : originY).setDepth(y);
      this.props[key] = s;
      return s;
    };
    SPOTS.filter((s) => s.id === 'dumpster').forEach((s, i) => add('dump' + i, s.x, s.y, 'dumpster'));
    add('brush', 300, 1160, 'brush');
    add('board', 720, 640, 'board', 0.8);
    STRUCT.forEach((s) => {
      const spr = add(s.id, s.x, s.y, s.ghost || s.key);
      spr.setData('builtKey', s.key);
      spr.setData('ghost', s.ghost || '');
    });
    SPOTS.forEach((s) => {
      const ring = this.add.image(s.x, s.y + 6, 'ring').setDepth(4).setAlpha(0.28);
      ring.setData('spot', s.id);
      this.props['ring-' + s.id + '-' + s.x] = ring;
    });
  }

  placeActors() {
    const mk = (id, tex, x, y) => {
      const s = this.add.sprite(x, y, tex).setOrigin(0.5, 0.92).setVisible(false);
      this.actors[id] = s;
      return s;
    };
    mk('scrapper', 'npc-scrap', 900, 900);
    mk('builder', 'npc-build', 1040, 940);
    mk('cook', 'npc-cook', 1100, 880);
    mk('lookout', 'npc-look', 860, 800);
    mk('marisol', 'npc-marisol', 1860, 1120);
    mk('ray', 'npc-ray', 860, 780);
    mk('dee', 'npc-dee', 1760, 1000);
    mk('june', 'npc-june', 1460, 1140);
    mk('rio', 'npc-rio', 280, 860);
    mk('dena', 'npc-dena', 820, 700);
    mk('newcomer', 'npc-new', 1760, 680);
    mk('ticket', 'npc-new', 1080, 700);
    this.dog = this.add.sprite(560, 1320, 'dog').setOrigin(0.5, 0.9).setVisible(false);
  }

  fitZoom() {
    const z = Phaser.Math.Clamp(this.scale.width / 980, 0.7, 1.25);
    this.cameras.main.setZoom(z);
  }

  onPointer(p) {
    this.audio.unlock();
    if (!this.playing || this.ui.blocksWorld()) return;
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    const spot = this.spotAt(w.x, w.y, 78);
    if (spot && dist(this.player.x, this.player.y, spot.x, spot.y) < 100) {
      this.ui.openSpot(spot);
      return;
    }
    this.ui.closeSpot();
    this.dest = {
      x: Phaser.Math.Clamp(w.x, 40, WORLD.w - 40),
      y: Phaser.Math.Clamp(w.y, 620, WORLD.h - 40),
      spot
    };
  }

  spotAt(x, y, r) {
    let best = null;
    let bestD = r;
    SPOTS.forEach((s) => {
      if (!this.spotLive(s)) return;
      const d = dist(x, y, s.x, s.y);
      if (d < bestD) { best = s; bestD = d; }
    });
    return best;
  }

  spotLive(s) {
    if (s.id === 'newcomer') return !!this.state.newcomerAsk;
    if (s.id === 'ticket') return !!this.state.ticketAsk;
    if (s.id === 'dog') return this.state.dog > 0;
    return true;
  }

  nearestLive() {
    let best = null;
    let bestD = 120;
    SPOTS.forEach((s) => {
      if (!this.spotLive(s)) return;
      const d = dist(this.player.x, this.player.y, s.x, s.y);
      if (d < bestD) { best = s; bestD = d; }
    });
    return best;
  }

  step(dx, dy) {
    const tryAt = (x, y) => {
      if (x < 28 || x > WORLD.w - 28 || y < 610 || y > WORLD.h - 28) return false;
      return !PILLARS.some((p) => x > p.x - 10 && x < p.x + p.w + 10 && y > p.y && y < p.y + p.h);
    };
    const nx = this.player.x + dx;
    const ny = this.player.y + dy;
    if (tryAt(nx, ny)) this.player.setPosition(nx, ny);
    else if (tryAt(nx, this.player.y)) this.player.x = nx;
    else if (tryAt(this.player.x, ny)) this.player.y = ny;
  }

  update(_time, delta) {
    const dt = Math.min(delta, 48);
    if (!this.playing) this.idlePan(dt);
    else if (!this.ui.blocksWorld()) this.move(dt);
    if (this.playing && !this.paused && !this.state.over) {
      const res = tick(this.state, dt);
      this.consume(res);
      this.saveAcc += dt;
      if (this.saveAcc > 12000) {
        this.saveAcc = 0;
        saveState(this.state);
      }
    }
    this.animate(dt);
    this.hudAcc += dt;
    if (this.hudAcc > 160) {
      this.hudAcc = 0;
      if (this.playing) this.ui.refresh();
    }
    if (this.keys) this.keysUpdate();
  }

  keysUpdate() {
    const K = Phaser.Input.Keyboard;
    if (K.JustDown(this.keys.M)) this.ui.toggleSound();
    if (!this.playing) return;
    if (K.JustDown(this.keys.ESC)) this.ui.back();
    if (this.ui.blocksWorld()) return;
    if (K.JustDown(this.keys.C)) this.ui.toggleDrawer();
    if (K.JustDown(this.keys.E)) {
      const spot = this.nearestLive();
      if (spot) this.ui.openSpot(spot);
    }
  }

  move(dt) {
    const s = (dt / 1000) * 220;
    let vx = 0;
    let vy = 0;
    const k = this.keys;
    if (k) {
      if (k.A.isDown || k.LEFT.isDown) vx -= 1;
      if (k.D.isDown || k.RIGHT.isDown) vx += 1;
      if (k.W.isDown || k.UP.isDown) vy -= 1;
      if (k.S.isDown || k.DOWN.isDown) vy += 1;
    }
    if (vx || vy) {
      this.dest = null;
      const len = Math.hypot(vx, vy) || 1;
      this.step((vx / len) * s, (vy / len) * s);
      if (vx) this.player.setFlipX(vx < 0);
      return;
    }
    if (!this.dest) return;
    const dx = this.dest.x - this.player.x;
    const dy = this.dest.y - this.player.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 8) {
      const spot = this.dest.spot;
      this.dest = null;
      if (spot) this.ui.openSpot(spot);
      return;
    }
    const step = Math.min(s, d);
    this.step((dx / d) * step, (dy / d) * step);
    if (dx) this.player.setFlipX(dx < 0);
  }

  idlePan(dt) {
    this.pan += dt * 0.00012;
    this.cameras.main.centerOn(980 + Math.sin(this.pan) * 70, 860 + Math.cos(this.pan * 0.7) * 24);
  }

  animate(dt) {
    const t = this.time.now;
    const lit = !!this.state.fireLit;
    this.flame.setVisible(lit);
    this.glow.setAlpha(lit ? 0.28 + Math.sin(t / 180) * 0.08 : 0);
    this.fireFx.emitting = lit;
    const night = this.state.timeOfDay;
    let dark = 0;
    if (night < 0.18) dark = 0.48 * (1 - night / 0.18);
    else if (night > 0.72) dark = Math.min(0.5, ((night - 0.72) / 0.16) * 0.5);
    this.night.setAlpha(this.playing || night > 0.72 ? dark : 0);
    const weather = this.state.weather;
    this.rain.emitting = weather === 'rain';
    this.snow.emitting = weather === 'cold';
    this.weatherTint.setFillStyle(weather === 'heat' ? 0xffb060 : 0x9eb6d4, 1);
    this.weatherTint.setAlpha(weather === 'heat' ? 0.1 : weather === 'cold' ? 0.08 : 0);
    const cam = this.cameras.main;
    const top = cam.worldView ? cam.worldView.y : cam.scrollY;
    this.rain.setPosition(cam.midPoint.x, top);
    this.snow.setPosition(cam.midPoint.x, top - 20);
    this.bedAcc += dt;
    if (this.bedAcc > 220) {
      this.bedAcc = 0;
      const wind = this.playing && (weather === 'rain' || weather === 'cold' || dark > 0.2);
      this.audio.setBed(lit && (this.playing || this.audioUnlocked), wind);
    }
    this.bobActors(t);
    this.sorted.forEach((s) => { if (s && s.active) s.setDepth(s.y); });
    this.flame.setDepth(this.flame.y + 8);
    this.night.setDepth(4000);
    this.weatherTint.setDepth(4010);
    this.fireFx.setDepth(4100);
    this.rain.setDepth(4200);
    this.snow.setDepth(4200);
  }

  bobActors(t) {
    const g = this.state;
    const wander = (id, x, y, phase) => {
      const s = this.actors[id];
      if (!s.visible) return;
      s.setPosition(x + Math.sin(t / 900 + phase) * 10, y + Math.cos(t / 1100 + phase) * 6);
    };
    ['scrapper', 'builder', 'cook', 'lookout'].forEach((id, i) => {
      this.actors[id].setVisible(!!g.workers[id]);
      wander(id, 900 + i * 70, 900 - (i % 2) * 40, i);
    });
    this.actors.marisol.setVisible((g.regulars.marisol || 0) >= 1);
    this.actors.ray.setVisible((g.regulars.ray || 0) >= 1);
    this.actors.dee.setVisible((g.regulars.dee || 0) >= 1);
    wander('marisol', 1860, 1120, 1);
    wander('ray', 860, 800, 2);
    wander('dee', 1760, 1000, 3);
    this.actors.june.setVisible(g.june >= 1);
    this.actors.june.setPosition(1460, 1140);
    this.actors.rio.setVisible(g.rio >= 1);
    this.actors.rio.setPosition(280, 860);
    this.actors.dena.setVisible(g.arcStage >= 1);
    this.actors.dena.setPosition(820, 700);
    this.actors.newcomer.setVisible(!!g.newcomerAsk);
    this.actors.ticket.setVisible(!!g.ticketAsk);
    if (g.dog === 2) {
      this.dog.setVisible(true);
      const tx = this.player.x - 42;
      const ty = this.player.y + 16;
      this.dog.x += (tx - this.dog.x) * 0.05;
      this.dog.y += (ty - this.dog.y) * 0.05;
      this.dog.setFlipX(tx < this.dog.x);
    } else if (g.dog === 1) {
      this.dog.setVisible(true);
      this.dog.setPosition(560, 1320);
    } else this.dog.setVisible(false);
  }

  syncWorld() {
    const built = this.state.structures;
    STRUCT.forEach((s) => {
      const spr = this.props[s.id];
      if (!spr) return;
      if (built[s.id]) {
        spr.setTexture(s.key);
        spr.setVisible(true);
        spr.setAlpha(1);
      } else if (s.ghost) {
        spr.setTexture(s.ghost);
        spr.setVisible(true);
        spr.setAlpha(0.55);
      } else spr.setVisible(false);
    });
    Object.values(this.props).forEach((spr) => {
      const id = spr.getData('spot');
      if (!id) return;
      const live = SPOTS.some((spot) => spot.id === id && this.spotLive(spot));
      spr.setVisible(live);
    });
  }

  begin(mode) {
    if (mode === 'continue' && hasSave()) this.state = loadState() || freshState();
    else {
      clearState();
      this.state = freshState();
    }
    this.playing = true;
    this.paused = false;
    this.overShown = !!this.state.over;
    this.seenKeys = this.state.arcStage >= 3;
    this.player.setPosition(980, 980);
    this.dest = null;
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1, 0, -20);
    this.syncWorld();
    this.audio.unlock();
    this.audioUnlocked = true;
    this.ui.onBegan();
    if (this.state.over) this.ui.openOver();
    saveState(this.state);
  }

  resetCamp() {
    clearState();
    this.state = freshState();
    this.overShown = false;
    this.seenKeys = false;
    this.paused = false;
    this.playing = true;
    this.player.setPosition(980, 980);
    this.syncWorld();
    this.ui.onBegan();
    this.ui.toast('A new camp. The barrel is lit.');
    saveState(this.state);
  }

  act(id) {
    let res;
    if (id.indexOf('hire:') === 0) res = performHire(this.state, id.slice(5));
    else if (id === 'favor') res = performFavor(this.state);
    else if (id.indexOf('petition:') === 0) res = performPetition(this.state, id.slice(9));
    else res = perform(this.state, id);
    this.consume(res);
    saveState(this.state);
    if (id === 'wall') this.ui.openBridge();
    if (res && res.floats) res.floats.forEach((line, i) => this.floatText(this.player.x, this.player.y - 40 - i * 16, line));
    return res;
  }

  consume(res) {
    if (!res) return;
    if (res.logs && res.logs.length) this.ui.toastAll(res.logs);
    if (res.built && res.built !== 'dawn' && res.built !== 'sweep' && !this.reduce) {
      this.cameras.main.shake(140, 0.0025);
      this.audio.chime();
    }
    if (res.dawn && !this.reduce) this.cameras.main.flash(220, 40, 32, 24, false, null, 0.18);
    if (res.sweep) this.audio.warn();
    if (this.state.arcStage >= 3 && !this.seenKeys) {
      this.seenKeys = true;
      this.ui.openKeys();
    }
    if (this.state.over && !this.overShown) {
      this.overShown = true;
      this.ui.openOver();
    }
    if (this.state.storm) this.ui.openStorm();
    else if (res.open === 'storm-done') this.ui.closeStorm();
    this.syncWorld();
    this.ui.refresh();
  }

  floatText(x, y, text) {
    const label = this.add.text(x, y, text, {
      fontFamily: 'Outfit, sans-serif',
      fontSize: '15px',
      color: '#f4f1ea',
      stroke: '#14171d',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(4300);
    this.tweens.add({
      targets: label,
      y: y - 28,
      alpha: 0,
      duration: 900,
      onComplete: () => label.destroy()
    });
  }

  screenOf(spot) {
    const cam = this.cameras.main;
    const z = cam.zoom;
    return {
      x: (spot.x - cam.worldView.x) * z,
      y: (spot.y - cam.worldView.y) * z
    };
  }
}
