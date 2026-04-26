import { LS_KEY, state, G, ROOM_DEFS } from './config.js';
import {
  ownedRoomSet, roomCenter, buildRoom, onRoomUnlocked,
  trimStation, trimmerNPCs, buildTrimmerNPC,
  lookoutNPCs, buildLookoutNPC,
  chemStation, buildChemStation,
  scene,
} from './scene.js';

export function saveGame() {
  const sv = {
    cash: state.cash, totalEarned: state.totalEarned, totalSold: state.totalSold,
    heat: state.heat, upgrades: state.upgrades,
    ownedRooms: [...ownedRoomSet],
    trimmers: state.trimmers, lookouts: state.lookouts,
    runners:  state.runners||0, cooks: state.cooks||0,
    batches: state.batches, sessionStart: state.sessionStart,
    stashCount: G.stashCount, trimQueue: G.trimQueue, trimBags: G.trimBags,
  };
  try { localStorage.setItem(LS_KEY, JSON.stringify(sv)); } catch(e) {}
}

export function loadGame() {
  try {
    const sv = JSON.parse(localStorage.getItem(LS_KEY)||'null');
    if (!sv) return;
    state.cash         = sv.cash         || 50;
    state.totalEarned  = sv.totalEarned  || 0;
    state.totalSold    = sv.totalSold    || 0;
    state.heat         = Math.min(99, sv.heat||0);
    state.upgrades     = sv.upgrades     || {};
    state.trimmers     = sv.trimmers     || 0;
    state.lookouts     = sv.lookouts     || 0;
    state.runners      = sv.runners      || 0;
    state.cooks        = sv.cooks        || 0;
    state.batches      = sv.batches      || 0;
    state.sessionStart = sv.sessionStart || Date.now();
    G.stashCount       = sv.stashCount   || 0;
    G.trimQueue        = sv.trimQueue    || 0;
    G.trimBags         = sv.trimBags     || 0;

    // Restore rooms
    for (const id of (sv.ownedRooms || ['garage'])) {
      if (id==='garage') continue;
      const def = ROOM_DEFS.find(r => r.id===id);
      if (def && !ownedRoomSet.has(id)) {
        ownedRoomSet.add(id); state.ownedRooms.push(id);
        buildRoom(def); onRoomUnlocked(id);
      }
    }

    // Restore chem station if chemistry upgrade was bought but lab not owned
    if ((state.upgrades['chemistry']||0)>=1 && !chemStation) {
      const labDef = ROOM_DEFS.find(r => r.id==='lab');
      if (ownedRoomSet.has('lab')) {
        const {cx,cz} = roomCenter(labDef);
        buildChemStation(cx, cz);
      } else {
        buildChemStation(-6, -5);
      }
    }

    // Restore crew NPCs
    for (let i=0; i<state.trimmers; i++) {
      const g = buildTrimmerNPC();
      g.position.set(trimStation.x+(Math.random()-0.5)*2, 0, trimStation.z+(Math.random()-0.5)*2);
      scene.add(g); trimmerNPCs.push({group:g, state:'idle', timer:0});
    }
    for (let i=0; i<state.lookouts; i++) {
      const g = buildLookoutNPC();
      g.position.set(6+(Math.random()-0.5)*3, 0, 7+(Math.random()-0.5)*3);
      scene.add(g); lookoutNPCs.push({group:g, patrolAngle:Math.random()*Math.PI*2, patrolRadius:4+Math.random()*2});
    }
  } catch(e) { console.warn('Load failed', e); }
}
