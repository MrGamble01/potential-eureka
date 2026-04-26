import { G, state, growTime, TRIM_TIME, CHEM_TIME, heatDrainPerSec, dealerArrivalTime, upgLv, now } from './config.js';
import {
  scene, growPlots, updatePlantMesh, setLabel, removeLabel,
  trimStation, stashNode, chemStation, spawnSteam,
  dealers, buildDealer, trimmerNPCs, lookoutNPCs, stepToward,
} from './scene.js';
import { addFeed, showToast, addHeat, triggerEvent, triggerRaid, updateHeatDisplay } from './ui.js';

// ── Grow plots ──
export function updateGrowPlots(dt) {
  const speed = 1/growTime();
  for (const p of growPlots) {
    if (p.ready) continue;
    p.progress = Math.min(1, p.progress + speed*dt);
    if (p.progress>=1 && !p.ready) {
      p.ready = true;
      setLabel('plot_'+growPlots.indexOf(p), '🌿 Ready!', p.x, 1.8, p.z, 'ready');
    }
    if (p.stage !== Math.floor(p.progress*3)+1) updatePlantMesh(p);
    p.uvLight.intensity = 0.5 + Math.sin(now()*3+p.x)*0.1;
  }
}

// ── Trim station ──
export function updateTrimStation(dt) {
  if (G.trimQueue<=0) return;
  const speedMult = 1 + upgLv('trim')*0.25 + trimmerNPCs.length*0.4;
  G.trimProgress += (dt/TRIM_TIME)*speedMult;
  if (G.trimProgress>=1) {
    G.trimProgress=0; G.trimQueue--;
    const bags = 1 + upgLv('yield1');
    G.trimBags += bags; state.batches++;
    addFeed(`✂️ Trimmed batch → ${bags} bags`);
  }
}

// ── Chemistry station ──
export function updateChemStation(dt) {
  if (!chemStation || G.chemQueue<=0) return;
  const speedMult = 1 + (state.cooks||0)*0.5;
  G.chemProgress += (dt/CHEM_TIME)*speedMult;
  if (G.chemProgress>=1) {
    G.chemProgress=0; G.chemQueue--;
    G.chemProduct+=2; state.batches++;
    addFeed('⚗️ Batch cooked → 2 units');
    setLabel('chem', `⚗️ Cook Station [${G.chemProduct} units]`, chemStation.x, 2.2, chemStation.z);
  }
  if (Math.random()<dt*3) spawnSteam(chemStation.x, chemStation.z);
  chemStation.burnerLight.intensity = 0.6 + Math.sin(now()*8)*0.25;
}

// ── Dealers ──
export function spawnDealer() {
  if (G.stashCount<1) return;
  const spawnX = (Math.random()-0.5)*12;
  const g = buildDealer();
  g.position.set(spawnX, 0, 9);
  scene.add(g);
  dealers.push({group:g, state:'walking', paid:false, buyCount:1+Math.floor(Math.random()*2)});
  addFeed('👤 Buyer incoming');
}

export function updateDealers(dt) {
  for (let i=dealers.length-1; i>=0; i--) {
    const d = dealers[i];
    if (d.state==='walking') {
      const arrived = stepToward(d.group, stashNode.x+(Math.random()-0.5)*2, stashNode.z+3, 2.2, dt);
      if (arrived) { d.state='waiting'; setLabel('deal_'+i,'💰 Buyer',d.group.position.x,2.2,d.group.position.z,'prompt'); }
    } else if (d.state==='leaving') {
      removeLabel('deal_'+i);
      const gone = stepToward(d.group, d.group.position.x+(Math.random()-0.5)*4, 10, 2.5, dt);
      if (gone || d.group.position.z>12) { scene.remove(d.group); dealers.splice(i,1); }
    } else if (d.state==='waiting') {
      if (G.stashCount<=0) { d.state='leaving'; removeLabel('deal_'+i); }
    }
  }
}

export function updateDealerSpawn(dt) {
  if (G.stashCount<=0) return;
  G.dealerSpawnTimer += dt;
  if (G.dealerSpawnTimer >= dealerArrivalTime()) {
    G.dealerSpawnTimer = 0;
    if (dealers.filter(d=>d.state!=='leaving').length < 4) spawnDealer();
  }
}

// ── Trimmer NPCs ──
export function updateTrimmerNPCs(dt) {
  for (const t of trimmerNPCs) {
    if (G.trimQueue>0)
      stepToward(t.group, trimStation.x+(Math.random()-0.5)*0.6, trimStation.z+1.2, 2.5, dt);
    else
      stepToward(t.group, trimStation.x+(Math.random()-0.5)*3, trimStation.z+(Math.random()-0.5)*2, 1.0, dt);
  }
}

// ── Lookout NPCs ──
export function updateLookoutNPCs(dt) {
  for (const l of lookoutNPCs) {
    l.patrolAngle += dt*0.5;
    stepToward(l.group, l.patrolRadius*Math.cos(l.patrolAngle), l.patrolRadius*Math.sin(l.patrolAngle)+5, 2.0, dt);
  }
}

// ── Heat drain ──
export function updateHeatDrain(dt) {
  if (state.heat<=0) return;
  state.heat = Math.max(0, state.heat - heatDrainPerSec()*dt);
  updateHeatDisplay();
}

// ── Events ──
export function updateEvents(dt) {
  if (G.activeEvent) return;
  G.eventCooldown -= dt;
  if (state.heat>=95 && !G.raidActive) { triggerRaid(); G.eventCooldown=90; return; }
  if (G.eventCooldown<=0 && state.totalEarned>100) {
    G.eventCooldown = 50 + Math.random()*50;
    if (Math.random()<0.4) triggerEvent();
  }
}
