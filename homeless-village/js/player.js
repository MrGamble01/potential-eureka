function rand(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }

function doAction(a){
  var now=Date.now();
  if(activeJobs[a.id]) return;
  if(G.cooldowns[a.id] && now<G.cooldowns[a.id]) return;
  var duration=now<G.injuredUntil ? a.time*1.8 : a.time;
  activeJobs[a.id]={startTime:now,duration:duration};
  var btn=document.getElementById('action-'+a.id);
  if(btn){ btn.classList.add('active-job'); btn.disabled=true; }
  setTimeout(function(){ finishAction(a); }, duration);
}

function finishAction(a){
  var now=Date.now();
  delete activeJobs[a.id];
  G.cooldowns[a.id]=now+a.cooldown;
  var btn=document.getElementById('action-'+a.id);
  if(btn){ btn.classList.remove('active-job'); btn.disabled=false; }

  if(a.id==='scavenge'){
    var wm=G.season===3?.5:1;
    if(Math.random()<.2*wm){
      log('The dumpster is empty. Nothing today.');
    } else {
      var c=Math.floor(rand(0,3)*wm), s=Math.floor(rand(1,4)*wm), f=Math.random()<.45?Math.floor(rand(1,3)*wm):0;
      G.cans+=c; G.scraps+=s; G.food+=f; G.totalScavenged++;
      log('Scavenged: '+c+' cans, '+s+' scraps'+(f>0?', '+f+' food':'')+'.'); }
  } else if(a.id==='forage'){
    var w=rand(1,4),cb=rand(2,6); G.wood+=w; G.cardboard+=cb;
    log('Found '+w+' wood and '+cb+' cardboard.');
  } else if(a.id==='panhandle'){
    if(Math.random()<.55){ var g=rand(1,4); G.goodwill+=g; log('Someone gave you a few coins. +'+g+' goodwill.'); }
    else { G.morale=Math.max(0,G.morale-3); log('Ignored again. Morale fades a little.'); }
  } else if(a.id==='rest'){
    var h=rand(5,15); G.health=Math.min(100,G.health+h); G.morale=Math.min(100,G.morale+rand(3,8));
    log('You rest. Health +'+h+'.');
  } else if(a.id==='trade'){
    if(G.cans>=3){ G.cans-=3; G.food+=2; log('Traded 3 cans → 2 food.'); }
    else log('Not enough cans to trade.');
  }
  updateHUD();
}

function doCraft(r){
  // Mutex, like doAction's activeJobs: any craft completion rebuilds
  // the whole panel (fresh clickable nodes), so without this a second
  // click on a still-running recipe deducted its cost twice.
  if(G.activeCrafts[r.id]) return;
  if(!canCraft(r)) return;
  var dur=r.time*(G.workers.builder?.5:1);
  Object.entries(r.cost).forEach(function(e){ G[e[0]]-=e[1]; });
  // Persist the in-flight job in the same write as the cost — closing
  // the tab mid-craft used to destroy the resources with no result.
  G.activeCrafts[r.id]={start:Date.now(),duration:dur};
  saveGame();
  updateHUD();
  markCraftBusy(r.id,true);
  setTimeout(function(){ finishCraft(r); }, dur);
}

function finishCraft(r){
  if(!G.activeCrafts[r.id]) return; // already resolved (fast-forwarded on load)
  delete G.activeCrafts[r.id];
  markCraftBusy(r.id,false);
  if(r.gives.structure){ G.structures[r.gives.structure]=true; refreshStructures(); }
  if(r.gives.warmth)   G.warmth=Math.min(100,G.warmth+r.gives.warmth);
  if(r.gives.goodwill) G.goodwill+=r.gives.goodwill;
  G.totalCrafted++;
  log('Crafted '+r.name+'.');
  saveGame();
  updateHUD(); buildCraftUI();
}

// Crafts that were mid-flight when the page closed: the cost was paid
// at start, so grant elapsed ones now and re-arm timers for the rest.
function resumeCrafts(){
  Object.keys(G.activeCrafts).forEach(function(id){
    var r=RECIPES.find(function(x){ return x.id===id; });
    if(!r){ delete G.activeCrafts[id]; return; }
    var j=G.activeCrafts[id], remaining=(j.start+j.duration)-Date.now();
    if(remaining<=0) finishCraft(r);
    else setTimeout(function(){ finishCraft(r); }, remaining);
  });
}

function hireWorker(id){
  var def=WORKER_DEFS.find(function(w){ return w.id===id; });
  if(!def) return;
  if(G.goodwill<def.cost){ log('Not enough goodwill to recruit '+def.name+'.'); return; }
  G.goodwill-=def.cost; G.workers[id]=true;
  G.population=Math.min(20,G.population+1);
  spawnFigure((Math.random()-.5)*10,(Math.random()-.5)*10,'community');
  log(def.name+' joined the community.');
  buildWorkersUI(); updateHUD();
}
