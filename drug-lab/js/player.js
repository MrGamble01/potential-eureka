import * as THREE from 'three';
import { G, state, playerSpeed, now, salePrice, heatGainPerSale, fmtCash } from './config.js';
import {
  scene, camera, renderer,
  growPlots, updatePlantMesh,
  trimStation, stashNode, chemStation,
  dealers, setLabel, removeLabel, worldToScreen, stepToward,
} from './scene.js';
import { addFeed, showToast, addCash, addHeat, setStatus, cashPop, heatPop, renderUpgradesPanel, renderExpandPanel } from './ui.js';
import { saveGame } from './save.js';

// ── Player state ──
export let pState    = 'idle';
export let pTarget   = null;
export let pCarrying = null;

export function resetPlayerState() {
  pState = 'idle'; pTarget = null; pCarrying = null;
}

// ── Keyboard input ──
export const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; });
window.addEventListener('keyup',   e => { keys[e.code] = false; });

// ── Click-to-move ──
export function initPlayerInput(player) {
  renderer.domElement.addEventListener('click', e => {
    if (G.activeEvent || G.raidActive) return;
    const mouse = new THREE.Vector2(
      (e.clientX/innerWidth)*2-1, -(e.clientY/innerHeight)*2+1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(mouse, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
    const pt    = new THREE.Vector3();
    ray.ray.intersectPlane(plane, pt);
    if (pt) {
      pTarget   = {x: pt.x, z: pt.z};
      pState    = 'walkTo';
      pCarrying = player.userData.carryMesh.visible ? pCarrying : null;
    }
  });
}

// ── Main player update ──
export function updatePlayer(player, dt) {
  const spd = playerSpeed();

  // WASD / arrow movement
  let moved = false;
  if (keys['KeyW'] || keys['ArrowUp'])    { player.position.z -= spd*dt; moved=true; }
  if (keys['KeyS'] || keys['ArrowDown'])  { player.position.z += spd*dt; moved=true; }
  if (keys['KeyA'] || keys['ArrowLeft'])  { player.position.x -= spd*dt; moved=true; }
  if (keys['KeyD'] || keys['ArrowRight']) { player.position.x += spd*dt; moved=true; }
  if (moved) { pState='idle'; pTarget=null; }

  // Click-to-move
  if (pState==='walkTo' && pTarget) {
    const arrived = stepToward(player, pTarget.x, pTarget.z, spd, dt);
    if (arrived) { pState='idle'; pTarget=null; }
  }

  // Arm swing
  const armL = player.userData.armL, armR = player.userData.armR;
  if (armL && armR) {
    const swing = Math.sin(now()*6)*0.25;
    armL.rotation.x = swing; armR.rotation.x = -swing;
  }

  // Proximity interactions
  const px = player.position.x, pz = player.position.z;

  // Near a ready plot — harvest
  if (!pCarrying) {
    for (const p of growPlots) {
      const dx=px-p.x, dz=pz-p.z;
      if (dx*dx+dz*dz < 2.5 && p.ready) { harvestPlot(p, player); break; }
    }
  }

  // Near trim station with bud — deposit or redirect to chem
  if (pCarrying==='bud') {
    if ((px-trimStation.x)**2+(pz-trimStation.z)**2 < 3.5) {
      depositAtTrim(player);
    } else if (chemStation && (px-chemStation.x)**2+(pz-chemStation.z)**2 < 3.5) {
      depositAtChem(player);
    }
  }

  // Near stash with bags
  if (pCarrying==='bag') {
    if ((px-stashNode.x)**2+(pz-stashNode.z)**2 < 4) {
      depositAtStash(player);
    }
  }

  // Pick up trimmed bags
  if (!pCarrying && G.trimBags>0) {
    if ((px-trimStation.x)**2+(pz-trimStation.z)**2 < 3) {
      pickupBagsFromTrim(player);
    }
  }

  // Pick up chem product
  if (!pCarrying && G.chemProduct>0 && chemStation) {
    if ((px-chemStation.x)**2+(pz-chemStation.z)**2 < 3.5) {
      pickupChemProduct(player);
    }
  }

  // Near dealer — sell
  for (let i=dealers.length-1; i>=0; i--) {
    const d = dealers[i];
    if (d.state==='waiting' && !d.paid) {
      const dx=px-d.group.position.x, dz=pz-d.group.position.z;
      if (dx*dx+dz*dz < 3.5) { sellToDealer(d, i); break; }
    }
  }

  player.position.y = 0;
}

// ── Actions ──
function harvestPlot(p, player) {
  p.ready=false; p.progress=0; p.stage=-1;
  updatePlantMesh(p);
  removeLabel('plot_'+growPlots.indexOf(p));
  pCarrying = 'bud';
  player.userData.carryMesh.visible = true;
  setStatus('Harvest done! Take it to the Trim Station.');
  addFeed('🌿 Harvested a plant');
}

function depositAtTrim(player) {
  G.trimQueue++;
  pCarrying = null;
  player.userData.carryMesh.visible = false;
  setStatus('Trimming in progress...');
}

function depositAtChem(player) {
  G.chemQueue++;
  pCarrying = null;
  player.userData.carryMesh.visible = false;
  setStatus('Batch queued in cook station.');
  setLabel('chem', `⚗️ Cooking... [${G.chemQueue} queued]`, chemStation.x, 2.2, chemStation.z);
}

function depositAtStash(player) {
  if (G.trimBags>0) {
    const b = G.trimBags; G.trimBags=0;
    G.stashCount += b;
    setLabel('stash', `📦 Stash [${G.stashCount}]`, stashNode.x, 2.6, stashNode.z);
    addFeed(`📦 Stashed ${b} bags`);
  }
  if (G.chemProduct>0) {
    G.stashCount += G.chemProduct; G.chemProduct=0;
    setLabel('stash', `📦 Stash [${G.stashCount}]`, stashNode.x, 2.6, stashNode.z);
  }
  pCarrying = null;
  player.userData.carryMesh.visible = false;
  setStatus(`${G.stashCount} in stash. Buyers incoming.`);
}

function pickupBagsFromTrim(player) {
  if (G.trimBags<=0) return;
  pCarrying = 'bag';
  player.userData.carryMesh.visible = true;
  player.userData.carryMesh.material.color.setHex(0x88cc22);
  player.userData.carryMesh.material.emissive.setHex(0x224400);
  setStatus('Carry to stash!');
}

function pickupChemProduct(player) {
  pCarrying = 'bag';
  player.userData.carryMesh.visible = true;
  player.userData.carryMesh.material.color.setHex(0x22ffaa);
  player.userData.carryMesh.material.emissive.setHex(0x004433);
  setLabel('chem', '⚗️ Cook Station', chemStation.x, 2.2, chemStation.z);
  setStatus('Move the product to stash!');
}

function sellToDealer(d, idx) {
  if (G.stashCount<=0) { setStatus('Stash empty!'); return; }
  d.paid = true;
  const qty   = Math.min(G.stashCount, d.buyCount);
  const price = salePrice(!!chemStation) * qty;
  G.stashCount -= qty; state.totalSold += qty;
  addCash(price);
  addHeat(heatGainPerSale());
  const s = worldToScreen(d.group.position.x, 2, d.group.position.z);
  cashPop(s.x, s.y, price);
  if (state.heat < 85) heatPop(s.x, s.y+20);
  addFeed(`💰 Sold ${qty} bags → +$${fmtCash(price)}`);
  showToast(`+$${fmtCash(price)} — ${qty} unit${qty>1?'s':''} moved`, 'good');
  d.state = 'leaving';
  setLabel('stash', `📦 Stash [${G.stashCount}]`, stashNode.x, 2.6, stashNode.z);
  saveGame();
  renderUpgradesPanel();
  renderExpandPanel();
}
