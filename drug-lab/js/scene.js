import * as THREE from 'three';
import { ROOM_DEFS, PALETTE, DEALER_COLORS, ZOOM_MIN, ZOOM_MAX } from './config.js';

// ── Scene / camera / renderer ──
export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1108);
scene.fog = new THREE.Fog(0x0d1108, 30, 55);

export const camera = new THREE.OrthographicCamera();
export let cameraZoom = 12;
export let panX = 0, panZ = 0;

export function setCameraZoom(z) { cameraZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)); }
export function setPan(x, z)     { panX = x; panZ = z; }

export function fitCamera() {
  const a = innerWidth / innerHeight;
  camera.left   = -cameraZoom * a; camera.right = cameraZoom * a;
  camera.top    =  cameraZoom;     camera.bottom = -cameraZoom;
  camera.near   = -100;            camera.far    = 200;
  camera.updateProjectionMatrix();
}
export function applyCamera() {
  camera.position.set(20 + panX, 20, 20 + panZ);
  camera.lookAt(panX, 0, panZ);
}
applyCamera(); fitCamera();

export const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => { fitCamera(); renderer.setSize(innerWidth, innerHeight); });

// ── Lights ──
scene.add(new THREE.AmbientLight(0x1a2a14, 0.8));
const sun = new THREE.DirectionalLight(0x88aa66, 0.6);
sun.position.set(12, 25, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -50; sun.shadow.camera.right = 50;
sun.shadow.camera.top  =  50; sun.shadow.camera.bottom = -50;
sun.shadow.bias = -0.001;
scene.add(sun);

// ── World-to-screen projection ──
const _pv = new THREE.Vector3();
export function worldToScreen(x, y, z) {
  _pv.set(x, y, z).project(camera);
  return {x: (_pv.x*0.5+0.5)*innerWidth, y: (-_pv.y*0.5+0.5)*innerHeight};
}

// ── Label system ──
const labelsEl = document.getElementById('labels');
const labelMap = new Map();
export function setLabel(key, text, x, y, z, cls='') {
  let div = labelMap.get(key);
  if (!div) { div = document.createElement('div'); labelsEl.appendChild(div); labelMap.set(key, div); }
  div.textContent = text;
  div.className = cls;
  const s = worldToScreen(x, y, z);
  div.style.transform = `translate(calc(-50% + ${s.x}px), calc(-100% + ${s.y}px - 4px))`;
}
export function removeLabel(key) {
  const div = labelMap.get(key);
  if (div) { labelsEl.removeChild(div); labelMap.delete(key); }
}

// ── Shared NPC walker ──
export function stepToward(obj, tx, tz, speed, dt) {
  const dx = tx - obj.position.x, dz = tz - obj.position.z;
  const dist = Math.sqrt(dx*dx + dz*dz);
  if (dist < 0.05) return true;
  const step = Math.min(dist, speed * dt);
  obj.position.x += (dx/dist)*step;
  obj.position.z += (dz/dist)*step;
  if (dist > 0.01) obj.rotation.y = Math.atan2(dx, dz);
  return false;
}

// ── Room building ──
export const ownedRoomSet = new Set(['garage']);
export const roomMeshes   = {};

export function roomCenter(def) { return {cx: def.gx * 16, cz: def.gz * 16}; }

export function buildRoom(def) {
  const pal  = PALETTE[def.id] || {floor:0x222222, wall:0x333333};
  const {cx, cz} = roomCenter(def);
  const floorMat = new THREE.MeshLambertMaterial({color: pal.floor});
  const wallMat  = new THREE.MeshLambertMaterial({color: pal.wall});
  const meshes   = {floor:null, walls:[], decor:[]};

  const floor = new THREE.Mesh(new THREE.BoxGeometry(16, 0.2, 16), floorMat);
  floor.position.set(cx, -0.1, cz); floor.receiveShadow = true;
  scene.add(floor); meshes.floor = floor;

  const wallDefs = [
    {pos:[cx,1.5,cz-8], geo:[16.4,3,0.25]},
    {pos:[cx,1.5,cz+8], geo:[16.4,3,0.25]},
    {pos:[cx-8,1.5,cz], geo:[0.25,3,16.4]},
    {pos:[cx+8,1.5,cz], geo:[0.25,3,16.4]},
  ];
  for (const wd of wallDefs) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...wd.geo), wallMat);
    m.position.set(...wd.pos); m.castShadow = true; m.receiveShadow = true;
    scene.add(m); meshes.walls.push(m);
  }

  const pt = new THREE.PointLight(def.id === 'growroom' ? 0x9955ff : 0xaaffaa, 0.5, 20);
  pt.position.set(cx, 5, cz); scene.add(pt); meshes.decor.push(pt);

  const fix = new THREE.Mesh(new THREE.BoxGeometry(0.6,0.1,0.6),
    new THREE.MeshLambertMaterial({color:0x111111}));
  fix.position.set(cx, 3.9, cz); scene.add(fix); meshes.decor.push(fix);

  roomMeshes[def.id] = meshes;
  removeSharedWalls(def);
}

