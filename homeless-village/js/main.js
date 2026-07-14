var lastTime=0, autosaveTimer=0, camSwayT=0;

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

function movePlayer(dt){
  var dx=0, dz=0;
  if(keysDown.up)    dz-=1;
  if(keysDown.down)  dz+=1;
  if(keysDown.left)  dx-=1;
  if(keysDown.right) dx+=1;
  if(dx===0 && dz===0) return;
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
      var sp=f.userData.speed*dt*.016*60;
      f.position.x+=dx/dist*sp; f.position.z+=dz/dist*sp;
      f.rotation.y=Math.atan2(dx,dz);
    }
  });
  movePlayer(dt);

  // Action progress bars + cooldown disable
  ACTIONS.forEach(function(a){
    var job=activeJobs[a.id];
    var pb=document.getElementById('progress-'+a.id);
    if(pb) pb.style.width=job?Math.min(100,((Date.now()-job.startTime)/job.duration)*100)+'%':'0%';
    var btn=document.getElementById('action-'+a.id);
    if(btn&&!job){ var cd=G.cooldowns[a.id]; btn.disabled=!!(cd&&Date.now()<cd); }
  });

  tickDay(dt);

  autosaveTimer+=dt;
  if(autosaveTimer>30000){ autosaveTimer=0; saveGame(); }

  renderer.render(scene,camera);
}

requestAnimationFrame(gameLoop);
