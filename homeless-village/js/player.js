function rand(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }

// ── Proximity gate (IDEA-HV-2) ──
// Scavenging only works standing at a dumpster: walk (WASD or tap the
// ground) up to one of the three bins. Range is generous — the bins are
// 1.6 units wide and the player capsule has its own radius.
var SCAVENGE_RANGE=3.2;
function nearestDumpsterDist(){
  if(typeof dumpsters==='undefined' || !dumpsters.length || typeof player==='undefined') return 0;
  var best=Infinity;
  for(var i=0;i<dumpsters.length;i++){
    var dx=dumpsters[i].position.x-player.position.x;
    var dz=dumpsters[i].position.z-player.position.z;
    var d=Math.sqrt(dx*dx+dz*dz);
    if(d<best) best=d;
  }
  return best;
}
function scavengeInRange(){ return nearestDumpsterDist()<=SCAVENGE_RANGE; }

// Called every frame from main.js so the button reads as walk-up-able
// rather than mysteriously dead. Only touches the DOM on state changes.
var _scavGateOut=null;
function updateScavengeGate(){
  var out=!scavengeInRange();
  if(out===_scavGateOut) return;
  _scavGateOut=out;
  var btn=document.getElementById('action-scavenge');
  if(!btn) return;
  btn.classList.toggle('out-of-range',out);
  btn.title=out ? 'Too far — walk up to a dumpster first (WASD or tap the ground)'
                : 'Dig through dumpsters for scraps, cans, or food.';
}