export function removeSharedWalls(def) {
  for (const [dg, dz] of [[0,-1],[0,1],[-1,0],[1,0]]) {
    const neighbor = ROOM_DEFS.find(r => r.gx === def.gx+dg && r.gz === def.gz+dz);
    if (!neighbor || !ownedRoomSet.has(neighbor.id)) continue;
    removeWallBetween(def, neighbor);
    removeWallBetween(neighbor, def);
  }
}

export function removeWallBetween(a, b) {
  const meshes = roomMeshes[a.id];
  if (!meshes) return;
  const {cx:ax, cz:az} = roomCenter(a);
  const {cx:bx, cz:bz} = roomCenter(b);
  const dx = bx-ax, dz = bz-az;
  const toRemove = [];
  for (const m of meshes.walls) {
    const mx = m.position.x - ax, mz = m.position.z - az;
    if (Math.abs(dx)>0 && Math.sign(mx)===Math.sign(dx) && Math.abs(mz)<2) toRemove.push(m);
    if (Math.abs(dz)>0 && Math.sign(mz)===Math.sign(dz) && Math.abs(mx)<2) toRemove.push(m);
  }
  for (const m of toRemove) { scene.remove(m); meshes.walls.splice(meshes.walls.indexOf(m),1); }
}

// ── Grow plots ──
export const growPlots = [];

export function buildGrowPlot(x, z, roomId) {
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.45,0.32,0.55,10),
    new THREE.MeshLambertMaterial({color:0x2a1a0e}));
  pot.position.set(x, 0.27, z); pot.castShadow = true; scene.add(pot);

  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.4,0.06,10),
    new THREE.MeshLambertMaterial({color:0x1a1208}));
  soil.position.set(x, 0.57, z); scene.add(soil);

  const uvLight = new THREE.PointLight(0x8833ee, 0.6, 5);
  uvLight.position.set(x, 3.8, z); scene.add(uvLight);

  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9,0.08,0.22),
    new THREE.MeshLambertMaterial({color:0x111111, emissive:0x220033, emissiveIntensity:0.4}));
  bar.position.set(x, 3.85, z); scene.add(bar);

  const plantG = new THREE.Group();
  plantG.position.set(x, 0.6, z); scene.add(plantG);

  const plot = {x, z, roomId, pot, soil, plantG, uvLight, bar,
    progress: Math.random()*0.3, ready:false, hasBud:false, stage:-1};
  growPlots.push(plot);
  updatePlantMesh(plot);
  return plot;
}

export function updatePlantMesh(plot) {
  const {plantG, progress} = plot;
  while (plantG.children.length) plantG.remove(plantG.children[0]);
  if (progress <= 0.01) { plot.stage = 0; return; }
  const stage = progress < 0.35 ? 1 : progress < 0.7 ? 2 : 3;
  if (stage === plot.stage) return;
  plot.stage = stage;

  const greenShade = stage===3 ? 0x22cc44 : stage===2 ? 0x2a8a2a : 0x1a5a1a;
  const mat = new THREE.MeshLambertMaterial({color:greenShade,
    emissive: stage===3 ? 0x114411 : 0x000000, emissiveIntensity: stage===3 ? 0.4 : 0});
  const h = 0.25 + stage*0.3;
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.06,h,6), mat);
  stalk.position.y = h/2; plantG.add(stalk);

  for (let i=0; i < 2+stage; i++) {
    const angle = (i/(2+stage))*Math.PI*2;
    const leafMat = new THREE.MeshLambertMaterial({color:greenShade,
      emissive: stage===3 ? 0x0a2a0a : 0x000000, emissiveIntensity: stage===3 ? 0.3 : 0});
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.04,0.3+stage*0.1), leafMat);
    leaf.position.set(Math.cos(angle)*0.22, h*0.65, Math.sin(angle)*0.22);
    leaf.rotation.y = angle; leaf.rotation.z = 0.4; leaf.castShadow = true;
    plantG.add(leaf);
  }
  if (stage === 3) {
    const bud = new THREE.Mesh(new THREE.SphereGeometry(0.14,8,6),
      new THREE.MeshLambertMaterial({color:0x44dd44, emissive:0x00aa00, emissiveIntensity:0.5}));
    bud.position.y = h+0.14; plantG.add(bud);
  }
}

