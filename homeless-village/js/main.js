var lastTime=0, autosaveTimer=0, camSwayT=0;
var barsLit={};   // HV-73: progress bars filled last frame, by job id

// ── Player input ──
// Previously there was NO player control: `player` (scene.js) was just
// another entry in the figures[] wander array, moved by the same random-
// target AI as NPCs. This gives it real WASD/arrow-key control instead —
// the player is now excluded from the wander loop below and driven here.
var PLAYER_SPEED = 4.2; // world units / second
// Keeps the player inside the lit diorama (under the bridge deck, clear
// of the fixed ortho camera's edges) instead of walking off into fog.
var PLAYER_BOUNDS = {x:11, zMin:-6.3, zMax:6.3};
var keysDown = {};
var MOVE_KEYS = {
  KeyW:'up',    ArrowUp:'up',
  KeyS:'down',  ArrowDown:'down',
  KeyA:'left',  ArrowLeft:'left',
  KeyD:'right', ArrowRight:'right'
};
window.addEventListener('keydown', function(e){
  var dir = MOVE_KEYS[e.code];
  if(!dir) return;
  keysDown[dir] = true;
  e.preventDefault(); // don't let arrow keys scroll the page under the fixed HUD
}, {passive:false});
window.addEventListener('keyup', function(e){
  var dir = MOVE_KEYS[e.code];
  if(dir) keysDown[dir] = false;
});
// Alt-tabbing away mid-press must not leave a key "stuck" down forever.
window.addEventListener('blur', function(){ keysDown = {}; });

// HV-58: Escape closes The Bridge.
//
// #chain-modal already dismisses via × and backdrop (ui.js). Escape was
// only wired for the HV-56 first-run intro, which keys off #intro-modal
// and never sees this overlay. Same class of drift as TYC-60 / LAB-61.
// Lives here — not in ui.js — so this ticket does not collide with
// HV-57's payout work on that file. Do not call closeIntro(): that
// would mark the crash course seen.
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape'){
    var m = document.getElementById('chain-modal');
    if(m && m.classList.contains('open')){
      m.classList.remove('open');
    }
  }
});

// Tap/click-to-walk: the touch-input HV never had (IDEA-HV-2's gate would
// otherwise brick scavenging on phones, which have no WASD). A tap on the
// ground raycasts to the y=0 plane and the player walks there; any key
// press cancels the walk and takes over.
var walkTarget=null;
var _ray=new THREE.Raycaster();
var _groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
var _hit=new THREE.Vector3();
renderer.domElement.addEventListener('pointerdown', function(e){
  // Don't hijack taps meant for HUD buttons layered over the canvas.
  if(e.target!==renderer.domElement) return;
  var r=renderer.domElement.getBoundingClientRect();
  var ndc={ x:((e.clientX-r.left)/r.width)*2-1, y:-((e.clientY-r.top)/r.height)*2+1 };
  _ray.setFromCamera(ndc, camera);
  if(_ray.ray.intersectPlane(_groundPlane,_hit)){
    walkTarget={
      x:Math.max(-PLAYER_BOUNDS.x,Math.min(PLAYER_BOUNDS.x,_hit.x)),
      z:Math.max(PLAYER_BOUNDS.zMin,Math.min(PLAYER_BOUNDS.zMax,_hit.z)),
    };
  }
});

function movePlayer(dt){
  var dx=0, dz=0;
  if(keysDown.up)    dz-=1;
  if(keysDown.down)  dz+=1;
  if(keysDown.left)  dx-=1;
  if(keysDown.right) dx+=1;
  if(dx!==0||dz!==0){
    walkTarget=null;             // keys always win over a queued tap-walk
  } else if(walkTarget){
    dx=walkTarget.x-player.position.x;
    dz=walkTarget.z-player.position.z;
    if(Math.sqrt(dx*dx+dz*dz)<0.15){ walkTarget=null; return; }
  } else return;
  var len=Math.sqrt(dx*dx+dz*dz);
  dx/=len; dz/=len;
  var dist=PLAYER_SPEED*(dt/1000);
  var nx=player.position.x+dx*dist, nz=player.position.z+dz*dist;
  player.position.x=Math.max(-PLAYER_BOUNDS.x,Math.min(PLAYER_BOUNDS.x,nx));
  player.position.z=Math.max(PLAYER_BOUNDS.zMin,Math.min(PLAYER_BOUNDS.zMax,nz));
  player.rotation.y=Math.atan2(dx,dz);
}

