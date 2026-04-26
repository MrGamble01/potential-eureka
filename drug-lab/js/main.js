import { state, G, ROOM_DEFS } from './config.js';
import {
  scene, renderer, applyCamera, fitCamera,
  panX, panZ, cameraZoom, setCameraZoom, setPan,
  buildRoom,
  growPlots, updatePlantMesh, buildGrowPlot,
  buildTrimStation, buildStash, buildHazmatCharacter,
  trimStation,
  dealers, trimmerNPCs, lookoutNPCs,
  updateSteam,
} from './scene.js';
import {
  refreshHud, renderExpandPanel, renderUpgradesPanel,
  addFeed, showToast, initUIHandlers, updateLabels, tickStatus,
} from './ui.js';
import { updatePlayer, initPlayerInput, resetPlayerState } from './player.js';
import {
  updateGrowPlots, updateTrimStation, updateChemStation,
  updateDealers, updateDealerSpawn, updateTrimmerNPCs, updateLookoutNPCs,
  updateHeatDrain, updateEvents,
} from './gameloop.js';
import { saveGame, loadGame } from './save.js';

// ── Build starter scene objects ──
buildRoom(ROOM_DEFS[0]);
buildTrimStation(0, 2);
buildStash(0, -5.5);
buildGrowPlot(-2.5, -2, 'garage');
buildGrowPlot( 2.5, -2, 'garage');

// ── Player ──
const player = buildHazmatCharacter();
player.position.set(0, 0, 0);
scene.add(player);
initPlayerInput(player);

// ── Load saved game ──
loadGame();

// ── Camera pan / zoom input ──
let panDrag=false, panStartX=0, panStartZ=0, panMouseX=0, panMouseY=0;
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
renderer.domElement.addEventListener('mousedown', e => {
  if (e.button===2) {
    panDrag=true; panMouseX=e.clientX; panMouseY=e.clientY;
    panStartX=panX; panStartZ=panZ;
  }
});
window.addEventListener('mouseup',   e => { if (e.button===2) panDrag=false; });
window.addEventListener('mousemove', e => {
  if (!panDrag) return;
  setPan(panStartX - (e.clientX-panMouseX)*0.04, panStartZ - (e.clientY-panMouseY)*0.04);
  applyCamera();
});
renderer.domElement.addEventListener('wheel', e => {
  setCameraZoom(cameraZoom + e.deltaY*0.01);
  fitCamera();
});

// ── Reset game ──
function resetGame() {
  Object.assign(state, {
    cash:50, totalEarned:0, totalSold:0, heat:0,
    upgrades:{}, ownedRooms:['garage'],
    trimmers:0, lookouts:0, runners:0, cooks:0,
    batches:0, sessionStart:Date.now(),
  });
  Object.assign(G, {
    stashCount:0, trimProgress:0, trimQueue:0, trimBags:0,
    chemProgress:0, chemQueue:0, chemProduct:0,
    activeEvent:null, eventCooldown:60,
    raidActive:false, raidTimer:0, dealerSpawnTimer:0,
  });
  resetPlayerState();
  for (const d of dealers)     scene.remove(d.group);   dealers.length=0;
  for (const t of trimmerNPCs) scene.remove(t.group);   trimmerNPCs.length=0;
  for (const l of lookoutNPCs) scene.remove(l.group);   lookoutNPCs.length=0;
  for (const p of growPlots)   { p.progress=Math.random()*0.3; p.ready=false; p.stage=-1; updatePlantMesh(p); }
  document.getElementById('raid-overlay').classList.remove('active');
  document.getElementById('status-bar').classList.remove('event-active');
  saveGame(); refreshHud(); renderExpandPanel(); renderUpgradesPanel();
  showToast('Starting over. Stay low.', 'info');
}

// ── Button wiring ──
document.getElementById('restart-btn').onclick = () => { if (confirm('Reset all progress?')) resetGame(); };
document.getElementById('bust-restart-btn').addEventListener('click', () => {
  document.getElementById('bust-modal').classList.remove('open');
  resetGame();
});
initUIHandlers();

// ── Initial UI ──
refreshHud(); renderUpgradesPanel(); renderExpandPanel();
addFeed('🌿 Operation started');
addFeed('💡 Plants need ~18s to grow');
addFeed('🏃 Walk to ready plants to harvest');
window.addEventListener('beforeunload', saveGame);

// ── Render loop ──
let lastTime    = performance.now();
let autoSaveTimer = 0;

function animate(now_ms) {
  requestAnimationFrame(animate);
  const dt = Math.min((now_ms - lastTime)/1000, 0.1);
  lastTime = now_ms;

  if (!G.raidActive) {
    updateGrowPlots(dt);
    updateTrimStation(dt);
    updateChemStation(dt);
    updatePlayer(player, dt);
    updateDealers(dt);
    updateTrimmerNPCs(dt);
    updateLookoutNPCs(dt);
    updateSteam(dt);
    updateHeatDrain(dt);
    updateEvents(dt);
    updateDealerSpawn(dt);
  } else {
    G.raidTimer -= dt;
    if (G.raidTimer <= 0) {
      G.raidActive = false;
      document.getElementById('raid-overlay').classList.remove('active');
      document.getElementById('status-bar').classList.remove('event-active');
      document.getElementById('status-bar').textContent = 'Heat died down. Resume operations.';
      showToast('DEA pulled out. Stay careful.', 'info');
    }
  }

  tickStatus(dt);
  autoSaveTimer += dt;
  if (autoSaveTimer > 8) { autoSaveTimer=0; saveGame(); }

  updateLabels(growPlots, dealers, trimStation, G);
  renderer.render(scene, camera);
}

requestAnimationFrame(animate);