// ── Trim station ──
export let trimStation = null;
export function buildTrimStation(x, z) {
  const tableMat = new THREE.MeshLambertMaterial({color:0x2a2820});
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.2,0.1,1.1), tableMat);
  top.position.set(x, 0.95, z); top.castShadow = true; scene.add(top);
  for (const [lx,lz] of [[-1,0.45],[1,0.45],[-1,-0.45],[1,-0.45]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.9,0.08),
      new THREE.MeshLambertMaterial({color:0x1a1810}));
    leg.position.set(x+lx, 0.45, z+lz); scene.add(leg);
  }
  const scale = new THREE.Mesh(new THREE.BoxGeometry(0.3,0.06,0.3),
    new THREE.MeshLambertMaterial({color:0x111111}));
  scale.position.set(x+0.7, 1.05, z); scene.add(scale);
  const scis = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.02,0.28),
    new THREE.MeshLambertMaterial({color:0x888888}));
  scis.position.set(x-0.4, 1.05, z); scene.add(scis);
  const bagsMesh = new THREE.Mesh(new THREE.BoxGeometry(0.35,0.18,0.25),
    new THREE.MeshLambertMaterial({color:0x88cc88, transparent:true, opacity:0.6}));
  bagsMesh.position.set(x-0.7, 1.09, z); scene.add(bagsMesh);
  trimStation = {x, z, top, bagsMesh, labelKey:'trim'};
}

// ── Stash ──
export let stashNode = null;
export function buildStash(x, z) {
  const shelfMat = new THREE.MeshLambertMaterial({color:0x1e1e18});
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.5,2.2,0.15), shelfMat);
  back.position.set(x, 1.1, z); back.castShadow = true; scene.add(back);
  for (let i=0; i<3; i++) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.3,0.08,0.7), shelfMat);
    shelf.position.set(x, 0.5+i*0.7, z+0.28); scene.add(shelf);
  }
  stashNode = {x, z, label:'stash'};
  setLabel('stash', '📦 Stash [0]', x, 2.6, z);
}

// ── Hazmat player character ──
export function buildHazmatCharacter() {
  const g = new THREE.Group();
  const yellow = 0xeebb22;
  const bootMat = new THREE.MeshLambertMaterial({color:0x443300});
  for (const sx of [-0.14,0.14]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.18,0.32), bootMat);
    b.position.set(sx, 0.09, 0.02); b.castShadow = true; g.add(b);
  }
  const suitMat = new THREE.MeshLambertMaterial({color:yellow});
  const legs  = new THREE.Mesh(new THREE.BoxGeometry(0.46,0.6,0.34), suitMat);
  legs.position.y  = 0.47; legs.castShadow  = true; g.add(legs);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32,0.5,4,10), suitMat);
  torso.position.y = 0.98; torso.castShadow = true; g.add(torso);
  const tapeMat = new THREE.MeshLambertMaterial({color:0xccaa00});
  for (const [sy,sh] of [[0.78,0.06],[1.22,0.05]]) {
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.68,sh,0.38), tapeMat);
    tape.position.y = sy; g.add(tape);
  }
  const armMat   = new THREE.MeshLambertMaterial({color:yellow});
  const gloveMat = new THREE.MeshLambertMaterial({color:0x223322});
  for (const [sx,key] of [[-0.43,'armL'],[0.43,'armR']]) {
    const ag = new THREE.Group(); ag.position.set(sx, 1.3, 0);
    const arm   = new THREE.Mesh(new THREE.CapsuleGeometry(0.09,0.48,4,8), armMat);
    arm.position.y = -0.3; arm.castShadow = true; ag.add(arm);
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.1,8,6), gloveMat);
    glove.position.y = -0.62; ag.add(glove);
    g.add(ag); g.userData[key] = ag;
  }
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.3,12,10),
    new THREE.MeshLambertMaterial({color:yellow}));
  helm.position.y = 1.78; helm.castShadow = true; g.add(helm);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.24,10,8,0,Math.PI*2,0,Math.PI*0.55),
    new THREE.MeshLambertMaterial({color:0x223333,transparent:true,opacity:0.7,emissive:0x001122,emissiveIntensity:0.3}));
  visor.position.set(0, 1.72, 0.1); visor.rotation.x = -0.3; g.add(visor);
  const resp = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.12,0.1),
    new THREE.MeshLambertMaterial({color:0x333333}));
  resp.position.set(0, 1.63, 0.27); g.add(resp);
  const carryMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22,8,6),
    new THREE.MeshLambertMaterial({color:0x22ff44, emissive:0x00aa22, emissiveIntensity:0.6}));
  carryMesh.position.y = 2.15; carryMesh.visible = false;
  g.add(carryMesh); g.userData.carryMesh = carryMesh;
  return g;
}