function doAction(a){
  var now=Date.now();
  if(activeJobs[a.id]) return;
  if(a.id==='oddjob' && oddJobDone()){ log('Today’s odd job is done — check the board tomorrow.'); return; }
  if(a.id==='mural'){
    if(muralDone()){ log('Today’s panel needs to dry — one session a day is all the wall gets.'); return; }
    if(G.scraps<2){ log('Not enough scraps to mix paint (need 2).'); sfx('error'); return; }
  }
  if(a.id==='meeting' && meetingDone()){ log('The camp met recently — give it a day or two.'); return; }
  if(G.cooldowns[a.id] && now<G.cooldowns[a.id]) return;
  if(a.id==='scavenge' && !scavengeInRange()){
    log('Too far from a dumpster — walk up to one first (WASD or tap the ground).');
    sfx('error');
    return;
  }
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
    var wm=(G.season===3?.5:1)*weatherDef().scav;
    // HV-7: Old Ray knows which dumpsters are worth the walk — empty
    // hauls happen half as often once he's a friend.
    if(Math.random()<.2*wm*(regularStage('ray')===2?.5:1)){
      log('The dumpster is empty. Nothing today.');
    } else {
      var c=Math.floor(rand(0,3)*wm), s=Math.floor(rand(1,4)*wm), f=Math.random()<.45?Math.floor(rand(1,3)*wm):0;
      G.cans+=c; G.scraps+=s; G.food+=f; G.totalScavenged++;
      var parts=[]; if(c>0)parts.push('+'+c+'🫙'); if(s>0)parts.push('+'+s+'🧱'); if(f>0)parts.push('+'+f+'🍞');
      if(parts.length) floatText(parts.join(' '));
      log('Scavenged: '+c+' cans, '+s+' scraps'+(f>0?', '+f+' food':'')+'.'); }
  } else if(a.id==='forage'){
    var w=rand(1,4),cb=rand(2,6); G.wood+=w; G.cardboard+=cb;
    floatText('+'+w+'🪵 +'+cb+'📦');
    log('Found '+w+' wood and '+cb+' cardboard.');
  } else if(a.id==='panhandle'){
    // HV-6: people stop for the dog — a fed Biscuit at your side makes
    // strangers noticeably more generous.
    var dogBoost=G.dog===2&&!G.dogHungry?1.25:1;
    // HV-9: once the neighborhood knows you, strangers stop less warily
    var repBoost=repTier()>=1?1.15:1;
    // HV-11: people slow down for the finished mural — and stay a moment
    var muralBoost=(G.mural||0)>=MURAL_PANELS?1.1:1;
    if(Math.random()<.55*weatherDef().pan*dogBoost*repBoost*muralBoost){ var g=rand(1,4); G.goodwill+=g; floatText('+'+g+'🩶'); log('Someone gave you a few coins. +'+g+' goodwill.');
      bumpRegular('dee'); addRep(1); }
    else { G.morale=Math.max(0,G.morale-3); log('Ignored again. Morale fades a little.'); }
  } else if(a.id==='rest'){
    var h=rand(5,15); G.health=Math.min(100,G.health+h); G.morale=Math.min(100,G.morale+rand(3,8));
    floatText('+'+h+'❤️');
    log('You rest. Health +'+h+'.');
    bumpRegular('ray');
  } else if(a.id==='trade'){
    if(G.cans>=3){ G.cans-=3; G.food+=2; floatText('+2🍞'); log('Traded 3 cans → 2 food.');
      bumpRegular('marisol'); addRep(1); }
    else log('Not enough cans to trade.');
  } else if(a.id==='oddjob'){
    // HV-8: today's bulletin-board posting pays out and closes for the day
    var j=todaysJob(), parts=[];
    for(var k in j.gives){
      if(k==='morale') G.morale=Math.min(100,G.morale+j.gives[k]);
      else G[k]=(G[k]||0)+j.gives[k];
      parts.push('+'+j.gives[k]+({goodwill:'🩶',food:'🍞',scraps:'🧱',cans:'🫙',morale:'😊'}[k]||k));
    }
    G.oddJobDay=G.days;
    addRep(3);   // HV-9: honest work is how the neighborhood learns your name
    floatText(parts.join(' '));
    log('Odd job done: '+j.label.toLowerCase()+'. '+parts.join(' ')+'.');
    saveGame();
    buildActionUI();
  } else if(a.id==='mural'){
    // HV-11: one painting session. doAction gates cost and cadence, but
    // re-check here so a queued double-fire can't paint two panels a day.
    if(!muralDone() && G.scraps>=2 && (G.mural||0)<MURAL_PANELS){
      G.scraps-=2; G.mural=(G.mural||0)+1; G.muralDay=G.days;
      G.morale=Math.min(100,G.morale+3);
      addRep(2);
      floatText('🎨 +3😊');
      log('🎨 '+MURAL_LINES[G.mural-1]);
      var painters=REGULARS.filter(function(r){ return regularStage(r.id)===2; });
      if(painters.length) log(painters[0].icon+' '+painters[0].name+' came by to paint a while.');
      if(G.mural>=MURAL_PANELS){
        G.goodwill+=5;
        addRep(5);
        log('🎨 The mural is finished. People slow down to look now. +5 goodwill.');
      }
      refreshStructures();
      saveGame();
      buildActionUI();
    }
  } else if(a.id==='meeting'){
    // HV-14: re-check so a queued double-fire can't hold two circles.
    if(!meetingDone() && (G.population||1)>=2){
      var heads=G.population;
      var gain=Math.min(10, 2*heads);
      G.morale=Math.min(100, G.morale+gain);
      // everyone but you tosses something in the pot
      var pot={}, potKeys=['food','cans','scraps','wood','cardboard'];
      for(var mi=1; mi<heads; mi++){
        var rk=potKeys[rand(0,potKeys.length-1)];
        G[rk]=(G[rk]||0)+1; pot[rk]=(pot[rk]||0)+1;
      }
      G.meetings=(G.meetings||0)+1; G.meetingDay=G.days;
      addRep(2);
      var potParts=Object.keys(pot).map(function(k){ return '+'+pot[k]+({food:'🍞',cans:'🫙',scraps:'🧱',wood:'🪵',cardboard:'📦'}[k]); });
      floatText('🗣️ +'+gain+'😊'+(potParts.length?' '+potParts.join(' '):''));
      log('🗣️ The camp circles the fire — every voice counts. +'+gain+' morale'+(potParts.length?', the pot takes '+potParts.join(' '):'')+'.');
      if(heads>=5){ G.goodwill+=2; log('🩶 Five voices speak as one village. +2 goodwill.'); }
      saveGame();
      buildActionUI();
    }
  }
  sfx('action');
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
  sfx('craft');
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
  G.peakPopulation=Math.max(G.peakPopulation,G.population); // was tracked in G but never updated
  spawnFigure((Math.random()-.5)*10,(Math.random()-.5)*10,'community');
  sfx('hire');
  log(def.name+' joined the community.');
  buildWorkersUI(); updateHUD();
}

// HV-15: goodwill spent at the notice board becomes civic
// infrastructure — nothing a sweep can take or a thief can carry off.
function doPetition(id){
  var def=PETITIONS.find(function(p){ return p.id===id; });
  if(!def) return;
  if(!petitionsAvailable()){ log('The city only reads petitions from respected camps (50 rep).'); return; }
  if(G.petitions[id]) return;
  if(G.goodwill<def.cost){ log('Not enough goodwill to back the petition (need '+def.cost+'🩶).'); sfx('error'); return; }
  G.goodwill-=def.cost;
  G.petitions[id]=true;
  if(id==='grant'){ G.food+=8; G.wood+=8; G.scraps+=8; floatText('+8🍞 +8🪵 +8🧱'); }
  addRep(2);
  sfx('craft');
  log('📋 The petition went through: '+def.name.toLowerCase()+'. '+def.desc);
  saveGame();
  buildWorkersUI(); updateHUD();
}