loadGame();
refreshStructures();
for (var i = 1; i < G.population; i++) { spawnFigure((Math.random()-.5)*10, (Math.random()-.5)*10, 'community'); }
buildActionUI();
buildCraftUI();
buildWorkersUI();
resumeCrafts();
updateHUD();
log('Another day under the bridge. Same as always.');
if(G.days===0 && G.arcStage===0){
  log('Word around the camps: a county case worker visits the ones that hold together. Build something worth seeing.');
}
// HV-31: the corner fridge counts every camp that forms beside it —
// once per camp, and Start Over can't unplug it.
if(!G.fridgeSeeded){
  G.fridgeSeeded=true;
  var _fr=loadFridge();
  if(_fr.built){
    _fr.camps=(_fr.camps||0)+1; saveFridge(_fr);
    // HV-36: with the bulletin board up, the block knows the new
    // camp better — 5 goodwill instead of 3.
    var _seed=fridgeSeedNow();
    G.goodwill=(G.goodwill||0)+_seed;
    if(fridgeHasBoard()){
      // HV-39: the shelf tells the deeper welcome.
      if(fridgeHasShelf()){
        log('\uD83E\uDDCA The corner fridge hums under its community shelf \u2014 blankets, socks, a working can opener. The block knows this camp like family. +'+_seed+'\ud83e\ude76');
      } else {
        log('\uD83E\uDDCA The corner fridge still hums, its bulletin board full \u2014 the block already knows this camp well. +'+_seed+'\ud83e\ude76');
      }
      // HV-37: the board means the potluck — the block throws one
      // for every fresh camp now.
      var _pl=loadPotluck();
      savePotluck({days:_pl.days+1});
      G.food=(G.food||0)+POTLUCK_FOOD;
      G.morale=Math.min(100,(G.morale||0)+POTLUCK_MORALE);
      log('\ud83c\udf72 POTLUCK \u2014 folding tables by the fridge, everyone brings a dish. +'+POTLUCK_FOOD+'\ud83e\udd63, +'+POTLUCK_MORALE+'\ud83d\ude0a');
    } else {
      log('\uD83E\uDDCA The corner fridge still hums \u2014 the block already knows this camp. +'+_seed+'\ud83e\ude76');
    }
    updateHUD();
  }
  deliverHvNote();   // HV-33: and the door holds a note for whoever comes next
  saveGame();
}
// A save whose health already hit 0 (lost, then tab closed without
// pressing Start Over) must not resume as a playable camp.
if(G.health<=0) showGameOver();

// The next frame used to be scheduled BEFORE the body ran, so any
// per-frame exception (e.g. the three.js CDN failing → camera
// undefined) repeated at 60fps forever over a black canvas. Schedule
// at the end instead, tolerate a few transient errors, then stop the
// loop and surface the failure.
var frameErrors=0;
function gameLoop(ts){
  try{ frame(ts); }
  catch(e){
    if(++frameErrors>10){
      if(typeof hvFatal==='function') hvFatal('The game hit a fatal error and stopped. Reload to continue.');
      return; // stop re-arming — no more error storm
    }
  }
  requestAnimationFrame(gameLoop);
}