// ── Dealer NPCs ──
export const dealers = [];
export function buildDealer() {
  const g     = new THREE.Group();
  const color = DEALER_COLORS[Math.floor(Math.random()*DEALER_COLORS.length)];
  const sm    = new THREE.MeshLambertMaterial({color:0x111111});
  for (const sx of [-0.13,0.13]) {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(0.19,0.1,0.3), sm);
    sh.position.set(sx,0.05,0.02); sh.castShadow=true; g.add(sh);
  }
  const jeans = new THREE.Mesh(new THREE.BoxGeometry(0.44,0.6,0.32),
    new THREE.MeshLambertMaterial({color:0x1a1e28}));
  jeans.position.y = 0.4; jeans.castShadow=true; g.add(jeans);
  const hm   = new THREE.MeshLambertMaterial({color});
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32,0.5,4,10), hm);
  body.position.y = 0.98; body.castShadow=true; g.add(body);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.28,10,8,0,Math.PI*2,0,Math.PI*0.6), hm);
  hood.position.set(0,1.42,-0.1); hood.rotation.x=0.3; g.add(hood);
  const am = new THREE.MeshLambertMaterial({color});
  for (const sx of [-0.42,0.42]) {
    const ag = new THREE.Group(); ag.position.set(sx,1.3,0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09,0.46,4,8), am);
    arm.position.y=-0.28; arm.castShadow=true; ag.add(arm); g.add(ag);
  }
  const skinColor = [0xffd9a0,0xd9a56a,0xa97a4a,0x8a5a3a][Math.floor(Math.random()*4)];
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24,10,8),
    new THREE.MeshLambertMaterial({color:skinColor}));
  head.position.y=1.75; head.castShadow=true; g.add(head);
  const capMat = new THREE.MeshLambertMaterial({color:0x111111});
  const cap  = new THREE.Mesh(new THREE.CylinderGeometry(0.24,0.26,0.1,12), capMat);
  cap.position.y=1.92; g.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.52,0.04,0.22), capMat);
  brim.position.set(0,1.86,0.18); g.add(brim);
  return g;
}

// ── Trimmer NPCs ──
export const trimmerNPCs = [];
export function buildTrimmerNPC() {
  const g  = new THREE.Group();
  const sm = new THREE.MeshLambertMaterial({color:0x111111});
  for (const sx of [-0.13,0.13]) {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(0.19,0.1,0.3), sm);
    sh.position.set(sx,0.05,0.02); g.add(sh);
  }
  const wm   = new THREE.MeshLambertMaterial({color:0x3a3a3a});
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3,0.5,4,10), wm);
  body.position.y=0.98; body.castShadow=true; g.add(body);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42,0.58,0.3), wm);
  legs.position.y=0.39; g.add(legs);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24,10,8),
    new THREE.MeshLambertMaterial({color:0xffd9a0}));
  head.position.y=1.74; g.add(head);
  const gloveM = new THREE.MeshLambertMaterial({color:0x226622});
  for (const sx of [-0.42,0.42]) {
    const ag = new THREE.Group(); ag.position.set(sx,1.28,0);
    const arm   = new THREE.Mesh(new THREE.CapsuleGeometry(0.09,0.44,4,8), wm);
    arm.position.y=-0.27; ag.add(arm);
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.09,8,6), gloveM);
    glove.position.y=-0.58; ag.add(glove); g.add(ag);
  }
  return g;
}

