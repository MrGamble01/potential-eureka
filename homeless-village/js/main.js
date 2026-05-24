var lastTime=0, autosaveTimer=0, camSwayT=0;

loadGame();
refreshStructures();
buildActionUI();
buildCraftUI();
buildWorkersUI();
updateHUD();
log('Another day under the bridge. Same as always.');

function gameLoop(ts){
  requestAnimationFrame(gameLoop);
  var dt=Math.min(ts-lastTime,100);
  lastTime=ts;

  // Camera gentle sway
  camSwayT+=dt*.0003;
  camera.position.x=20+Math.sin(camSwayT)*.15;
  camera.position.z=20+Math.cos(camSwayT*.7)*.12;
  camera.lookAt(0,0,0);

  // Fire flicker
  fireLights.forEach(function(fl,i){
    fl.intensity=2.0+Math.sin(ts*.003+i*1.7)*.6+Math.sin(ts*.007+i*.9)*.3;
    fl.color.setRGB(1,(80+Math.sin(ts*.005+i)*30)/255,.04);
  });

  // Figure wander + bob
  figures.forEach(function(f){
    f.userData.bobPhase+=dt*.003;
    f.position.y=Math.abs(Math.sin(f.userData.bobPhase))*.06;
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