function frame(ts){
  var dt=Math.min(ts-lastTime,100);
  lastTime=ts;

  // Camera gentle sway
  camSwayT+=dt*.0003;
  camera.position.x=20+Math.sin(camSwayT)*.15;
  camera.position.z=20+Math.cos(camSwayT*.7)*.12;
  camera.lookAt(0,0,0);

  // Fire flicker (dimmed while a "fire burned out" event is active)
  var fireOut = Date.now() < (G.fireOutUntil||0);
  fireLights.forEach(function(fl,i){
    if(fireOut){ fl.intensity=0.1; fl.color.setRGB(1,.3,.04); return; }
    fl.intensity=2.0+Math.sin(ts*.003+i*1.7)*.6+Math.sin(ts*.007+i*.9)*.3;
    fl.color.setRGB(1,(80+Math.sin(ts*.005+i)*30)/255,.04);
  });

  // NPC wander + bob (the player figure is driven by movePlayer() below,
  // not this random-target AI — see the "Player input" block above).
  figures.forEach(function(f){
    f.userData.bobPhase+=dt*.003;
    f.position.y=Math.abs(Math.sin(f.userData.bobPhase))*.06;
    if(f.userData.type==='player') return;
    f.userData.wanderTimer-=dt;
    if(f.userData.wanderTimer<=0){
      f.userData.wanderTimer=3000+Math.random()*5000;
      var r=Math.random(), cx, cz;
      if(r<.35){ cx=-3+(Math.random()-.5)*3; cz=(Math.random()-.5)*3; }
      else if(r<.55&&G.structures.workbench){ cx=3+(Math.random()-.5)*2; cz=2+(Math.random()-.5)*2; }
      else { cx=(Math.random()-.5)*16; cz=(Math.random()-.5)*10; }
      f.userData.target.set(cx,0,cz);
    }
    var dx=f.userData.target.x-f.position.x, dz=f.userData.target.z-f.position.z;
    var dist=Math.sqrt(dx*dx+dz*dz);
    if(dist>.1){
      // `speed` is units per 60fps frame (see spawnFigure). frame()'s dt
      // is raw milliseconds (clamped to 100), so the step is speed ×
      // frames-elapsed: dt/16.667. It used to read `dt*.016*60`
      // (=dt*0.96) — 16× too fast — which both sprinted residents past
      // the player and overshot the 0.1 arrival test into a permanent
      // ping-pong across the target.
      // Never stride past the target: the arrival test above is a 0.1
      // window, and a laggy frame (dt clamps at 100ms, six frames) gives
      // the fastest residents a 0.21 stride that can still straddle it
      // and ping-pong. Capping the step at the remaining distance lands
      // them on the spot whatever the frame rate.
      var sp=Math.min(f.userData.speed*(dt/16.667),dist);
      f.position.x+=dx/dist*sp; f.position.z+=dz/dist*sp;
      f.rotation.y=Math.atan2(dx,dz);
    }
  });
  movePlayer(dt);
  updateScavengeGate();

  // Cooldown disable for the fixed action list.
  ACTIONS.forEach(function(a){
    var btn=document.getElementById('action-'+a.id);
    if(btn&&!activeJobs[a.id]){ var cd=G.cooldowns[a.id]; btn.disabled=!!(cd&&Date.now()<cd); }
  });
  // HV-73: progress bars ride every running job, not just ACTIONS. The
  // odd job, mural, meeting, deposit run, busk, newcomer, ticket and
  // dry corner are appended by buildActionUI outside that table, and
  // this loop used to walk ACTIONS only — so their bar sat at 0% for
  // the whole 6–8s job while the border pulsed. Bars lit last frame
  // are reset to 0% the moment their job is gone, without waiting on
  // a panel rebuild (a lapsed ask or a refused build never rebuilds).
  var nowMs=Date.now();
  Object.keys(activeJobs).forEach(function(id){
    var job=activeJobs[id], pb=document.getElementById('progress-'+id);
    if(pb) pb.style.width=Math.min(100,((nowMs-job.startTime)/job.duration)*100)+'%';
    barsLit[id]=true;
  });
  Object.keys(barsLit).forEach(function(id){
    if(activeJobs[id]) return;
    delete barsLit[id];
    var pb=document.getElementById('progress-'+id);
    if(pb) pb.style.width='0%';
  });

  tickDay(dt);

  autosaveTimer+=dt;
  if(autosaveTimer>30000){ autosaveTimer=0; saveGame(); }

  renderer.render(scene,camera);
}

requestAnimationFrame(gameLoop);