// ── Lookout NPCs ──
export const lookoutNPCs = [];
export function buildLookoutNPC() {
  const g  = new THREE.Group();
  const dm = new THREE.MeshLambertMaterial({color:0x1a1a22});
  for (const sx of [-0.13,0.13]) {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(0.19,0.1,0.3), dm);
    sh.position.set(sx,0.05,0.02); g.add(sh);
  }
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32,0.52,4,10), dm);
  body.position.y=0.98; body.castShadow=true; g.add(body);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.44,0.6,0.32), dm);
  legs.position.y=0.4; g.add(legs);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24,10,8),
    new THREE.MeshLambertMaterial({color:0xd9a56a}));
  head.position.y=1.74; g.add(head);
  const ep = new THREE.Mesh(new THREE.SphereGeometry(0.03,6,5),
    new THREE.MeshLambertMaterial({color:0xffffff}));
  ep.position.set(0.25,1.76,-0.05); g.add(ep);
  for (const sx of [-0.42,0.42]) {
    const ag = new THREE.Group(); ag.position.set(sx,1.3,0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09,0.46,4,8), dm);
    arm.position.y=-0.28; ag.add(arm); g.add(ag);
  }
  return g;
}

// ── Steam particles ──
const steamParticles = [];
const steamPool      = [];
function getOrCreateSteam() {
  if (steamPool.length) return steamPool.pop();
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.06,6,5),
    new THREE.MeshBasicMaterial({color:0xaaffaa, transparent:true, opacity:0.4}));
  scene.add(m); return m;
}
export function spawnSteam(x, z) {
  const m = getOrCreateSteam();
  m.position.set(x+(Math.random()-0.5)*0.3, 1.2, z+(Math.random()-0.5)*0.3);
  m.visible = true;
  m.material.opacity = 0.35 + Math.random()*0.2;
  steamParticles.push({mesh:m, vy:0.4+Math.random()*0.3, life:1.0});
}
export function updateSteam(dt) {
  for (let i=steamParticles.length-1; i>=0; i--) {
    const p = steamParticles[i];
    p.life -= dt*0.5;
    p.mesh.position.y += p.vy*dt;
    p.mesh.position.x += (Math.random()-0.5)*0.02;
    p.mesh.material.opacity = Math.max(0, p.life*0.4);
    p.mesh.scale.setScalar(1 + (1-p.life)*1.5);
    if (p.life <= 0) {
      p.mesh.visible = false; steamPool.push(p.mesh); steamParticles.splice(i,1);
    }
  }
}

// ── Chemistry station ──
export let chemStation = null;
export function buildChemStation(x, z) {
  const tableMat = new THREE.MeshLambertMaterial({color:0x1a2418});
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.8,0.1,1.3), tableMat);
  top.position.set(x, 1.0, z); top.castShadow=true; scene.add(top);
  for (const [lx,lz] of [[-1.3,0.55],[1.3,0.55],[-1.3,-0.55],[1.3,-0.55]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.95,0.08),
      new THREE.MeshLambertMaterial({color:0x111111}));
    leg.position.set(x+lx, 0.48, z+lz); scene.add(leg);
  }
  const glassMat = new THREE.MeshLambertMaterial({color:0x88ccaa, transparent:true, opacity:0.6});
  for (const [fx,fz] of [[-0.8,0],[0,0.1],[0.8,0]]) {
    const flask = new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.2,0.45,8), glassMat);
    flask.position.set(x+fx, 1.35, z+fz); scene.add(flask);
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.17,0.25,8),
      new THREE.MeshLambertMaterial({color:0x00ff55, emissive:0x003311, emissiveIntensity:0.8}));
    liquid.position.set(x+fx, 1.25, z+fz); scene.add(liquid);
  }
  const burnerLight = new THREE.PointLight(0x00ff44, 0.8, 4);
  burnerLight.position.set(x, 1.4, z); scene.add(burnerLight);
  chemStation = {x, z, burnerLight, labelKey:'chem'};
  setLabel('chem', '⚗️ Chemistry Station', x, 2.2, z);
}

// ── Room unlock side-effects (scene objects only, no UI) ──
export function onRoomUnlocked(id) {
  const def      = ROOM_DEFS.find(r => r.id===id);
  const {cx, cz} = roomCenter(def);
  if (id==='growroom') {
    buildGrowPlot(cx-3, cz-3, id); buildGrowPlot(cx+3, cz-3, id);
    buildGrowPlot(cx-3, cz+3, id); buildGrowPlot(cx+3, cz+3, id);
  }
  if (id==='basement') {
    buildGrowPlot(cx-2, cz-2, id); buildGrowPlot(cx+2, cz-2, id);
  }
  if (id==='lab' && !chemStation) buildChemStation(cx, cz);
}
